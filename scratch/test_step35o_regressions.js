const assert = require('assert');
const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiConversationService = require('../mediheal-backend/src/services/geminiConversationService');
const symptomService = require('../mediheal-backend/src/services/symptomService');

console.log('====================================================');
console.log('STEP 35O — REGRESSION & SAFETY SUITE');
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

// ----------------------------------------------------
// 1. EXPECTED INITIAL CANONICAL CASE
// ----------------------------------------------------
const input35O = "I don’t really know how to explain it, but for the last two days I just haven’t felt right; whenever I stand up I get light-headed, my heart sometimes feels like it is beating faster than normal, and I feel weak and tired, but I haven’t actually fainted and I don’t have any chest pain.";

runTest('Initial Canonical Case extraction for Step 35O patient statement', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [input35O] });

  console.log('  Extracted Canonical Case:', JSON.stringify(canonicalCase, null, 2));

  // Positive Symptoms assertions
  assert(canonicalCase.positiveSymptoms.includes('light-headedness on standing') || canonicalCase.positiveSymptoms.includes('light-headedness'), 'Must include light-headedness');
  assert(canonicalCase.positiveSymptoms.includes('palpitations'), 'Must include palpitations');
  assert(canonicalCase.positiveSymptoms.includes('weakness'), 'Must include weakness');
  assert(canonicalCase.positiveSymptoms.includes('fatigue'), 'Must include fatigue');

  // Negative Findings assertions
  assert(canonicalCase.negativeFindings.includes('no fainting'), 'Must include "no fainting"');
  assert(canonicalCase.negativeFindings.includes('no chest pain'), 'Must include "no chest pain"');

  // Context & Duration assertions
  assert(canonicalCase.context.some(c => c.includes('standing')), 'Must include standing trigger context');
  assert.strictEqual(canonicalCase.duration, '2 days', 'Duration must equal 2 days');
  assert.strictEqual(canonicalCase.severity, null, 'Severity must be null');

  // MUST NOT include denied or hallucinated symptoms
  assert(!canonicalCase.positiveSymptoms.includes('chest pain'), 'MUST NOT include positive chest pain');
  assert(!canonicalCase.positiveSymptoms.includes('head pain'), 'MUST NOT include head pain');
  assert(!canonicalCase.positiveSymptoms.includes('headache'), 'MUST NOT include headache');
  assert(!canonicalCase.positiveSymptoms.includes('head'), 'MUST NOT include bare "head"');
});

runTest('Step 35O case emergency evaluation must be FALSE', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [input35O] });
  const isEmerg = symptomService.isEmergencySymptom(canonicalCase);
  assert.strictEqual(isEmerg, false, 'Negated chest pain must NOT trigger emergency status');
});

// ----------------------------------------------------
// 2. NEGATION REGRESSION MATRIX
// ----------------------------------------------------
runTest('Negation Matrix - Test A: "I have dizziness but no chest pain."', () => {
  const caseA = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ["I have dizziness but no chest pain."] });
  assert(caseA.positiveSymptoms.includes('dizziness'), 'Positive must include dizziness');
  assert(!caseA.positiveSymptoms.includes('chest pain'), 'Positive must NOT include chest pain');
  assert(caseA.negativeFindings.includes('no chest pain'), 'Negative must include "no chest pain"');
  assert.strictEqual(symptomService.isEmergencySymptom(caseA), false, 'Must not be emergency');
});

runTest('Negation Matrix - Test B: "I have chest pain but no dizziness."', () => {
  const caseB = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ["I have chest pain but no dizziness."] });
  assert(caseB.positiveSymptoms.includes('chest pain'), 'Positive must include chest pain');
  assert(!caseB.positiveSymptoms.includes('dizziness'), 'Positive must NOT include dizziness');
  assert.strictEqual(symptomService.isEmergencySymptom(caseB), true, 'Chest pain must trigger emergency');
});

runTest('Negation Matrix - Test C: "I have cough but no fever or shortness of breath."', () => {
  const caseC = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ["I have cough but no fever or shortness of breath."] });
  assert(caseC.positiveSymptoms.includes('cough'), 'Positive must include cough');
  assert(!caseC.positiveSymptoms.includes('fever'), 'Positive must NOT include fever');
  assert(!caseC.positiveSymptoms.includes('difficulty breathing'), 'Positive must NOT include breathing difficulty');
  assert(caseC.negativeFindings.includes('no fever'), 'Negative must include "no fever"');
  assert(caseC.negativeFindings.includes('no breathing difficulty'), 'Negative must include "no breathing difficulty"');
  assert.strictEqual(symptomService.isEmergencySymptom(caseC), false, 'Must not be emergency');
});

runTest('Negation Matrix - Test D: "I have severe chest pain and shortness of breath."', () => {
  const caseD = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ["I have severe chest pain and shortness of breath."] });
  assert(caseD.positiveSymptoms.includes('chest pain'), 'Positive must include chest pain');
  assert(caseD.positiveSymptoms.includes('difficulty breathing'), 'Positive must include difficulty breathing');
  assert.strictEqual(symptomService.isEmergencySymptom(caseD), true, 'Severe chest pain + SOB must trigger emergency');
});

// ----------------------------------------------------
// 3. EVIDENCE RECONCILIATION PASS
// ----------------------------------------------------
runTest('Evidence Reconciliation removes positive symptom when denied in negativeFindings', () => {
  const conflictingCase = {
    positiveSymptoms: ['chest pain', 'fever', 'light-headedness on standing'],
    negativeFindings: ['no chest pain', 'no fever'],
    context: [],
    duration: '2 days',
    severity: null
  };

  const reconciled = clinicalCaseService.reconcilePositiveAndNegativeEvidence(conflictingCase);
  assert(!reconciled.positiveSymptoms.includes('chest pain'), 'Chest pain removed');
  assert(!reconciled.positiveSymptoms.includes('fever'), 'Fever removed');
  assert(reconciled.positiveSymptoms.includes('light-headedness on standing'), 'Light-headedness preserved');
});

// ----------------------------------------------------
// 4. QUESTION VALIDATOR SAFETY CHECKS
// ----------------------------------------------------
runTest('Validator rejects question contradicting negative findings', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [input35O] });
  const result = geminiConversationService.validateFollowUpQuestion({
    question: "How severe is your chest pain?",
    canonicalCase,
    previousQuestions: []
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'CONTRADICTS_NEGATIVE_FINDING');
});

runTest('Validator rejects body-location question for non-localized systemic complaints', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [input35O] });
  const result = geminiConversationService.validateFollowUpQuestion({
    question: "Which part of your body is bothering you?",
    canonicalCase,
    previousQuestions: []
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'location_question_unneeded_for_systemic');
});

runTest('Validator rejects unsupported symptom assumption (head pain when patient reported dizziness)', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ["I feel dizzy when standing."] });
  const result = geminiConversationService.validateFollowUpQuestion({
    question: "How long has your head pain lasted?",
    canonicalCase,
    previousQuestions: []
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'unsupported_symptom_assumption');
});

console.log('\n----------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
