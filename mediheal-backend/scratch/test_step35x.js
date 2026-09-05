/**
 * STEP 35X Test Suite
 * Validates:
 * 1. Concept normalization & Validator (Single Concept + Examples vs True Multi-Concept)
 * 2. Test Case A (Headache + Vision Changes Yes/No)
 * 3. Test Case B (Negative Yes/No)
 * 4. Test Case C (Specific Answer)
 * 5. Test Case D (Multi-concept Safety)
 * 6. Test Case E (Generic Safety)
 * 7. Test Case F (Fallback Relevance)
 * 8. Regressions (Severity, Duration, Deduplication, Negation Conflict)
 */

const clinicalCaseService = require('../src/services/clinicalCaseService');
const geminiConversationService = require('../src/services/geminiConversationService');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

async function runStep35XTests() {
  console.log('====================================================');
  console.log('STEP 35X VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // --- 1. Concept Normalization & Validator Tests ---
  console.log('--- 1. Concept Normalization & Validator ---');

  // A. Single concept with examples
  const qVision = "Have you noticed any changes in your vision, such as blurriness or seeing spots?";
  const cVision = clinicalCaseService.extractPrimaryClinicalConcept(qVision);
  assert(cVision.type === 'single_concept_with_examples', `qVision type is single_concept_with_examples (got: ${cVision.type})`);
  assert(cVision.primaryConcept === 'vision changes', `qVision primaryConcept is 'vision changes' (got: ${cVision.primaryConcept})`);
  assert(Array.isArray(cVision.examples) && cVision.examples.length >= 2, `qVision examples parsed correctly (got: ${JSON.stringify(cVision.examples)})`);

  const qWeakness = "Have you noticed any weakness, such as difficulty lifting your arm?";
  const cWeakness = clinicalCaseService.extractPrimaryClinicalConcept(qWeakness);
  assert(cWeakness.type === 'single_concept_with_examples', `qWeakness type is single_concept_with_examples (got: ${cWeakness.type})`);
  assert(cWeakness.primaryConcept === 'weakness', `qWeakness primaryConcept is 'weakness' (got: ${cWeakness.primaryConcept})`);

  // B. True multi-concept questions
  const qMulti1 = "Do you have dizziness, vomiting, weakness, or chest pain?";
  const cMulti1 = clinicalCaseService.extractPrimaryClinicalConcept(qMulti1);
  assert(cMulti1.type === 'multiple_independent_concepts', `qMulti1 type is multiple_independent_concepts (got: ${cMulti1.type})`);

  const qMulti2 = "Have you experienced weakness, numbness, or changes in your vision?";
  const cMulti2 = clinicalCaseService.extractPrimaryClinicalConcept(qMulti2);
  assert(cMulti2.type === 'multiple_independent_concepts', `qMulti2 type is multiple_independent_concepts (got: ${cMulti2.type})`);

  const qMulti3 = "Do you have dizziness or vomiting?";
  const cMulti3 = clinicalCaseService.extractPrimaryClinicalConcept(qMulti3);
  assert(cMulti3.type === 'multiple_independent_concepts', `qMulti3 type is multiple_independent_concepts (got: ${cMulti3.type})`);

  // C. Generic & Operational
  const qGeneric = "Are you experiencing any other symptoms?";
  const cGeneric = clinicalCaseService.extractPrimaryClinicalConcept(qGeneric);
  assert(cGeneric.type === 'generic', `qGeneric type is generic (got: ${cGeneric.type})`);

  const qSeverity = "How severe is your overall discomfort: mild, moderate, or severe?";
  const cSeverity = clinicalCaseService.extractPrimaryClinicalConcept(qSeverity);
  assert(cSeverity.type === 'severity', `qSeverity type is severity (got: ${cSeverity.type})`);

  const qDuration = "How long have you been experiencing these symptoms?";
  const cDuration = clinicalCaseService.extractPrimaryClinicalConcept(qDuration);
  assert(cDuration.type === 'duration', `qDuration type is duration (got: ${cDuration.type})`);

  // D. Validator Check with Headache Active Case
  const headacheInitialCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [
      "I have had a left-sided throbbing headache for 3 days. Bright light and loud sounds make it worse. I feel nauseous but I do not have fever."
    ],
  });

  const valVision = geminiConversationService.validateFollowUpQuestion({
    question: qVision,
    canonicalCase: headacheInitialCase,
    previousQuestions: [],
    previousAnswers: [],
  });
  assert(valVision.accepted === true, `qVision accepted by validator (got: accepted=${valVision.accepted}, reason=${valVision.reason})`);

  const valMulti = geminiConversationService.validateFollowUpQuestion({
    question: qMulti1,
    canonicalCase: headacheInitialCase,
    previousQuestions: [],
    previousAnswers: [],
  });
  assert(valMulti.accepted === false && valMulti.reason === 'ambiguous_multi_concept_question',
    `qMulti1 rejected by validator with ambiguous_multi_concept_question (got: accepted=${valMulti.accepted}, reason=${valMulti.reason})`);

  const valMulti2 = geminiConversationService.validateFollowUpQuestion({
    question: qMulti2,
    canonicalCase: headacheInitialCase,
    previousQuestions: [],
    previousAnswers: [],
  });
  assert(valMulti2.accepted === false && valMulti2.reason === 'ambiguous_multi_concept_question',
    `qMulti2 rejected by validator with ambiguous_multi_concept_question (got: accepted=${valMulti2.accepted}, reason=${valMulti2.reason})`);

  console.log('\n--- 2. TEST CASE A — HEADACHE CASE ---');
  // Initial statement
  console.log('Initial Case Positives:', headacheInitialCase.positiveSymptoms);
  console.log('Initial Case Negatives:', headacheInitialCase.negativeFindings);
  console.log('Initial Case Duration:', headacheInitialCase.duration);

  assert(headacheInitialCase.positiveSymptoms.some(s => s.includes('headache')), 'Positive includes headache');
  assert(headacheInitialCase.positiveSymptoms.some(s => s.includes('light') || s.includes('photophobia')), 'Positive includes light sensitivity');
  assert(headacheInitialCase.positiveSymptoms.some(s => s.includes('nausea')), 'Positive includes nausea');
  assert(headacheInitialCase.negativeFindings.includes('no fever'), 'Negative includes no fever');
  assert(headacheInitialCase.duration === '3 days', `Duration is 3 days (got: ${headacheInitialCase.duration})`);

  // Candidate: "Have you noticed any changes in your vision, such as blurriness or seeing spots?"
  // Answer: "Yes"
  const turnA = [
    { question: qVision, answer: "Yes" }
  ];
  const caseAfterA = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [
      "I have had a left-sided throbbing headache for 3 days. Bright light and loud sounds make it worse. I feel nauseous but I do not have fever."
    ],
    conversation: turnA,
  });
  console.log('Positives after "Yes":', caseAfterA.positiveSymptoms);
  assert(caseAfterA.positiveSymptoms.includes('vision changes'), `Positives contains 'vision changes' (got: ${JSON.stringify(caseAfterA.positiveSymptoms)})`);
  assert(!caseAfterA.positiveSymptoms.includes('blurriness'), `Positives does NOT invent unstated 'blurriness'`);
  assert(!caseAfterA.positiveSymptoms.includes('seeing spots'), `Positives does NOT invent unstated 'seeing spots'`);

  console.log('\n--- 3. TEST CASE B — NEGATIVE YES/NO ---');
  const turnB = [
    { question: "Have you experienced vomiting?", answer: "No" }
  ];
  const caseAfterB = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["headache"],
    conversation: turnB,
  });
  console.log('Negatives after "No":', caseAfterB.negativeFindings);
  assert(caseAfterB.negativeFindings.includes('no vomiting'), `Negative findings includes 'no vomiting' (got: ${JSON.stringify(caseAfterB.negativeFindings)})`);

  console.log('\n--- 4. TEST CASE C — SPECIFIC ANSWER ---');
  const turnC = [
    { question: qVision, answer: "Yes, my vision becomes blurry" }
  ];
  const caseAfterC = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["headache"],
    conversation: turnC,
  });
  console.log('Positives after specific answer:', caseAfterC.positiveSymptoms);
  assert(caseAfterC.positiveSymptoms.includes('blurred vision'), `Positives includes canonical 'blurred vision' (got: ${JSON.stringify(caseAfterC.positiveSymptoms)})`);
  assert(!caseAfterC.positiveSymptoms.includes('vision changes'), `Generic 'vision changes' is subsumed by specific 'blurred vision'`);

  console.log('\n--- 5. TEST CASE D — MULTI-CONCEPT SAFETY ---');
  const turnD = [
    { question: "Have you experienced dizziness, vomiting, or weakness?", answer: "Yes" }
  ];
  const caseAfterD = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["headache"],
    conversation: turnD,
  });
  console.log('Positives after ambiguous Yes to multi-concept:', caseAfterD.positiveSymptoms);
  assert(!caseAfterD.positiveSymptoms.includes('dizziness'), `Ambiguous Yes did not derive 'dizziness'`);
  assert(!caseAfterD.positiveSymptoms.includes('vomiting'), `Ambiguous Yes did not derive 'vomiting'`);
  assert(!caseAfterD.positiveSymptoms.includes('weakness'), `Ambiguous Yes did not derive 'weakness'`);

  console.log('\n--- 6. TEST CASE E — GENERIC SAFETY ---');
  const turnE1 = [
    { question: "Are you experiencing any other symptoms?", answer: "Yes" }
  ];
  const caseAfterE1 = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["headache"],
    conversation: turnE1,
  });
  assert(!caseAfterE1.positiveSymptoms.includes('other symptoms'), `Generic Yes did not derive 'other symptoms'`);

  const turnE2 = [
    { question: "Are you experiencing any other symptoms?", answer: "Yes, I feel dizzy" }
  ];
  const caseAfterE2 = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["headache"],
    conversation: turnE2,
  });
  console.log('Positives after "Yes, I feel dizzy":', caseAfterE2.positiveSymptoms);
  assert(caseAfterE2.positiveSymptoms.includes('dizziness'), `Specific symptom 'dizziness' named in answer is extracted`);

  console.log('\n--- 7. TEST CASE F — FALLBACK RELEVANCE ---');
  const fallbackResult = geminiConversationService.getValidatedDeterministicFallback(
    ["I have had a left-sided throbbing headache for 3 days. Bright light and loud sounds make it worse. I feel nauseous but I do not have fever."],
    [],
    0,
    headacheInitialCase,
    [],
    []
  );
  console.log('Deterministic Fallback Question:', fallbackResult.question);
  const qLower = fallbackResult.question.toLowerCase();
  const isRelevant = qLower.includes('vision') || qLower.includes('vomit') || qLower.includes('dizzy') || qLower.includes('stiff') || qLower.includes('weakness');
  const isIrrelevant = qLower.includes('bowel') || qLower.includes('bloat') || qLower.includes('urin');
  assert(isRelevant, `Fallback question is relevant to neurological/headache domain: "${fallbackResult.question}"`);
  assert(!isIrrelevant, `Fallback question did NOT ask about bowel movements, bloating, or urination`);

  console.log('\n--- 8. REGRESSIONS ---');
  // A. Severity extraction
  const turnSev = [
    { question: "How severe is your overall discomfort: mild, moderate, or severe?", answer: "Moderate" }
  ];
  const caseSev = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ["headache"],
    conversation: turnSev,
  });
  assert(caseSev.severity === 'moderate', `Severity extracted as 'moderate' (got: ${caseSev.severity})`);
  assert(!caseSev.positiveSymptoms.includes('moderate'), `'moderate' was not stored as a symptom`);

  // B. Negation conflict resolution
  const conflictCase = clinicalCaseService.reconcilePositiveAndNegativeEvidence({
    positiveSymptoms: ['blurred vision', 'headache'],
    negativeFindings: ['no vision changes'],
    context: [],
    additionalDetails: [],
  });
  assert(!conflictCase.positiveSymptoms.includes('blurred vision'), `Positive 'blurred vision' removed when 'no vision changes' is asserted`);

  console.log('\n====================================================');
  console.log('ALL STEP 35X TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('====================================================');
}

runStep35XTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
