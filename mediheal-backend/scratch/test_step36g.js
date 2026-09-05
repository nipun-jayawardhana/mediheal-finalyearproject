/**
 * STEP 36G Test Suite — Clinical Symptom Understanding & Follow-up Relevance
 *
 * Validates:
 * - Test Case A: English Rash (itchy red rash, no lip swelling, no difficulty breathing, both arms, today)
 * - Test Case B: Sinhala Rash (අද අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක් ආවා...)
 * - Test Case C: Generic Question + Sinhala Descriptive Answer ("අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක්")
 * - Test Case D: Urinary Complaint ("මුත්රා කරනකොට වේදනාවක් තියෙනවා")
 * - Test Case E: Negated Swelling Guard (Rejects "How long have you been experiencing the swelling?")
 * - Test Case F: Headache Relevance Guard (Follow-up must stay in neurology domain)
 * - Test Case G: Musculoskeletal Complaint ("sharp lower back pain spreading to right hip with ankle instability")
 * - Test Case H: English / Sinhala Semantic Parity
 * - Test Case I: Tamil Case Verification
 */

const assert = require('assert');
const clinicalCaseService = require('../src/services/clinicalCaseService');
const geminiConversationService = require('../src/services/geminiConversationService');

console.log('====================================================');
console.log('STARTING STEP 36G VERIFICATION TEST SUITE');
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
// TEST CASE A: English Rash
// -------------------------------------------------------------
runTest('TEST CASE A: English Rash (itchy red rash, both arms, no lip swelling, no difficulty breathing)', () => {
  const input = "I developed an itchy red rash on both arms today. I have no swelling of my lips and no difficulty breathing.";

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [input],
  });

  const profile = clinicalCaseService.buildClinicalProfile(canonicalCase);

  console.log('Test Case A profile:', JSON.stringify(profile, null, 2));

  // 1. Positive symptoms must contain itchy red rash
  assert(
    canonicalCase.positiveSymptoms.some((s) => s.includes('rash')),
    'Must contain rash in positiveSymptoms'
  );

  // 2. Negative findings must contain no lip swelling and no difficulty breathing
  assert(
    canonicalCase.negativeFindings.some((s) => s.includes('lip swelling')),
    'Must contain no lip swelling in negativeFindings'
  );
  assert(
    canonicalCase.negativeFindings.some((s) => s.includes('difficulty breathing')),
    'Must contain no difficulty breathing in negativeFindings'
  );

  // 3. Positive symptoms must NOT contain positive swelling or breathing difficulty
  assert(
    !canonicalCase.positiveSymptoms.some((s) => s.toLowerCase() === 'swelling' || s.toLowerCase().includes('lip swelling')),
    'Must NOT contain positive swelling'
  );
  assert(
    !canonicalCase.positiveSymptoms.some((s) => s.toLowerCase().includes('breathing')),
    'Must NOT contain positive breathing problem'
  );

  // 4. Body location context must contain both arms
  assert(
    canonicalCase.context.some((c) => c.includes('arm')),
    'Must contain arm in context/body regions'
  );

  // 5. Duration must be today
  assert.strictEqual(canonicalCase.duration, 'today', 'Duration must be today');

  // 6. Clinical Domain must be dermatology
  assert.strictEqual(profile.clinicalDomain, 'dermatology', 'Domain must be dermatology');

  // 7. Joint questions must be rejected for dermatology
  const jointValidation = geminiConversationService.validateFollowUpQuestion({
    question: "Are you able to put weight on the joint?",
    canonicalCase,
  });
  assert.strictEqual(jointValidation.accepted, false, 'Joint question must be rejected for dermatology rash case');

  // 8. Swelling assumption questions must be rejected
  const swellingValidation = geminiConversationService.validateFollowUpQuestion({
    question: "How long have you been experiencing the swelling?",
    canonicalCase,
  });
  assert.strictEqual(swellingValidation.accepted, false, 'Swelling question must be rejected when lip swelling is negated');
});

// -------------------------------------------------------------
// TEST CASE B: Sinhala Rash
// -------------------------------------------------------------
runTest('TEST CASE B: Sinhala Rash (අද අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක් ආවා...)', () => {
  const sinhalaInput = "අද අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක් ආවා. තොල් ඉදිමීමක්වත් හුස්ම ගන්න අපහසුතාවයක්වත් නැහැ";

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [sinhalaInput],
  });

  const profile = clinicalCaseService.buildClinicalProfile(canonicalCase);

  console.log('Test Case B profile:', JSON.stringify(profile, null, 2));

  // 1. Positive symptoms
  assert(
    canonicalCase.positiveSymptoms.some((s) => s.includes('rash') || s.includes('කැසීම')),
    'Must contain rash in positiveSymptoms'
  );

  // 2. Negative findings
  assert(
    canonicalCase.negativeFindings.some((s) => s.includes('lip swelling')),
    'Must contain no lip swelling in negativeFindings'
  );
  assert(
    canonicalCase.negativeFindings.some((s) => s.includes('difficulty breathing')),
    'Must contain no difficulty breathing in negativeFindings'
  );

  // 3. Must NOT contain positive swelling
  assert(
    !canonicalCase.positiveSymptoms.some((s) => s.toLowerCase() === 'swelling' || s.toLowerCase().includes('lip swelling')),
    'Must NOT contain positive swelling'
  );

  // 4. Body location context
  assert(
    canonicalCase.context.some((c) => c.includes('arm')),
    'Must contain arm in context'
  );

  // 5. Clinical Domain
  assert.strictEqual(profile.clinicalDomain, 'dermatology', 'Domain must be dermatology');
});

// -------------------------------------------------------------
// TEST CASE C: Generic Question + Sinhala Descriptive Answer
// -------------------------------------------------------------
runTest('TEST CASE C: Generic Question + Sinhala Descriptive Answer', () => {
  const conversation = [
    {
      question: "Are you experiencing any other symptoms?",
      answer: "අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක්",
      originalQuestion: "Are you experiencing any other symptoms?",
      originalAnswer: "අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක්",
    },
  ];

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [],
    conversation,
  });

  console.log('Test Case C canonical case:', JSON.stringify(canonicalCase, null, 2));

  assert(
    canonicalCase.positiveSymptoms.length > 0,
    'Must derive positive symptoms from descriptive answer (NOT empty Derived: [])'
  );
  assert(
    canonicalCase.positiveSymptoms.some((s) => s.includes('rash')),
    'Derived positive symptom must include rash'
  );
  assert(
    canonicalCase.context.some((c) => c.includes('arm')),
    'Derived context must include arm'
  );
});

// -------------------------------------------------------------
// TEST CASE D: Urinary Complaint
// -------------------------------------------------------------
runTest('TEST CASE D: Urinary Complaint ("මුත්රා කරනකොට වේදනාවක් තියෙනවා")', () => {
  const urinaryInput = "මුත්රා කරනකොට වේදනාවක් තියෙනවා";

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [urinaryInput],
  });

  const profile = clinicalCaseService.buildClinicalProfile(canonicalCase);

  console.log('Test Case D profile:', JSON.stringify(profile, null, 2));

  assert(
    canonicalCase.positiveSymptoms.includes('painful urination') ||
    canonicalCase.positiveSymptoms.some((s) => s.includes('urination')),
    'Must contain painful urination'
  );
  assert.strictEqual(profile.clinicalDomain, 'urinary', 'Domain must be urinary');

  // Deterministic fallback for urinary must be relevant
  const fallback = geminiConversationService.getValidatedDeterministicFallback(
    canonicalCase.positiveSymptoms,
    [],
    0,
    canonicalCase,
    [],
    []
  );
  console.log('Test Case D fallback question:', fallback.question);
  assert(
    fallback.question.toLowerCase().includes('urine') ||
    fallback.question.toLowerCase().includes('urinat') ||
    fallback.question.toLowerCase().includes('blood') ||
    fallback.question.toLowerCase().includes('fever'),
    'Urinary fallback question must be clinically relevant'
  );
});

// -------------------------------------------------------------
// TEST CASE E: Negated Swelling Guard
// -------------------------------------------------------------
runTest('TEST CASE E: Negated Swelling Guard (Rejects questions assuming negated swelling)', () => {
  const canonicalCase = {
    positiveSymptoms: ['itchy red rash'],
    negativeFindings: ['no lip swelling', 'no difficulty breathing'],
    context: ['both arms'],
  };

  const validation1 = geminiConversationService.validateFollowUpQuestion({
    question: "How long have you been experiencing the swelling?",
    canonicalCase,
  });
  console.log('Swelling duration question validation:', validation1);
  assert.strictEqual(validation1.accepted, false, 'Must reject "How long have you been experiencing the swelling?"');

  const validation2 = geminiConversationService.validateFollowUpQuestion({
    question: "Is your difficulty breathing getting worse?",
    canonicalCase,
  });
  console.log('Breathing difficulty question validation:', validation2);
  assert.strictEqual(validation2.accepted, false, 'Must reject questions assuming negated breathing difficulty');
});

// -------------------------------------------------------------
// TEST CASE F: Headache Relevance Guard
// -------------------------------------------------------------
runTest('TEST CASE F: Headache Relevance Guard', () => {
  const canonicalCase = {
    positiveSymptoms: ['left-sided throbbing headache', 'sensitivity to bright light'],
    negativeFindings: ['no fever'],
    context: ['left side of head'],
  };

  const profile = clinicalCaseService.buildClinicalProfile(canonicalCase);
  assert.strictEqual(profile.clinicalDomain, 'neurology', 'Headache domain must be neurology');

  // Bowel question rejection
  const bowelValidation = geminiConversationService.validateFollowUpQuestion({
    question: "Have you noticed any changes in your bowel movements?",
    canonicalCase,
  });
  assert.strictEqual(bowelValidation.accepted, false, 'Bowel question must be rejected for headache case');

  // Joint question rejection
  const jointValidation = geminiConversationService.validateFollowUpQuestion({
    question: "Can you bear weight on your legs?",
    canonicalCase,
  });
  assert.strictEqual(jointValidation.accepted, false, 'Joint question must be rejected for headache case');

  // Valid vision question acceptance
  const visionValidation = geminiConversationService.validateFollowUpQuestion({
    question: "Have you noticed any changes in your vision, such as blurriness or seeing spots?",
    canonicalCase,
  });
  assert.strictEqual(visionValidation.accepted, true, 'Vision question must be accepted for headache case');
});

// -------------------------------------------------------------
// TEST CASE G: Musculoskeletal Complaint
// -------------------------------------------------------------
runTest('TEST CASE G: Musculoskeletal Complaint ("sharp lower back pain spreading to right hip with ankle instability")', () => {
  const input = "sharp lower back pain spreading to right hip with ankle instability";

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [input],
  });

  const profile = clinicalCaseService.buildClinicalProfile(canonicalCase);

  console.log('Test Case G profile:', JSON.stringify(profile, null, 2));

  assert(
    canonicalCase.positiveSymptoms.some((s) => s.includes('lower back pain')),
    'Must extract lower back pain'
  );
  assert(
    canonicalCase.positiveSymptoms.some((s) => s.includes('ankle instability')),
    'Must extract ankle instability'
  );
  assert(
    canonicalCase.context.some((c) => c.includes('hip')),
    'Must extract hip in context'
  );
  assert.strictEqual(profile.clinicalDomain, 'musculoskeletal', 'Domain must be musculoskeletal');
});

// -------------------------------------------------------------
// TEST CASE H: English / Sinhala Semantic Parity
// -------------------------------------------------------------
runTest('TEST CASE H: English / Sinhala Semantic Parity for Rash Case', () => {
  const enCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["I developed an itchy red rash on both arms today. I have no swelling of my lips and no difficulty breathing."],
  });
  const siCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["අද අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක් ආවා. තොල් ඉදිමීමක්වත් හුස්ම ගන්න අපහසුතාවයක්වත් නැහැ"],
  });

  const enProfile = clinicalCaseService.buildClinicalProfile(enCase);
  const siProfile = clinicalCaseService.buildClinicalProfile(siCase);

  assert.strictEqual(enProfile.clinicalDomain, siProfile.clinicalDomain, 'Both domains must match (dermatology)');
  assert(enCase.negativeFindings.includes('no lip swelling'), 'EN has no lip swelling');
  assert(siCase.negativeFindings.includes('no lip swelling'), 'SI has no lip swelling');
  assert(enCase.negativeFindings.includes('no difficulty breathing'), 'EN has no difficulty breathing');
  assert(siCase.negativeFindings.includes('no difficulty breathing'), 'SI has no difficulty breathing');
});

// -------------------------------------------------------------
// TEST CASE I: Tamil Case Verification
// -------------------------------------------------------------
runTest('TEST CASE I: Tamil Case Verification (அரிப்பு மற்றும் சிவப்பு தடிப்பு / உதடு வீக்கம் இல்லை)', () => {
  const taInput = "அரிப்பு மற்றும் சிவப்பு தடிப்பு. உதடு வீக்கம் இல்லை";

  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [taInput],
  });

  const profile = clinicalCaseService.buildClinicalProfile(canonicalCase);

  console.log('Test Case I profile:', JSON.stringify(profile, null, 2));

  assert(
    canonicalCase.positiveSymptoms.some((s) => s.includes('rash')),
    'Must extract rash for Tamil input'
  );
  assert(
    canonicalCase.negativeFindings.some((s) => s.includes('lip swelling')),
    'Must extract no lip swelling for Tamil input'
  );
  assert.strictEqual(profile.clinicalDomain, 'dermatology', 'Domain must be dermatology for Tamil rash');
});

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
