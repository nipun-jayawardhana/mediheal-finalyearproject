const assert = require('assert');
const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiConversationService = require('../mediheal-backend/src/services/geminiConversationService');

console.log('====================================================');
console.log('STEP 35P — HEADACHE, PROVENANCE & EXPORT TEST SUITE');
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
// 1. SECTION A: MODULE CONTRACT ASSERTONS
// ----------------------------------------------------
runTest('Section A: clinicalCaseService.cleanConceptKey is callable at runtime', () => {
  assert.strictEqual(typeof clinicalCaseService.cleanConceptKey, 'function', 'cleanConceptKey must be exported');
  assert.strictEqual(clinicalCaseService.cleanConceptKey('• left-sided headache '), 'left-sided headache');
});

runTest('Section A: clinicalCaseService.assertCanonicalCaseIntegrity is callable at runtime', () => {
  assert.strictEqual(typeof clinicalCaseService.assertCanonicalCaseIntegrity, 'function', 'assertCanonicalCaseIntegrity must be exported');
  const result = clinicalCaseService.assertCanonicalCaseIntegrity({
    positiveSymptoms: ['headache'],
    negativeFindings: ['no fever']
  });
  assert.strictEqual(result.valid, true);
});

// ----------------------------------------------------
// 2. SECTION M: EXACT HEADACHE PATIENT STATEMENT TEST
// ----------------------------------------------------
const input35P = "I have had a throbbing headache on the left side for three days. Bright light and loud sounds make it worse, and I sometimes feel nauseous, but I do not have a fever.";

runTest('Section M: Initial Canonical Case extraction for Step 35P headache input', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [input35P] });

  console.log('  Extracted Canonical Case:\n', JSON.stringify(canonicalCase, null, 2));

  // Positive Symptoms checks
  assert(canonicalCase.positiveSymptoms.includes('left-sided throbbing headache'), 'Must include left-sided throbbing headache');
  assert(canonicalCase.positiveSymptoms.includes('sensitivity to bright light'), 'Must include sensitivity to bright light');
  assert(canonicalCase.positiveSymptoms.includes('sensitivity to loud sounds'), 'Must include sensitivity to loud sounds');
  assert(canonicalCase.positiveSymptoms.includes('nausea'), 'Must include nausea');

  // Negative Findings check
  assert(canonicalCase.negativeFindings.includes('no fever'), 'Must include no fever');
  assert(!canonicalCase.negativeFindings.includes('no headache'), 'MUST NOT include "no headache"');

  // Context & Duration check
  assert(canonicalCase.context.some(c => c.includes('bright light')), 'Context must include bright light aggravation');
  assert(canonicalCase.context.some(c => c.includes('loud sounds')), 'Context must include loud sounds aggravation');
  assert.strictEqual(canonicalCase.duration, '3 days', 'Duration must be 3 days');
  assert.strictEqual(canonicalCase.severity, null, 'Severity must be null');
});

// ----------------------------------------------------
// 3. SECTION N: QUESTION-AWARE FOLLOW-UP NO ANSWER TEST
// ----------------------------------------------------
runTest('Section N: "No" answer to neck stiffness question must NOT manufacture "no headache"', () => {
  const conversation = [
    {
      question: "Have you noticed any stiffness in your neck along with your headache?",
      answer: "No"
    }
  ];

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [input35P],
    conversation
  });

  console.log('  Case after follow-up:\n', JSON.stringify(canonicalCase, null, 2));

  assert(canonicalCase.positiveSymptoms.includes('left-sided throbbing headache'), 'Must retain left-sided throbbing headache');
  assert(canonicalCase.negativeFindings.includes('no neck stiffness'), 'Must include "no neck stiffness"');
  assert(!canonicalCase.negativeFindings.includes('no headache'), 'MUST NOT contain "no headache"');
});

// ----------------------------------------------------
// 4. SECTION O: MULTI-CONCEPT YES/NO QUESTION SAFETY
// ----------------------------------------------------
runTest('Section O: Question validator rejects multi-concept OR questions', () => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ["I have a headache."] });
  const result = geminiConversationService.validateFollowUpQuestion({
    question: "Do you have dizziness or numbness?",
    canonicalCase,
    previousQuestions: []
  });

  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'ambiguous_multi_concept_question');
});

runTest('Section O: Bare "Yes" answer to multi-concept question does NOT auto-affirm both concepts', () => {
  const conversation = [
    {
      question: "Do you have dizziness or numbness?",
      answer: "Yes"
    }
  ];

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["I have a headache."],
    conversation
  });

  console.log('  Multi-concept Yes result:', JSON.stringify(canonicalCase, null, 2));

  // Must NOT blindly add both dizziness and numbness as confirmed positives
  const hasBoth = canonicalCase.positiveSymptoms.includes('dizziness') && canonicalCase.positiveSymptoms.includes('numbness');
  assert.strictEqual(hasBoth, false, 'Must NOT automatically mark both dizziness and numbness as positive');
});

// ----------------------------------------------------
// 5. CONTRADICTION RECONCILIATION PROVENANCE TEST
// ----------------------------------------------------
runTest('Section D/I: Provenance Priority preserves initial positive headache over derived negative', () => {
  const conflictingCase = {
    positiveSymptoms: ['left-sided throbbing headache', 'nausea'],
    negativeFindings: ['no headache', 'no fever'],
    context: [],
    duration: '3 days',
    severity: null
  };

  const reconciled = clinicalCaseService.reconcilePositiveAndNegativeEvidence(conflictingCase);
  assert(reconciled.positiveSymptoms.includes('left-sided throbbing headache'), 'Explicit positive headache retained');
  assert(!reconciled.negativeFindings.includes('no headache'), 'Conflicting negative headache removed');
  assert(reconciled.negativeFindings.includes('no fever'), 'Non-conflicting negative fever retained');
});

console.log('\n----------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
