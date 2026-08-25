/**
 * Step 35C - Complete Clinical Case Assembly & Follow-up Symptom Extraction Tests
 */

const { buildCanonicalClinicalCase } = require('../mediheal-backend/src/services/clinicalCaseService');
const symptomService = require('../mediheal-backend/src/services/symptomService');
const openBioLLMService = require('../mediheal-backend/src/services/openBioLLMService');

async function runStep35CTests() {
  console.log('====================================================');
  console.log('STEP 35C — CLINICAL CASE ASSEMBLY & EXTRACTION TESTS');
  console.log('====================================================\n');

  let passedAll = true;

  // 1. EXACT KNEE / FALL / FOOTBALL TEST
  console.log('--- TEST 1: Exact Knee Fall + Football Case ---');
  const case1 = buildCanonicalClinicalCase({
    symptoms: ['I have knee pain after I fell down while playing football and now it is hurting.'],
    conversation: [
      { question: 'How long has your knee been hurting since the fall?', answer: 'Today' },
      { question: 'Could you tell me how severe the pain in your knee is?', answer: 'Moderate' },
      { question: 'Are you able to put any weight on your leg, or is there any swelling?', answer: 'There is swelling' },
    ],
  });

  console.log('Extracted Case 1:', JSON.stringify(case1, null, 2));

  const hasKneePain = case1.positiveSymptoms.includes('knee pain');
  const hasKneeSwelling = case1.positiveSymptoms.includes('knee swelling');
  const notHasRedundant = !case1.positiveSymptoms.some((s) => s.includes('hurting'));
  const notHasJointPain = !case1.positiveSymptoms.includes('joint pain');
  const hasFall = case1.context.includes('fall');
  const hasFootball = case1.context.some((c) => c.includes('football'));
  const durationOk = case1.duration === 'today';
  const severityOk = case1.severity === 'moderate';

  if (hasKneePain && hasKneeSwelling && notHasRedundant && notHasJointPain && hasFall && hasFootball && durationOk && severityOk) {
    console.log('✅ TEST 1 PASSED: Knee/Fall/Football clinical case correctly assembled!\n');
  } else {
    console.error('❌ TEST 1 FAILED!');
    passedAll = false;
  }

  // 2. TEST A: Headache + Nausea
  console.log('--- TEST A: Headache + Nausea ---');
  const caseA = buildCanonicalClinicalCase({
    symptoms: ['I have a headache'],
    conversation: [
      { question: 'Do you have nausea or vomiting?', answer: 'Nausea' },
    ],
  });
  console.log('Extracted Case A:', JSON.stringify(caseA, null, 2));

  if (caseA.positiveSymptoms.includes('headache') && caseA.positiveSymptoms.includes('nausea')) {
    console.log('✅ TEST A PASSED: Headache + Nausea extracted!\n');
  } else {
    console.error('❌ TEST A FAILED!');
    passedAll = false;
  }

  // 3. TEST B: Ankle Twist + Swelling
  console.log('--- TEST B: Ankle Twist + Swelling ---');
  const caseB = buildCanonicalClinicalCase({
    symptoms: ['My ankle hurts after I twisted it while running'],
    conversation: [
      { question: 'Is there swelling?', answer: 'Yes' },
    ],
  });
  console.log('Extracted Case B:', JSON.stringify(caseB, null, 2));

  if (
    caseB.positiveSymptoms.includes('ankle pain') &&
    caseB.positiveSymptoms.includes('ankle swelling') &&
    caseB.context.some((c) => c.includes('twisting') || c.includes('running'))
  ) {
    console.log('✅ TEST B PASSED: Ankle Twist + Swelling extracted!\n');
  } else {
    console.error('❌ TEST B FAILED!');
    passedAll = false;
  }

  // 4. TEST C: Stomach Pain + Negative Finding (No Vomiting)
  console.log('--- TEST C: Stomach Pain + Negative Finding ---');
  const caseC = buildCanonicalClinicalCase({
    symptoms: ['I have stomach pain'],
    conversation: [
      { question: 'Have you been vomiting?', answer: 'No' },
    ],
  });
  console.log('Extracted Case C:', JSON.stringify(caseC, null, 2));

  if (
    caseC.positiveSymptoms.includes('stomach pain') &&
    !caseC.positiveSymptoms.includes('vomiting') &&
    caseC.negativeFindings.includes('no vomiting')
  ) {
    console.log('✅ TEST C PASSED: Negative finding recorded, positive symptoms preserved!\n');
  } else {
    console.error('❌ TEST C FAILED!');
    passedAll = false;
  }

  // 5. TEST D: Fever + Duration
  console.log('--- TEST D: Fever + Duration ---');
  const caseD = buildCanonicalClinicalCase({
    symptoms: ['I have fever'],
    conversation: [
      { question: 'How long?', answer: 'Three days' },
    ],
  });
  console.log('Extracted Case D:', JSON.stringify(caseD, null, 2));

  if (caseD.positiveSymptoms.includes('fever') && caseD.duration.includes('3')) {
    console.log('✅ TEST D PASSED: Fever + Duration extracted!\n');
  } else {
    console.error('❌ TEST D FAILED!');
    passedAll = false;
  }

  // 6. TEST E: Emergency Detection (Chest pain + Difficulty breathing)
  console.log('--- TEST E: Emergency Detection ---');
  const caseE = buildCanonicalClinicalCase({
    symptoms: ['I have chest pain'],
    conversation: [
      { question: 'Are you having difficulty breathing?', answer: 'Yes' },
    ],
  });
  console.log('Extracted Case E:', JSON.stringify(caseE, null, 2));
  const isEmergE = symptomService.isEmergencySymptom([...caseE.positiveSymptoms, ...caseE.context]);

  if (caseE.positiveSymptoms.includes('chest pain') && caseE.positiveSymptoms.includes('difficulty breathing') && isEmergE) {
    console.log('✅ TEST E PASSED: Emergency triggers activated!\n');
  } else {
    console.error('❌ TEST E FAILED!');
    passedAll = false;
  }

  console.log('====================================================');
  if (passedAll) {
    console.log('ALL STEP 35C UNIT & CANONICAL CASE TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('SOME STEP 35C TESTS FAILED.');
    process.exit(1);
  }
}

runStep35CTests();
