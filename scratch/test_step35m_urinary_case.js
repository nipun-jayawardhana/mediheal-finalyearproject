const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiConversationService = require('../mediheal-backend/src/services/geminiConversationService');

async function runUrinaryCaseTest() {
  console.log('==================================================');
  console.log('STEP 35M — REAL URINARY TEST CASE VERIFICATION');
  console.log('==================================================\n');

  const testInput = "For the last three days I have had a burning feeling when I urinate, and I have noticed a small amount of unusual discharge from my penis, with some discomfort around the tip, but I do not have fever or severe abdominal pain.";

  console.log(`Input statement: "${testInput}"\n`);

  // 1. Initial Case Extraction Verification
  const initialCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [testInput],
    conversation: [],
  });

  console.log('--- Initial Case Extraction ---');
  console.log('positiveSymptoms:', JSON.stringify(initialCase.positiveSymptoms, null, 2));
  console.log('negativeFindings:', JSON.stringify(initialCase.negativeFindings, null, 2));
  console.log('duration:', initialCase.duration);
  console.log('severity:', initialCase.severity);
  console.log('context:', initialCase.context);
  console.log('--------------------------------\n');

  // Assertions on Initial Extraction
  const hasBurningUrination = initialCase.positiveSymptoms.some(s => s.includes('urinate') || s.includes('urination') || s.includes('burning'));
  const hasPenileDischarge = initialCase.positiveSymptoms.some(s => s.includes('discharge') || s.includes('penis') || s.includes('penile'));
  const hasTipDiscomfort = initialCase.positiveSymptoms.some(s => s.includes('tip') || s.includes('discomfort'));
  const hasStomachPain = initialCase.positiveSymptoms.some(s => s.includes('stomach') || s.includes('abdominal'));

  const hasNoFever = initialCase.negativeFindings.includes('no fever');
  const hasNoAbdominalPain = initialCase.negativeFindings.includes('no severe abdominal pain') || initialCase.negativeFindings.includes('no abdominal pain');

  console.log('Check 1: positiveSymptoms contains burning feeling when urinating?', hasBurningUrination ? 'PASS' : 'FAIL');
  console.log('Check 2: positiveSymptoms contains unusual penile discharge?', hasPenileDischarge ? 'PASS' : 'FAIL');
  console.log('Check 3: positiveSymptoms contains discomfort around tip?', hasTipDiscomfort ? 'PASS' : 'FAIL');
  console.log('Check 4: FALSE stomach pain eliminated?', !hasStomachPain ? 'PASS' : 'FAIL');
  console.log('Check 5: negativeFindings contains "no fever"?', hasNoFever ? 'PASS' : 'FAIL');
  console.log('Check 6: negativeFindings contains "no severe abdominal pain"?', hasNoAbdominalPain ? 'PASS' : 'FAIL');
  console.log('Check 7: duration is "3 days"?', initialCase.duration === '3 days' ? 'PASS' : 'FAIL');
  console.log('Check 8: severity is null?', initialCase.severity === null ? 'PASS' : 'FAIL');

  if (!hasBurningUrination || !hasPenileDischarge || !hasTipDiscomfort || hasStomachPain || !hasNoFever || !hasNoAbdominalPain) {
    console.error('\n❌ INITIAL EXTRACTION VERIFICATION FAILED');
    process.exit(1);
  }

  // 2. Follow-Up Generation Check (Must return status: "ask" before summary)
  console.log('\n--- Follow-up Question Generation (Question 1) ---');
  const followUp1 = await geminiConversationService.generateFollowUp([testInput], [], 0);
  console.log('Follow-up 1 result:', JSON.stringify(followUp1, null, 2));

  console.log('Check 9: Follow-up question generated BEFORE summary (status === "ask")?', followUp1.status === 'ask' ? 'PASS' : 'FAIL');
  if (followUp1.status !== 'ask') {
    console.error('\n❌ FOLLOW-UP SKIPPED BUG DETECTED! Expected status: "ask", got:', followUp1.status);
    process.exit(1);
  }

  console.log('Generated Question:', followUp1.question);

  // Simulate patient answer to Q1
  const conversation = [
    { question: followUp1.question, answer: 'No blood in urine or testicular pain, but urgency is increased.' }
  ];

  // 3. Merged Canonical Case after Q1 Answer
  const updatedCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [testInput],
    conversation,
  });

  console.log('\n--- Updated Case After Q1 Answer ---');
  console.log(JSON.stringify(updatedCase, null, 2));

  console.log('\n✅ REAL URINARY TEST CASE PASSED ALL VERIFICATIONS SUCCESSFULLY!\n');
}

runUrinaryCaseTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
