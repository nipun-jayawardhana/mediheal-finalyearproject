/**
 * Verification Script for Step 35F: Follow-Up Answer Case Merge
 */

const { buildCanonicalClinicalCase } = require('../mediheal-backend/src/services/clinicalCaseService');
const openBioLLMService = require('../mediheal-backend/src/services/openBioLLMService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
    failedTests++;
  }
}

console.log('=== RUNNING STEP 35F FOLLOW-UP CASE MERGE TESTS ===\n');

// TEST 1: Exact Sore Throat Case (Section 10)
console.log('--- TEST 1: Exact Sore Throat Case ---');
const soreThroatCase = buildCanonicalClinicalCase({
  symptoms: [
    'painful sore throat',
    'fever',
    'headache',
    'fatigue',
    'difficulty swallowing',
    'swollen neck glands',
    'white patches in throat',
  ],
  duration: '3 days',
  severity: null,
  conversation: [
    {
      question: 'How high is your fever, and have you checked your temperature?',
      answer: 'Mild fever',
    },
    {
      question: 'Are you having any trouble breathing or shortness of breath?',
      answer: 'No breathing trouble',
    },
    {
      question: 'Have you noticed any cough or body aches along with your other symptoms?',
      answer: 'Yes, both',
    },
  ],
});

console.log('Resulting soreThroatCase:', JSON.stringify(soreThroatCase, null, 2));

assert(
  soreThroatCase.positiveSymptoms.includes('cough') && soreThroatCase.positiveSymptoms.includes('body aches'),
  'Q3 ("Yes, both") adds both "cough" and "body aches" to positiveSymptoms'
);
assert(
  soreThroatCase.positiveSymptoms.length === 9,
  `positiveSymptoms contains all 9 expected items (actual: ${soreThroatCase.positiveSymptoms.length})`
);
assert(
  soreThroatCase.negativeFindings.includes('no breathing difficulty'),
  'Q2 ("No breathing trouble") becomes negativeFinding "no breathing difficulty"'
);
assert(
  !soreThroatCase.positiveSymptoms.includes('difficulty breathing'),
  'Q2 ("No breathing trouble") is NOT added to positiveSymptoms'
);
assert(
  soreThroatCase.additionalDetails.includes('fever described as mild'),
  'Q1 ("Mild fever") adds "fever described as mild" to additionalDetails'
);
assert(
  soreThroatCase.severity === null,
  'Q1 ("Mild fever") does NOT overwrite global case severity to mild (remains null)'
);

// TEST 2: Headache Regression (Section 15)
console.log('\n--- TEST 2: Headache Regression ---');
const headacheCase = buildCanonicalClinicalCase({
  symptoms: ['headache'],
  conversation: [
    {
      question: 'Are you experiencing any nausea?',
      answer: 'Yes',
    },
  ],
});
assert(
  headacheCase.positiveSymptoms.includes('headache') && headacheCase.positiveSymptoms.includes('nausea'),
  'Headache + affirmative nausea follow-up yields positive: [headache, nausea]'
);

// TEST 3: Knee Regression (Section 16)
console.log('\n--- TEST 3: Knee Regression ---');
const kneeCase = buildCanonicalClinicalCase({
  symptoms: ['knee pain after fall'],
  conversation: [
    {
      question: 'Have you noticed any swelling in your knee?',
      answer: 'Yes',
    },
  ],
});
assert(
  kneeCase.positiveSymptoms.includes('knee pain') && kneeCase.positiveSymptoms.includes('knee swelling'),
  'Knee pain after fall + swelling follow-up yields positive: [knee pain, knee swelling]'
);
assert(
  kneeCase.context.includes('fall'),
  'Knee case correctly maintains context: ["fall"]'
);

// TEST 4: Negative Regression (Section 17)
console.log('\n--- TEST 4: Negative Regression ---');
const stomachCase = buildCanonicalClinicalCase({
  symptoms: ['stomach pain'],
  conversation: [
    {
      question: 'Do you have any vomiting?',
      answer: 'No',
    },
  ],
});
assert(
  stomachCase.positiveSymptoms.includes('stomach pain') && !stomachCase.positiveSymptoms.includes('vomiting'),
  'Negative answer for vomiting keeps positiveSymptoms: [stomach pain]'
);
assert(
  stomachCase.negativeFindings.includes('no vomiting'),
  'Negative answer for vomiting adds negativeFindings: [no vomiting]'
);

// TEST 5: Multi-Option Test (Section 18)
console.log('\n--- TEST 5: Multi-Option Test ---');
const multiCase = buildCanonicalClinicalCase({
  symptoms: ['fever'],
  conversation: [
    {
      question: 'Do you have cough or body aches?',
      answer: 'Yes, both',
    },
  ],
});
assert(
  multiCase.positiveSymptoms.includes('cough') && multiCase.positiveSymptoms.includes('body aches'),
  'Multi-option "Yes, both" extracts cough and body aches'
);

// TEST 6: Multilingual English Translation test (Section 19)
console.log('\n--- TEST 6: Multilingual English Canonical Case ---');
const siCase = buildCanonicalClinicalCase({
  symptoms: ['උණ (fever)', 'කැස්ස (cough)'],
  conversation: [
    {
      question: 'Do you have difficulty breathing?',
      answer: 'No',
    },
  ],
});
assert(
  siCase.negativeFindings.includes('no breathing difficulty'),
  'Multilingual Q&A turns correctly populate negativeFindings'
);

console.log(`\n=== SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED ===`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL STEP 35F CASE MERGE TESTS PASSED SUCCESSFULLY!');
}
