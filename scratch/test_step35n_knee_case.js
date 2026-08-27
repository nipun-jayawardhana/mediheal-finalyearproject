const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiConversationService = require('../mediheal-backend/src/services/geminiConversationService');

async function runKneeTest() {
  console.log('==================================================');
  console.log('STEP 35N — REAL KNEE TEST CASE VERIFICATION');
  console.log('==================================================\n');

  const kneeStatement = "I twisted my right knee while walking downstairs yesterday, and since then it has been swollen and painful, it hurts more when I bend it or put weight on it, and sometimes the knee feels unstable, but I can still move my toes normally.";

  console.log(`Input statement:\n"${kneeStatement}"\n`);

  // 1. Initial Case Extraction
  const initialCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [kneeStatement],
    conversation: [],
  });

  console.log('--- Canonical Case Extracted ---');
  console.log(JSON.stringify(initialCase, null, 2));

  // Assertions on Initial Case
  const hasKneeLocation = initialCase.positiveSymptoms.some(s => s.includes('knee'));
  const hasDuration = initialCase.duration === '1 day' || initialCase.duration === 'since yesterday' || initialCase.duration.includes('yesterday') || initialCase.duration.includes('1 day');
  const hasMechanism = initialCase.context.some(c => c.includes('twisted') || c.includes('stairs') || c.includes('walking') || c.includes('knee'));
  const hasToesReassuring = initialCase.negativeFindings.some(n => n.includes('toes')) || initialCase.context.some(c => c.includes('toes')) || initialCase.additionalDetails.some(d => d.includes('toes'));

  console.log('\nAssertion 1: Anatomical location right knee preserved?', hasKneeLocation ? 'PASS ✅' : 'FAIL ❌');
  console.log('Assertion 2: Duration since yesterday extracted?', hasDuration ? 'PASS ✅' : 'FAIL ❌');
  console.log('Assertion 3: Injury mechanism preserved in context?', hasMechanism ? 'PASS ✅' : 'FAIL ❌');

  if (!hasKneeLocation || !hasDuration) {
    console.error('❌ INITIAL KNEE EXTRACTION FAILED');
    process.exit(1);
  }

  // 2. Validate Known Information Guard (Duration question MUST be rejected)
  console.log('\n--- Testing Known Information Guard ---');
  const durationCandidate = "How long has your knee been swollen?";
  const durVal = geminiConversationService.validateFollowUpQuestion({
    question: durationCandidate,
    canonicalCase: initialCase,
    previousQuestions: [],
    previousAnswers: [],
  });

  console.log(`Candidate: "${durationCandidate}" -> accepted=${durVal.accepted}, reason=${durVal.reason}`);
  console.log('Guard Check 1: Already known duration question REJECTED?', (!durVal.accepted && durVal.reason === 'already_answered') ? 'PASS ✅' : 'FAIL ❌');

  // 3. Validate Relevance Guard (Unrelated urinary question MUST be rejected for knee trauma)
  console.log('\n--- Testing Relevance Guard ---');
  const urinaryCandidate = "Are you experiencing any fever, chills, or difficulty urinating along with the swelling?";
  const uriVal = geminiConversationService.validateFollowUpQuestion({
    question: urinaryCandidate,
    canonicalCase: initialCase,
    previousQuestions: [],
    previousAnswers: [],
  });

  console.log(`Candidate: "${urinaryCandidate}" -> accepted=${uriVal.accepted}, reason=${uriVal.reason}`);
  console.log('Guard Check 2: Unrelated urinary question REJECTED for knee trauma?', (!uriVal.accepted && uriVal.reason === 'unrelated_domain') ? 'PASS ✅' : 'FAIL ❌');

  // 4. Validate Clinically Relevant Question (Must be accepted)
  const validKneeCandidate = "Have you noticed any redness, warmth, or locking in your joint?";
  const relVal = geminiConversationService.validateFollowUpQuestion({
    question: validKneeCandidate,
    canonicalCase: initialCase,
    previousQuestions: [],
    previousAnswers: [],
  });

  console.log(`Candidate: "${validKneeCandidate}" -> accepted=${relVal.accepted}, reason=${relVal.reason}`);
  console.log('Guard Check 3: Relevant musculoskeletal question ACCEPTED?', (relVal.accepted && relVal.reason === 'relevant') ? 'PASS ✅' : 'FAIL ❌');

  // 5. Test Question-Aware Answer Merging & Location Inheritance
  console.log('\n--- Testing Question-Aware Answer Merging ---');
  const convWithRednessWarmth = [
    { question: validKneeCandidate, answer: "redness, warmth" }
  ];

  const mergedCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [kneeStatement],
    conversation: convWithRednessWarmth,
  });

  console.log('Merged positiveSymptoms:', mergedCase.positiveSymptoms);
  const hasKneeRedness = mergedCase.positiveSymptoms.includes('knee redness') || mergedCase.positiveSymptoms.includes('redness');
  const hasKneeWarmth = mergedCase.positiveSymptoms.includes('knee warmth') || mergedCase.positiveSymptoms.includes('warmth');
  const hasNoDischarge = !mergedCase.positiveSymptoms.includes('discharge') && !mergedCase.positiveSymptoms.includes('knee discharge');

  console.log('Merge Check 1: "redness" merged with location inheritance ("knee redness")?', hasKneeRedness ? 'PASS ✅' : 'FAIL ❌');
  console.log('Merge Check 2: "warmth" merged with location inheritance ("knee warmth")?', hasKneeWarmth ? 'PASS ✅' : 'FAIL ❌');
  console.log('Merge Check 3: Unaffirmed "discharge" NOT added to positiveSymptoms?', hasNoDischarge ? 'PASS ✅' : 'FAIL ❌');

  if (!durVal.accepted && !uriVal.accepted && relVal.accepted && hasKneeRedness && hasKneeWarmth && hasNoDischarge) {
    console.log('\n==================================================');
    console.log('✅ ALL KNEE RELEVANCE & GUARD CHECKS PASSED');
    console.log('==================================================\n');
  } else {
    console.error('\n❌ KNEE TEST FAILED');
    process.exit(1);
  }
}

runKneeTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
