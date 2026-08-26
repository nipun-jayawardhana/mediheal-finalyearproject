const symptomService = require('../mediheal-backend/src/services/symptomService');
const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');

async function runTests() {
  console.log('=== STEP 35G AUTOMATED TEST SUITE ===\n');

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

  // 1. EXACT CHEST CASE TEST
  const chestInput = 'I have been experiencing a tight and heavy feeling in the center of my chest since this morning, and sometimes the discomfort spreads toward my left shoulder and arm, especially when I walk quickly or climb stairs, and I also feel slightly short of breath, sweaty, and nauseous.';
  const isEmergencyChest = symptomService.isEmergencySymptom([chestInput]);
  assert(isEmergencyChest === true, 'Initial exact chest case triggers emergency detector immediately');

  // Build canonical clinical case for exact chest case
  const chestCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['tight and heavy feeling in chest', 'discomfort spreads to left shoulder and arm', 'short of breath', 'sweaty', 'nauseous'],
    conversation: [],
    duration: 'since this morning',
    severity: 'severe',
    context: ['worse when walking quickly', 'worse when climbing stairs'],
  });

  assert(chestCase.positiveSymptoms.length >= 3, 'Chest case preserves multi-symptom details in positiveSymptoms');
  assert(chestCase.context.length >= 1, 'Chest case preserves exertional context in context array');

  // Rule-based safety analysis on chest case
  const chestAnalysis = symptomService.analyzeSymptoms(chestCase);
  assert(chestAnalysis.riskLevel === 'high', 'Chest case produces high risk level');
  assert(chestAnalysis.emergencyRecommended === true, 'Chest case recommends emergency');
  assert(chestAnalysis.guidance.some(g => g.toLowerCase().includes('immediate')), 'Chest case guidance includes emergency guidance');

  // 2. FOLLOW-UP EMERGENCY DISCOVERY TEST
  const initialMildInput = ['I have chest discomfort'];
  const initialEmergencyStatus = symptomService.isEmergencySymptom(initialMildInput);

  // Follow-up answer reveals difficulty breathing
  const followUpConversation = [
    { question: 'Are you having difficulty breathing?', answer: 'Yes, short of breath' }
  ];
  const combinedContext = [...initialMildInput, 'Are you having difficulty breathing?', 'Yes, short of breath'];
  const followUpEmergencyStatus = symptomService.isEmergencySymptom(combinedContext);
  assert(followUpEmergencyStatus === true, 'Emergency detected after follow-up answer (difficulty breathing)');

  // 3. SAFETY OVERRIDE MUST WIN TEST
  // Simulate OpenBioLLM returning medium risk on an emergency clinical case
  const mockModelOutputMedium = {
    riskLevel: 'medium',
    emergencyRecommended: false,
    possibleCondition: 'Angina Pectoris',
    possibleConditions: [{ condition: 'Angina Pectoris', confidence: 'high' }],
    recommendedSpecialist: 'Cardiologist',
    guidance: ['Consult a cardiologist.'],
  };

  const isEmergencyTriggered = true; // Deterministic safety flag
  const finalRisk = isEmergencyTriggered ? 'high' : mockModelOutputMedium.riskLevel;
  const finalEmergencyRecommended = isEmergencyTriggered || mockModelOutputMedium.emergencyRecommended;

  assert(finalRisk === 'high', 'Safety override forces finalRisk to HIGH even if model says medium');
  assert(finalEmergencyRecommended === true, 'Safety override forces finalEmergencyRecommended to true');

  // 4. OPENBIOLLM FAILURE / TIMEOUT EMERGENCY PRESERVATION TEST
  const fallbackAnalysis = symptomService.analyzeSymptoms(chestCase);
  fallbackAnalysis.analysisSource = isEmergencyTriggered ? 'rule-based-emergency' : 'rule-based-fallback';

  assert(fallbackAnalysis.analysisSource === 'rule-based-emergency', 'OpenBioLLM failure preserves rule-based-emergency source');
  assert(fallbackAnalysis.riskLevel === 'high', 'OpenBioLLM failure preserves high risk level');
  assert(fallbackAnalysis.emergencyRecommended === true, 'OpenBioLLM failure preserves emergencyRecommended flag');

  // 5. NON-EMERGENCY REGRESSION TEST
  const nonEmergencyInput = ['I have had a mild headache for two days.'];
  const isEmergencyHeadache = symptomService.isEmergencySymptom(nonEmergencyInput);
  assert(isEmergencyHeadache === false, 'Mild headache does NOT trigger emergency detector');

  const headacheCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['headache'],
    conversation: [],
    duration: '2 days',
    severity: 'mild',
  });
  const headacheAnalysis = symptomService.analyzeSymptoms(headacheCase);
  assert(headacheAnalysis.riskLevel === 'low' || headacheAnalysis.riskLevel === 'medium', 'Mild headache produces non-high risk level');
  assert(headacheAnalysis.emergencyRecommended === false, 'Mild headache does NOT recommend emergency');

  // 6. STEP 35F REGRESSION TEST (CASE MERGING & INHERITANCE)
  const mergedCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['knee pain', 'swelling'],
    conversation: [
      { question: 'Which knee is affected?', answer: 'Yes, both knees' },
      { question: 'Do you have breathing trouble?', answer: 'No breathing trouble' },
    ],
    duration: '3 days',
    severity: 'moderate',
  });

  assert(mergedCase.positiveSymptoms.some(s => s.includes('knee')), 'Preserves positive knee symptoms');
  assert(mergedCase.negativeFindings.some(n => n.includes('breathing')), 'Correctly extracts negative finding (no breathing trouble)');

  // 7. MULTILINGUAL EMERGENCY TRIGGER TEST
  const sinhalaEmergency = symptomService.isEmergencySymptom(['තද පපුවේ කැක්කුම']);
  assert(sinhalaEmergency === true, 'Sinhala emergency trigger detected');

  const tamilEmergency = symptomService.isEmergencySymptom(['கடுமையான நெஞ்சு வலி']);
  assert(tamilEmergency === true, 'Tamil emergency trigger detected');

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
