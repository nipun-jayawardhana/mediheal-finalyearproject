const symptomController = require('../mediheal-backend/src/controllers/symptomController');
const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');

async function testE2EPipeline() {
  console.log('==================================================');
  console.log('STEP 35M — FULL API PIPELINE E2E VERIFICATION');
  console.log('==================================================\n');

  const testInput = ["For the last three days I have had a burning feeling when I urinate, and I have noticed a small amount of unusual discharge from my penis, with some discomfort around the tip, but I do not have fever or severe abdominal pain."];

  // 1. Test handleFollowUp (Q0 -> Q1)
  console.log('--- Calling handleFollowUp (Q0) ---');
  let req = {
    body: {
      symptoms: testInput,
      conversation: [],
      questionCount: 0,
      language: 'en',
    }
  };

  let resData = {};
  let res = {
    status: (code) => ({
      json: (data) => {
        resData = data;
        return data;
      }
    })
  };

  await symptomController.handleFollowUp(req, res, (err) => { if (err) console.error(err); });

  console.log('Follow-Up Q0 Response:', JSON.stringify(resData, null, 2));
  if (!resData.success || resData.data.status !== 'ask') {
    console.error('❌ E2E Failed: handleFollowUp Q0 did not return status: "ask"');
    process.exit(1);
  }

  // 2. Test handleFollowUp (Q1 Answer -> Q2)
  console.log('\n--- Calling handleFollowUp (Q1 Answer -> Q2) ---');
  const convQ1 = [
    { question: resData.data.question, answer: 'No blood in urine or testicular pain' }
  ];

  req.body.conversation = convQ1;
  req.body.questionCount = 1;

  await symptomController.handleFollowUp(req, res, (err) => { if (err) console.error(err); });
  console.log('Follow-Up Q1 Response:', JSON.stringify(resData, null, 2));

  // 3. Test handleFollowUp (Max Questions 3 -> Summary)
  console.log('\n--- Calling handleFollowUp (Q3 -> Summary) ---');
  const convQ3 = [
    { question: 'How long have you had these symptoms?', answer: '3 days' },
    { question: 'How severe is your discomfort?', answer: 'moderate' },
    { question: 'Have you noticed any urinary frequency or blood?', answer: 'No' },
  ];

  req.body.conversation = convQ3;
  req.body.questionCount = 3;

  await symptomController.handleFollowUp(req, res, (err) => { if (err) console.error(err); });
  console.log('Follow-Up Q3 Summary Response:', JSON.stringify(resData, null, 2));

  if (!resData.success || resData.data.status !== 'complete') {
    console.error('❌ E2E Failed: handleFollowUp Q3 did not return status: "complete"');
    process.exit(1);
  }

  const summaryCanonicalCase = resData.data.summary;
  console.log('\nSummary Canonical Case:', JSON.stringify(summaryCanonicalCase, null, 2));

  // 4. Test Canonical Case equality between Summary and OpenBioLLM payload
  const openBioCanonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: testInput,
    conversation: convQ3,
    duration: summaryCanonicalCase.duration,
    severity: summaryCanonicalCase.severity,
    positiveSymptoms: summaryCanonicalCase.positiveSymptoms,
    negativeFindings: summaryCanonicalCase.negativeFindings,
    context: summaryCanonicalCase.context,
    additionalDetails: summaryCanonicalCase.additionalDetails,
  });

  console.log('\nOpenBioLLM Canonical Case:', JSON.stringify(openBioCanonicalCase, null, 2));

  const isPosEqual = JSON.stringify(summaryCanonicalCase.positiveSymptoms) === JSON.stringify(openBioCanonicalCase.positiveSymptoms);
  const isNegEqual = JSON.stringify(summaryCanonicalCase.negativeFindings) === JSON.stringify(openBioCanonicalCase.negativeFindings);
  const isDurEqual = summaryCanonicalCase.duration === openBioCanonicalCase.duration;

  console.log('\nCheck: Summary positiveSymptoms === OpenBioLLM positiveSymptoms?', isPosEqual ? 'PASS ✅' : 'FAIL ❌');
  console.log('Check: Summary negativeFindings === OpenBioLLM negativeFindings?', isNegEqual ? 'PASS ✅' : 'FAIL ❌');
  console.log('Check: Summary duration === OpenBioLLM duration?', isDurEqual ? 'PASS ✅' : 'FAIL ❌');

  if (!isPosEqual || !isNegEqual || !isDurEqual) {
    console.error('\n❌ CANONICAL CASE EQUALITY CHECK FAILED');
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('✅ ALL E2E PIPELINE VERIFICATIONS PASSED');
  console.log('==================================================\n');
}

testE2EPipeline().catch((err) => {
  console.error('E2E execution error:', err);
  process.exit(1);
});
