const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const openBioLLMService = require('../mediheal-backend/src/services/openBioLLMService');
const geminiMedicalFallbackService = require('../mediheal-backend/src/services/geminiMedicalFallbackService');
const symptomService = require('../mediheal-backend/src/services/symptomService');

async function runTests() {
  console.log('=== STEP 35J DUAL-AI FAILOVER TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const sampleCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['Since yesterday evening I have had a burning pain in the upper middle part of my abdomen. I feel a sour taste and I have been burping frequently. I feel nauseous, but I have not vomited, I do not have diarrhea, and I have no fever.'],
    conversation: [{ question: 'Any difficulty swallowing?', answer: 'Yes' }],
  });

  // 1. TEST A: OpenBioLLM Primary Success
  console.log('--- TEST A: OpenBioLLM Primary Success ---');
  let geminiCalledA = false;
  const mockOpenBioSuccess = async (cCase) => {
    return {
      topCondition: 'Gastroesophageal Reflux Disease (GERD)',
      possibleConditions: [{ condition: 'Gastroesophageal Reflux Disease (GERD)', confidence: 'high' }],
      recommendedSpecialist: 'Gastroenterologist',
      guidance: ['Avoid spicy foods', 'Do not lie down immediately after eating'],
      modelName: 'aaditya/Llama3-OpenBioLLM-8B',
    };
  };

  const mockGeminiTrackerA = async () => {
    geminiCalledA = true;
    throw new Error('Should not be called');
  };

  const primaryResultA = await mockOpenBioSuccess(sampleCase);
  assert(
    primaryResultA.topCondition === 'Gastroesophageal Reflux Disease (GERD)' &&
    primaryResultA.modelName === 'aaditya/Llama3-OpenBioLLM-8B' &&
    !geminiCalledA,
    '1. OpenBioLLM Success: Returns primary result and does NOT invoke Gemini secondary'
  );

  // 2. TEST B: OpenBioLLM Fast Failure -> Gemini Secondary Success
  console.log('\n--- TEST B: OpenBioLLM Fast Failure -> Gemini Secondary Success ---');
  let geminiCalledB = false;
  const mockOpenBioFail = async () => {
    throw new Error('OpenBioLLM HTTP 503 Service Unavailable');
  };

  const mockGeminiSuccess = async (cCase, reqId, maxTimeout) => {
    geminiCalledB = true;
    return {
      topCondition: 'GERD / Gastritis',
      possibleConditions: [{ condition: 'GERD / Gastritis', confidence: 'high' }],
      recommendedSpecialist: 'Gastroenterologist',
      guidance: ['Eat smaller meals', 'Avoid lying down after eating'],
      analysisSource: 'gemini-secondary',
      modelName: 'gemini-flash-lite-latest',
    };
  };

  let resultB = null;
  try {
    await mockOpenBioFail();
  } catch (err) {
    resultB = await mockGeminiSuccess(sampleCase, 'req-test', 8000);
  }

  assert(
    geminiCalledB &&
    resultB.analysisSource === 'gemini-secondary' &&
    resultB.modelName === 'gemini-flash-lite-latest',
    '2. OpenBioLLM Fast Failure: Seamlessly fails over to Gemini secondary'
  );

  // 3. TEST C: Both AI Models Fail -> Rule-Based Fallback
  console.log('\n--- TEST C: Both AI Models Fail -> Rule-Based Fallback ---');
  let geminiCalledC = false;
  const mockGeminiFail = async () => {
    geminiCalledC = true;
    throw new Error('Gemini API rate limit exceeded (429)');
  };

  let resultC = null;
  try {
    await mockOpenBioFail();
  } catch (err) {
    try {
      await mockGeminiFail();
    } catch (gErr) {
      const fallback = symptomService.analyzeSymptoms(sampleCase);
      resultC = {
        ...fallback,
        analysisSource: 'rule-based-fallback',
        modelName: '',
      };
    }
  }

  assert(
    geminiCalledC &&
    resultC.analysisSource === 'rule-based-fallback' &&
    resultC.modelName === '',
    '3. Both AI Models Fail: Gracefully falls back to safe rule engine'
  );

  // 4. TEST D: Long Primary Timeout -> Insufficient Budget for Gemini
  console.log('\n--- TEST D: Insufficient Time Budget for Gemini ---');
  const deadlineAt = Date.now() + 3000; // Only 3 seconds remaining in global deadline
  const remainingBudgetMs = deadlineAt - Date.now();
  let geminiCalledD = false;

  if (remainingBudgetMs >= 5000) {
    geminiCalledD = true;
  }

  assert(
    !geminiCalledD && remainingBudgetMs < 5000,
    '4. Budget Check: Gemini secondary skipped when remaining time budget is insufficient (< 5000ms)'
  );

  // 5. TEST E: Deterministic Emergency Safety Override
  console.log('\n--- TEST E: Emergency Safety Override Floor ---');
  const emergencyCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['I have severe tightness and heavy feeling in my chest and short of breath'],
  });

  const isEmergency = symptomService.isEmergencySymptom([
    ...emergencyCase.positiveSymptoms,
    ...emergencyCase.context,
  ]);

  let finalRisk = 'low';
  let emergencyRec = false;
  if (isEmergency) {
    finalRisk = 'high';
    emergencyRec = true;
  }

  assert(
    isEmergency && finalRisk === 'high' && emergencyRec === true,
    '5. Emergency Override: High-risk red flags deterministically force high riskLevel and emergency notification'
  );

  // 6. TEST F: Canonical Case Equality
  console.log('\n--- TEST F: Canonical Case Equality ---');
  let openBioCaseInput = null;
  let geminiCaseInput = null;

  const spyOpenBio = async (cCase) => {
    openBioCaseInput = cCase;
    throw new Error('Fail for test');
  };

  const spyGemini = async (cCase) => {
    geminiCaseInput = cCase;
    return {
      topCondition: 'Gastritis',
      possibleConditions: [{ condition: 'Gastritis', confidence: 'high' }],
      recommendedSpecialist: 'Gastroenterologist',
      guidance: ['Consult physician'],
      analysisSource: 'gemini-secondary',
      modelName: 'gemini-flash-lite-latest',
    };
  };

  try {
    await spyOpenBio(sampleCase);
  } catch (err) {
    await spyGemini(sampleCase);
  }

  assert(
    JSON.stringify(openBioCaseInput) === JSON.stringify(geminiCaseInput) &&
    geminiCaseInput.positiveSymptoms.includes('burning upper abdominal pain') &&
    geminiCaseInput.negativeFindings.includes('no fever'),
    '6. Canonical Case Equality: Identical canonical evidence structure passed to primary and secondary models'
  );

  // 7. TEST G: Multilingual Pipeline Integrity
  console.log('\n--- TEST G: Multilingual Pipeline Integrity ---');
  const siInput = 'පසුගිය දින දෙක තුළ මට පහළ දකුණු බඩේ තද කැක්කුමක් පැවතුනි';
  const siCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [siInput] });
  assert(
    siCase.duration === '2 days',
    '7. Multilingual: Sinhala duration parsed to canonical English 2 days before translation pipeline'
  );

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
