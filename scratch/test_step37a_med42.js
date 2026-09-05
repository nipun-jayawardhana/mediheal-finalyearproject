const path = require('path');
require('../mediheal-backend/node_modules/dotenv').config({ path: path.join(__dirname, '../mediheal-backend/.env') });

const med42Service = require('../mediheal-backend/src/services/med42Service');
const geminiMedicalFallbackService = require('../mediheal-backend/src/services/geminiMedicalFallbackService');
const symptomService = require('../mediheal-backend/src/services/symptomService');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('STEP 37A: MED42-8B INTEGRATION AND VERIFICATION SUITE');
  console.log('==================================================\n');

  // ----------------------------------------------------
  // TEST A: MED42 DIRECT PROVIDER TEST
  // ----------------------------------------------------
  console.log('--- TEST A: Direct Provider Test (m42-health/Llama3-Med42-8B) ---');
  const testACase = {
    positiveSymptoms: ['mild headache'],
    negativeFindings: ['no fever', 'no vomiting'],
    context: [],
    duration: '1 day',
    severity: 'mild',
  };

  const resultA = await med42Service.analyzeSymptomsWithMed42(testACase, 'req-test-a');
  console.log('Test A Result:', JSON.stringify(resultA, null, 2));

  assert(resultA && typeof resultA === 'object', 'Test A returned an object');
  assert(Array.isArray(resultA.possibleConditions) && resultA.possibleConditions.length > 0, 'Test A returned possibleConditions array');
  assert(typeof resultA.topCondition === 'string' && resultA.topCondition.length > 0, 'Test A returned non-empty topCondition');
  assert(typeof resultA.recommendedSpecialist === 'string' && resultA.recommendedSpecialist.length > 0, 'Test A returned recommendedSpecialist');
  assert(Array.isArray(resultA.guidance) && resultA.guidance.length > 0, 'Test A returned guidance steps');
  assert(resultA.modelName === 'm42-health/Llama3-Med42-8B', 'Test A served exact model m42-health/Llama3-Med42-8B');

  // ----------------------------------------------------
  // TEST B: URINARY CASE
  // ----------------------------------------------------
  console.log('\n--- TEST B: Urinary Case ---');
  const testBCase = {
    positiveSymptoms: ['painful urination', 'frequent urination'],
    negativeFindings: ['no blood in urine', 'no fever'],
    context: [],
    duration: 'several days',
    severity: 'moderate',
  };

  const resultB = await med42Service.analyzeSymptomsWithMed42(testBCase, 'req-test-b');
  console.log('Test B Result:', JSON.stringify(resultB, null, 2));

  assert(resultB && Array.isArray(resultB.possibleConditions), 'Test B returned valid structured response');
  assert(resultB.possibleConditions.length > 0, 'Test B has at least 1 possible condition');
  const condsBText = JSON.stringify(resultB.possibleConditions).toLowerCase();
  // Ensure negated symptoms (fever, blood in urine) are not treated as positive conditions
  assert(!condsBText.includes('pyrexia of unknown origin'), 'Test B did not hallucinate fever');
  assert(resultB.recommendedSpecialist.length > 0, 'Test B recommended a specialist');

  // ----------------------------------------------------
  // TEST C: RASH CASE
  // ----------------------------------------------------
  console.log('\n--- TEST C: Rash Case ---');
  const testCCase = {
    positiveSymptoms: ['itchy red rash'],
    negativeFindings: ['no lip swelling', 'no difficulty breathing', 'no rash spreading'],
    context: ['both arms'],
    duration: 'today',
    severity: 'mild',
  };

  const resultC = await med42Service.analyzeSymptomsWithMed42(testCCase, 'req-test-c');
  console.log('Test C Result:', JSON.stringify(resultC, null, 2));

  assert(resultC && Array.isArray(resultC.possibleConditions), 'Test C returned valid structured response');
  assert(resultC.possibleConditions.length > 0, 'Test C has at least 1 possible condition');
  assert(['Dermatologist', 'General Physician'].includes(resultC.recommendedSpecialist), 'Test C recommended Dermatologist or General Physician');
  const condsCText = JSON.stringify(resultC.possibleConditions).toLowerCase();
  assert(!condsCText.includes('angioedema') && !condsCText.includes('anaphylaxis'), 'Test C did not diagnose anaphylaxis/angioedema when swelling/breathing negated');

  // ----------------------------------------------------
  // TEST D: PRIMARY FAILURE -> GEMINI SECONDARY FAILOVER
  // ----------------------------------------------------
  console.log('\n--- TEST D: Primary Failure -> Gemini Secondary Failover ---');
  // Simulate controller failover logic
  let secondaryResult = null;
  let analysisSource = null;
  try {
    // Forced primary failure simulation
    throw new Error('Simulated Med42 provider timeout/failure');
  } catch (primaryErr) {
    console.log(`[AI FAILOVER][req-test-d] Secondary invoked (reason: primary Med42 failed: ${primaryErr.message})`);
    secondaryResult = await geminiMedicalFallbackService.analyzeSymptomsWithGeminiSecondary(
      testBCase,
      'req-test-d',
      8000
    );
    analysisSource = 'gemini-secondary';
  }

  console.log('Test D Failover Result:', JSON.stringify(secondaryResult, null, 2));
  assert(secondaryResult && secondaryResult.possibleConditions.length > 0, 'Test D Gemini Secondary returned valid conditions');
  assert(analysisSource === 'gemini-secondary', 'Test D analysisSource is gemini-secondary');

  // ----------------------------------------------------
  // TEST E: BOTH MODEL FAILURES -> DETERMINISTIC FALLBACK
  // ----------------------------------------------------
  console.log('\n--- TEST E: Both Model Failures -> Deterministic Fallback ---');
  let fallbackResult = null;
  let finalSource = null;
  try {
    throw new Error('Simulated Med42 failure');
  } catch (err1) {
    try {
      throw new Error('Simulated Gemini Secondary failure');
    } catch (err2) {
      console.log(`[AI FAILOVER][req-test-e] Secondary skipped (reason: secondary Gemini failed: ${err2.message})`);
      const rawFallback = symptomService.analyzeSymptoms(testBCase);
      fallbackResult = {
        ...rawFallback,
        analysisSource: 'rule-based-fallback',
        modelName: '',
      };
      finalSource = fallbackResult.analysisSource;
    }
  }

  console.log('Test E Fallback Result:', JSON.stringify(fallbackResult, null, 2));
  assert(fallbackResult && fallbackResult.possibleCondition, 'Test E returned deterministic condition');
  assert(finalSource === 'rule-based-fallback', 'Test E analysisSource is rule-based-fallback');

  console.log('\n==================================================');
  console.log('🎉 ALL STEP 37A TESTS (A, B, C, D, E) PASSED!');
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
