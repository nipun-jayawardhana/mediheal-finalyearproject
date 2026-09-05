/**
 * STEP 36G.2 Verification Suite:
 * - Urinary Frequency Concept Linking
 * - Multi-Concept Urgency / Frequency Rejection
 * - False Multilingual Duration Discrepancy Prevention
 * - Reusable Yes/No Semantic Resolution Invariant
 */

const assert = require('assert');
const clinicalCaseService = require('../src/services/clinicalCaseService');
const geminiConversationService = require('../src/services/geminiConversationService');

console.log('====================================================');
console.log('RUNNING STEP 36G.2 VERIFICATION TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

const runTest = (name, fn) => {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
  }
};

// -------------------------------------------------------------
// TEST A — Urinary frequency question + Sinhala Yes ("ඔව්")
// -------------------------------------------------------------
runTest('TEST A — Urinary frequency question + Sinhala Yes ("ඔව්")', () => {
  const question = "Have you been urinating more frequently than usual?";
  const turn = [
    {
      question,
      answer: "ඔව්",
      canonicalQuestion: question,
      canonicalAnswer: "yes",
    },
  ];

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["painful urination"],
    conversation: turn,
  });

  const conceptInfo = clinicalCaseService.extractPrimaryClinicalConcept(question, canonicalCase);
  console.log('Test A Concept Info:', conceptInfo);
  console.log('Test A Positives:', canonicalCase.positiveSymptoms);

  assert.strictEqual(conceptInfo.primaryConcept, 'frequent urination', 'Question concept must be "frequent urination"');
  assert(
    canonicalCase.positiveSymptoms.includes('frequent urination'),
    `Must extract "frequent urination" from "ඔව්" (got: ${JSON.stringify(canonicalCase.positiveSymptoms)})`
  );
  assert(
    canonicalCase.positiveSymptoms.includes('painful urination'),
    'Existing "painful urination" must be preserved'
  );
});

// -------------------------------------------------------------
// TEST B — Urinary frequency question + Sinhala No ("නැත")
// -------------------------------------------------------------
runTest('TEST B — Urinary frequency question + Sinhala No ("නැත")', () => {
  const question = "Have you been urinating more frequently than usual?";
  const turn = [
    {
      question,
      answer: "නැත",
      canonicalQuestion: question,
      canonicalAnswer: "no",
    },
  ];

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["painful urination"],
    conversation: turn,
  });

  console.log('Test B Negatives:', canonicalCase.negativeFindings);
  assert(
    canonicalCase.negativeFindings.includes('no frequent urination'),
    `Must derive "no frequent urination" from "නැත" (got: ${JSON.stringify(canonicalCase.negativeFindings)})`
  );
  assert(
    canonicalCase.positiveSymptoms.includes('painful urination'),
    'Existing "painful urination" must be preserved'
  );
});

// -------------------------------------------------------------
// TEST C — Multi-concept Candidate Rejection ("frequent and urgent need to pass urine")
// -------------------------------------------------------------
runTest('TEST C — Candidate "Have you felt a frequent and urgent need to pass urine?" is rejected', () => {
  const question = "Have you felt a frequent and urgent need to pass urine?";
  const activeCase = {
    positiveSymptoms: ["painful urination"],
    negativeFindings: [],
    context: [],
  };

  const validation = geminiConversationService.validateFollowUpQuestion(question, activeCase);
  console.log('Test C Validation Result:', validation);

  assert.strictEqual(validation.accepted, false, 'Candidate question must be rejected by validator');
  assert(
    ['ambiguous_multi_concept_question', 'unresolved_yes_no_concept'].includes(validation.reason),
    `Reason must be multi-concept or unresolved (got: ${validation.reason})`
  );
});

// -------------------------------------------------------------
// TEST D — Cumulative Case Merge with Urinary Frequency
// -------------------------------------------------------------
runTest('TEST D — Cumulative Case Merge with Urinary Frequency', () => {
  const question = "Have you been urinating more frequently than usual?";
  const turn = [
    {
      question,
      answer: "ඔව්",
      canonicalQuestion: question,
      canonicalAnswer: "yes",
    },
  ];

  const merged = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["painful urination"],
    conversation: turn,
    positiveSymptoms: ["painful urination"],
    negativeFindings: ["no blood in urine"],
    duration: "several days",
  });

  console.log('Test D Merged Case:', JSON.stringify(merged, null, 2));

  assert(merged.positiveSymptoms.includes('painful urination'), 'Must retain positive "painful urination"');
  assert(merged.positiveSymptoms.includes('frequent urination'), 'Must add positive "frequent urination"');
  assert(merged.negativeFindings.includes('no blood in urine'), 'Must retain negative "no blood in urine"');
  assert.strictEqual(merged.duration, 'several days', 'Duration must remain "several days"');
});

// -------------------------------------------------------------
// TEST E — Duration Semantic Equality ("several days" vs "දින කිහිපයක්")
// -------------------------------------------------------------
runTest('TEST E — Duration semantic equality ("several days" vs "දින කිහිපයක්")', () => {
  const turn = [
    {
      question: "How long have you had this?",
      answer: "දින කිහිපයක්",
      canonicalQuestion: "How long have you had this?",
      canonicalAnswer: "several days",
    },
  ];

  const merged = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["painful urination"],
    conversation: turn,
    duration: "several days",
  });

  console.log('Test E Duration:', merged.duration);
  console.log('Test E Additional Details:', merged.additionalDetails);

  assert.strictEqual(merged.duration, 'several days', 'Duration must be "several days"');
  assert(
    !merged.additionalDetails.some((d) => d.toLowerCase().includes('duration discrepancy')),
    `Must NOT contain duration discrepancy for semantically equal durations (got: ${JSON.stringify(merged.additionalDetails)})`
  );
});

// -------------------------------------------------------------
// TEST F — Real Duration Contradiction ("2 days" vs "2 weeks")
// -------------------------------------------------------------
runTest('TEST F — Real duration contradiction ("2 days" vs "2 weeks")', () => {
  const turn = [
    {
      question: "How long have you had this?",
      answer: "2 weeks",
      canonicalQuestion: "How long have you had this?",
      canonicalAnswer: "2 weeks",
    },
  ];

  const merged = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["painful urination"],
    conversation: turn,
    duration: "2 days",
  });

  console.log('Test F Duration:', merged.duration);
  console.log('Test F Additional Details:', merged.additionalDetails);

  assert(
    merged.additionalDetails.some((d) => d.toLowerCase().includes('duration discrepancy')),
    'Must log duration discrepancy for conflicting durations ("2 days" vs "2 weeks")'
  );
});

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
