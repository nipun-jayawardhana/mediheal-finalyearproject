/**
 * STEP 35X.1 Test Suite — Sinhala Canonicalization & Negation Safety
 * Tests Cases A through H and all regression verifications.
 */

const assert = require('assert');
const clinicalCaseService = require('../src/services/clinicalCaseService');
const geminiTranslationService = require('../src/services/geminiTranslationService');
const geminiConversationService = require('../src/services/geminiConversationService');

console.log('====================================================');
console.log('STARTING STEP 35X.1 VERIFICATION TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
  }
}

// -------------------------------------------------------------
// TEST CASE A: Initial Sinhala Input
// -------------------------------------------------------------
runTest('TEST CASE A: Initial Sinhala Input with Negations & Palpitations', () => {
  const sinhalaInput = `මම නැගිටිනකොට මට කරකැවිල්ල වගේ සැහැල්ලු බවක් දැනෙනවා, සමහර වෙලාවට හෘදස්පන්දනය සාමාන්යයට වඩා වේගවත් වෙනවා, දුර්වලත් මහන්සිත් දැනෙනවා. මම සිහි නැති වෙලා නැහැ, පපුවේ වේදනාවකුත් නැහැ`;

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [sinhalaInput],
  });

  console.log('Test Case A result:', JSON.stringify(canonicalCase, null, 2));

  // Must contain negative findings:
  assert(canonicalCase.negativeFindings.includes('no chest pain'), 'Must contain "no chest pain" in negativeFindings');
  assert(canonicalCase.negativeFindings.includes('no fainting'), 'Must contain "no fainting" in negativeFindings');

  // Must NOT contain positive chest pain or fainting:
  assert(!canonicalCase.positiveSymptoms.some(s => s.toLowerCase().includes('chest pain')), 'Must NOT contain positive chest pain');
  assert(!canonicalCase.positiveSymptoms.some(s => s.toLowerCase().includes('faint')), 'Must NOT contain positive fainting');

  // Must contain positive symptoms:
  assert(canonicalCase.positiveSymptoms.includes('light-headedness on standing') || canonicalCase.positiveSymptoms.includes('dizziness'), 'Must contain light-headedness or dizziness');
  assert(canonicalCase.positiveSymptoms.includes('weakness'), 'Must contain weakness');
  assert(canonicalCase.positiveSymptoms.includes('fatigue'), 'Must contain fatigue');
  assert(canonicalCase.positiveSymptoms.includes('palpitations'), 'Must contain palpitations');

  // Must contain context:
  assert(canonicalCase.context.some(c => c.includes('standing')), 'Must contain standing trigger in context');
});

// -------------------------------------------------------------
// TEST CASE B: Sinhala Short NO
// -------------------------------------------------------------
runTest('TEST CASE B: Sinhala Short NO follow-up answer', () => {
  const initialCase = {
    positiveSymptoms: ['light-headedness on standing', 'weakness'],
    negativeFindings: [],
    context: [],
  };

  const conversation = [
    {
      question: 'Do you have chest pain?',
      answer: 'නැහැ',
    },
  ];

  const updatedCase = clinicalCaseService.buildCanonicalClinicalCase({
    ...initialCase,
    conversation,
  });

  console.log('Test Case B result:', JSON.stringify(updatedCase, null, 2));

  assert(updatedCase.negativeFindings.includes('no chest pain'), 'Must derive "no chest pain" from Sinhala "නැහැ" answer');
  assert(!updatedCase.positiveSymptoms.includes('chest pain'), 'Must NOT have positive chest pain');
});

// -------------------------------------------------------------
// TEST CASE C: Specific Sinhala Negation
// -------------------------------------------------------------
runTest('TEST CASE C: Specific Sinhala Negation ("පපුවේ වේදනාව නෑ")', () => {
  const initialCase = {
    positiveSymptoms: ['dizziness', 'chest pain'], // simulate contaminated positive
    negativeFindings: [],
    context: [],
  };

  const conversation = [
    {
      question: 'Can you describe your chest pain?',
      answer: 'පපුවේ වේදනාව නෑ',
    },
  ];

  const updatedCase = clinicalCaseService.buildCanonicalClinicalCase({
    ...initialCase,
    conversation,
  });

  console.log('Test Case C result:', JSON.stringify(updatedCase, null, 2));

  assert(updatedCase.negativeFindings.includes('no chest pain'), 'Must derive "no chest pain" from answer itself');
  assert(!updatedCase.positiveSymptoms.includes('chest pain'), 'Contradictory positive "chest pain" must be purged');
});

// -------------------------------------------------------------
// TEST CASE D: Sinhala Duration
// -------------------------------------------------------------
runTest('TEST CASE D: Sinhala Duration ("දින කිහිපයක්")', () => {
  const initialCase = {
    positiveSymptoms: ['dizziness'],
    negativeFindings: [],
    context: [],
  };

  const conversation = [
    {
      question: 'How long have you been experiencing this?',
      answer: 'දින කිහිපයක්',
    },
  ];

  const updatedCase = clinicalCaseService.buildCanonicalClinicalCase({
    ...initialCase,
    conversation,
  });

  console.log('Test Case D result:', JSON.stringify(updatedCase, null, 2));

  assert.strictEqual(updatedCase.duration, 'several days', 'Duration must be normalized to "several days"');
  assert.notStrictEqual(updatedCase.duration, 'unspecified', 'Duration must NOT be unspecified');
});

// -------------------------------------------------------------
// TEST CASE E: Translation Failure / Timeout Preservation
// -------------------------------------------------------------
runTest('TEST CASE E: Translation Failure preserves canonical case', () => {
  const existingCase = {
    positiveSymptoms: ['light-headedness on standing', 'weakness', 'fatigue'],
    negativeFindings: ['no fainting', 'no chest pain'],
    context: ['light-headedness triggered by standing'],
    duration: 'several days',
  };

  // Simulate translation fallback (empty/failed translation returning fallback)
  const translationFallback = {
    detectedLanguage: 'si',
    englishText: '',
    symptomConcepts: [],
    positiveSymptoms: [],
    negativeFindings: [],
    duration: '',
    isFallback: true,
  };

  // When merging in controller / service
  const preservedCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: translationFallback.symptomConcepts,
    conversation: [],
    activeCase: existingCase,
    positiveSymptoms: existingCase.positiveSymptoms,
    negativeFindings: existingCase.negativeFindings,
    context: existingCase.context,
    duration: existingCase.duration,
  });

  console.log('Test Case E result:', JSON.stringify(preservedCase, null, 2));

  assert.deepStrictEqual(preservedCase.positiveSymptoms, existingCase.positiveSymptoms, 'Positives must remain identical');
  assert.deepStrictEqual(preservedCase.negativeFindings, existingCase.negativeFindings, 'Negatives must remain identical');
  assert.strictEqual(preservedCase.duration, 'several days', 'Duration must remain identical');
  assert(!preservedCase.positiveSymptoms.includes('unspecified symptom'), 'Must NOT collapse to "unspecified symptom"');
});

// -------------------------------------------------------------
// TEST CASE F: Multi-Concept Sinhala Question Rejection
// -------------------------------------------------------------
runTest('TEST CASE F: Multi-Concept Sinhala Question Rejection', () => {
  const sinhalaMultiConceptQ = 'ඔබට මෙම ක්ලාන්තය දැනෙන විට හිසේ කැක්කුමක් හෝ පෙනීමේ වෙනසක් ඇති වෙනවාද?';
  const canonicalCase = {
    positiveSymptoms: ['dizziness'],
    negativeFindings: ['no fainting', 'no chest pain'],
    context: [],
  };

  // Normalized question:
  const normalizedQ = geminiTranslationService.normalizeQuestionTextToEnglish(sinhalaMultiConceptQ);
  console.log('Normalized Sinhala Question:', normalizedQ);
  assert(normalizedQ.includes('headache') && normalizedQ.includes('vision'), 'Must map to headache and vision');

  // extractPrimaryClinicalConcept on normalized Q:
  const conceptInfo = clinicalCaseService.extractPrimaryClinicalConcept(normalizedQ, canonicalCase);
  console.log('Concept Info for Sinhala Question:', conceptInfo);
  assert.strictEqual(conceptInfo.type, 'multiple_independent_concepts', 'Must classify as multiple_independent_concepts');

  // Validator test:
  const validationResult = geminiConversationService.validateFollowUpQuestion({
    question: sinhalaMultiConceptQ,
    canonicalCase,
  });

  console.log('Validation Result:', validationResult);
  assert.strictEqual(validationResult.accepted, false, 'Sinhala multi-concept question must NOT be accepted');
  assert.strictEqual(validationResult.reason, 'ambiguous_multi_concept_question', 'Reason must be ambiguous_multi_concept_question');
});

// -------------------------------------------------------------
// TEST CASE G: English Regression Test
// -------------------------------------------------------------
runTest('TEST CASE G: English Statement Regression', () => {
  const englishInput = 'Whenever I stand up I feel light-headed, my heart sometimes beats faster than usual, and I feel weak and tired. I have not fainted and I do not have chest pain.';

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [englishInput],
  });

  console.log('Test Case G result:', JSON.stringify(canonicalCase, null, 2));

  assert(canonicalCase.positiveSymptoms.includes('light-headedness on standing'), 'Must contain "light-headedness on standing"');
  assert(canonicalCase.positiveSymptoms.includes('palpitations'), 'Must contain "palpitations"');
  assert(canonicalCase.positiveSymptoms.includes('weakness'), 'Must contain "weakness"');
  assert(canonicalCase.positiveSymptoms.includes('fatigue'), 'Must contain "fatigue"');
  assert(canonicalCase.negativeFindings.includes('no fainting'), 'Must contain "no fainting"');
  assert(canonicalCase.negativeFindings.includes('no chest pain'), 'Must contain "no chest pain"');
  assert(!canonicalCase.positiveSymptoms.includes('chest pain'), 'Must NOT have positive chest pain');
  assert(!canonicalCase.positiveSymptoms.includes('fainting'), 'Must NOT have positive fainting');
});

// -------------------------------------------------------------
// TEST CASE H: Sinhala Follow-up YES
// -------------------------------------------------------------
runTest('TEST CASE H: Sinhala Follow-up YES ("ඔව්")', () => {
  const initialCase = {
    positiveSymptoms: ['fatigue'],
    negativeFindings: [],
    context: [],
  };

  const conversation = [
    {
      question: 'Have you experienced dizziness?',
      answer: 'ඔව්',
    },
  ];

  const updatedCase = clinicalCaseService.buildCanonicalClinicalCase({
    ...initialCase,
    conversation,
  });

  console.log('Test Case H result:', JSON.stringify(updatedCase, null, 2));

  assert(updatedCase.positiveSymptoms.includes('dizziness'), 'Must derive positive "dizziness" from Sinhala "ඔව්"');
});

// -------------------------------------------------------------
// RECONCILIATION & SAFETY: Negative findings protect from contradictory questions
// -------------------------------------------------------------
runTest('SAFETY: Question mentioning known negative symptom is rejected', () => {
  const canonicalCase = {
    positiveSymptoms: ['light-headedness on standing', 'weakness'],
    negativeFindings: ['no chest pain', 'no fainting'],
    context: [],
  };

  const validationResult = geminiConversationService.validateFollowUpQuestion({
    question: 'Can you describe what the chest pain feels like?',
    canonicalCase,
  });

  console.log('Chest pain re-ask validation result:', validationResult);
  assert.strictEqual(validationResult.accepted, false, 'Must reject question about chest pain when no chest pain is known');
  assert.strictEqual(validationResult.reason, 'CONTRADICTS_NEGATIVE_FINDING');
});

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
