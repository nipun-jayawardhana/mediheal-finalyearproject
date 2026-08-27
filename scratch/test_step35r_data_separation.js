const assert = require('assert');
const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiTranslationService = require('../mediheal-backend/src/services/geminiTranslationService');

console.log('====================================================');
console.log('STEP 35R — CANONICAL / LOCALIZED SEPARATION TEST SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✅ [PASS] ${description}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${description}`);
    console.error(`   Error: ${err.message}`);
  }
}

async function runAsyncTest(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ [PASS] ${description}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${description}`);
    console.error(`   Error: ${err.message}`);
  }
}

(async () => {

  // ----------------------------------------------------
  // 1. EXACT DIZZINESS / STANDING LIGHT-HEADEDNESS CASE
  // ----------------------------------------------------
  runTest('Dizziness case extracts light-headedness and purges positive chest pain', () => {
    const text = "I don’t really know how to explain it, but for the last two days I just haven’t felt right; whenever I stand up I get light-headed, my heart sometimes feels like it is beating faster than normal, and I feel weak and tired, but I haven’t actually fainted and I don’t have any chest pain.";
    
    let cCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [text] });

    console.log('  Extracted positiveSymptoms:', JSON.stringify(cCase.positiveSymptoms));
    console.log('  Extracted negativeFindings:', JSON.stringify(cCase.negativeFindings));

    assert(cCase.positiveSymptoms.includes('light-headedness on standing') || cCase.positiveSymptoms.includes('light-headedness'), 'Must include light-headedness');
    assert(cCase.positiveSymptoms.includes('weakness'), 'Must include weakness');
    assert(cCase.positiveSymptoms.includes('fatigue'), 'Must include fatigue');

    assert(cCase.negativeFindings.includes('no chest pain'), 'Must include no chest pain in negativeFindings');
    assert(cCase.negativeFindings.includes('no fainting'), 'Must include no fainting in negativeFindings');

    assert(!cCase.positiveSymptoms.includes('chest pain'), 'MUST NOT contain positive chest pain!');
  });

  // ----------------------------------------------------
  // 2. DATA IMMUTABILITY TEST DURING TRANSLATION
  // ----------------------------------------------------
  await runAsyncTest('translateAnalysisResult DOES NOT mutate canonical result object', async () => {
    const canonicalAnalysis = {
      possibleCondition: 'Orthostatic Hypotension',
      possibleConditions: [
        { condition: 'Orthostatic Hypotension', confidence: 'medium' },
        { condition: 'Dehydration', confidence: 'low' }
      ],
      recommendedSpecialist: 'General Physician',
      positiveSymptoms: ['light-headedness on standing', 'palpitations', 'weakness', 'fatigue'],
      negativeFindings: ['no chest pain', 'no fainting'],
      context: ['symptoms worse on standing'],
      guidance: ['Drink plenty of fluids', 'Rise slowly from seated position'],
      disclaimer: 'Consult a qualified doctor.',
      riskLevel: 'low',
      emergencyRecommended: false
    };

    const snapshot = JSON.stringify(canonicalAnalysis);

    const translatedDisplay = await geminiTranslationService.translateAnalysisResult(canonicalAnalysis, 'si');

    const postSnapshot = JSON.stringify(canonicalAnalysis);

    assert.strictEqual(postSnapshot, snapshot, 'FAIL: Canonical analysis object mutated during translation!');
    console.log('  Canonical snapshot verified unchanged!');

    assert.strictEqual(canonicalAnalysis.possibleCondition, 'Orthostatic Hypotension', 'Canonical condition must remain English');
    assert.strictEqual(canonicalAnalysis.recommendedSpecialist, 'General Physician', 'Canonical specialist must remain English');
    assert.deepStrictEqual(canonicalAnalysis.positiveSymptoms, ['light-headedness on standing', 'palpitations', 'weakness', 'fatigue']);

    assert(translatedDisplay.displayPossibleCondition, 'Must return displayPossibleCondition');
    assert(translatedDisplay.displayPossibleConditions, 'Must return displayPossibleConditions');
    assert(translatedDisplay.displayRecommendedSpecialist, 'Must return displayRecommendedSpecialist');
    assert(translatedDisplay.displayPositiveSymptoms, 'Must return displayPositiveSymptoms');

    console.log('  Display possibleCondition (Sinhala):', translatedDisplay.displayPossibleCondition);
    console.log('  Display specialist (Sinhala):', translatedDisplay.displayRecommendedSpecialist);
    console.log('  Display positiveSymptoms (Sinhala):', JSON.stringify(translatedDisplay.displayPositiveSymptoms));
  });

  // ----------------------------------------------------
  // 3. CANONICAL INTEGRITY ASSERTION
  // ----------------------------------------------------
  runTest('assertCanonicalCaseIntegrity passes clean case', () => {
    const cCase = {
      positiveSymptoms: ['light-headedness on standing', 'palpitations', 'weakness', 'fatigue'],
      negativeFindings: ['no chest pain', 'no fainting'],
      context: ['worse on standing'],
      duration: '2 days',
      severity: null
    };

    assert.doesNotThrow(() => {
      clinicalCaseService.assertCanonicalCaseIntegrity(cCase);
    });
  });

  console.log('\n----------------------------------------------------');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed.`);
  console.log('----------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
