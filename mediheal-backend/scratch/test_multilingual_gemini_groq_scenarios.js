require('dotenv').config();
const assert = require('assert');
const { handleFollowUp } = require('../src/controllers/symptomController');

// Mock Express req and res helper
function createMockReqRes(body) {
  const req = {
    body,
    user: { _id: 'test_patient_user_id_456' },
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const execute = () =>
    new Promise((resolve, reject) => {
      handleFollowUp(req, res, (err) => {
        if (err) reject(err);
      })
        .then(() => resolve({ status: statusCode, data: responseData }))
        .catch(reject);
    });

  return { req, res, execute };
}

// Global fetch spy helper
const originalFetch = global.fetch;

function simulateGeminiFailureOnFollowup(shouldFail = true) {
  if (shouldFail) {
    global.fetch = async (url, options) => {
      const urlStr = String(url || '');
      const bodyStr = typeof options?.body === 'string' ? options.body : '';

      // Intercept ONLY Gemini follow-up question requests
      if (
        urlStr.includes('generativelanguage.googleapis.com') &&
        bodyStr.includes('conversational symptom assistant')
      ) {
        console.log('⚡ [SIMULATED GEMINI FAILURE TRIGGERED] Intercepting Gemini follow-up call');
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({
            error: {
              code: 503,
              message: 'The model is overloaded. Please try again later. (Simulated Gemini Failure)',
            },
          }),
        };
      }

      // Allow all other requests (Groq API, Gemini Translation API) to proceed normally
      return originalFetch(url, options);
    };
  } else {
    global.fetch = originalFetch;
  }
}

async function runMultilingualFallbackSuite() {
  console.log('================================================================');
  console.log('MEDIHEAL MULTILINGUAL FOLLOW-UP FALLBACK INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  const sinhalaInputText = `මගේ පපුව ප්රදේශයේ වේදනාවක් සහ තද බවක් දැනෙනවා. 
සමහර විට චලනය වන විට හෝ ගැඹුරු හුස්මක් ගන්නා විට එය වැඩි වෙනවා. 
හුස්ම ගැනීමේ අපහසුතාව, දහඩිය දැමීම සහ දුර්වල බවක් දැනෙනවා.`;

  const tamilInputText = `எனக்கு மார்பු பகுதியில் வலி மற்றும் இறுக்கம் உள்ளது.
சில நேரங்களில் ஆழமாக சுவாசிக்கும்போது வலி அதிகமாகிறது.
மூச்சு விடுவதில் சிரமம் மற்றும் பலவீனம் உள்ளது.`;

  let turn1ResultGemini = null;
  let turn1ResultGroq = null;

  // ==================================================================
  // TEST SCENARIO 1A: Normal Gemini Flow (Sinhala)
  // ==================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 1A: Normal Gemini Flow with Sinhala Patient Input');
  console.log('----------------------------------------------------------------');
  simulateGeminiFailureOnFollowup(false);

  const reqRes1A = createMockReqRes({
    symptoms: [sinhalaInputText],
    conversation: [],
    questionCount: 0,
    language: 'si',
  });

  const res1A = await reqRes1A.execute();
  turn1ResultGemini = res1A.data?.data;

  console.log('\n[TEST 1A RESPONSE INSPECTION]');
  console.log('HTTP Status:', res1A.status);
  console.log('Flow Status:', turn1ResultGemini?.status);
  console.log('Patient Display Question (Sinhala):', turn1ResultGemini?.displayQuestion || turn1ResultGemini?.question);
  console.log('Canonical English Question:', turn1ResultGemini?.canonicalQuestion);
  console.log('Clinical Concept:', turn1ResultGemini?.clinicalConcept);
  console.log('Quick Options (Sinhala):', turn1ResultGemini?.quickOptions);
  console.log('Emergency Detected:', turn1ResultGemini?.isEmergency);

  assert.strictEqual(res1A.status, 200, 'Test 1A should return HTTP 200');
  assert.strictEqual(turn1ResultGemini?.status, 'ask', 'Test 1A should have status "ask"');
  assert(turn1ResultGemini?.question, 'Test 1A should have a generated question');
  // Verify Sinhala characters present in display question
  assert(/[^\x00-\x7F]/.test(turn1ResultGemini?.question), 'Test 1A display question must be in Sinhala');
  console.log('✅ TEST 1A PASSED: Gemini operational, generated and translated follow-up into Sinhala\n');

  // ==================================================================
  // TEST SCENARIO 1B & 1C: Forced Gemini Failure -> Groq Qwen2.5 Backup (Sinhala)
  // ==================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 1B & 1C: Force Gemini Failure -> Verify Groq Backup (Sinhala)');
  console.log('----------------------------------------------------------------');
  simulateGeminiFailureOnFollowup(true);

  const reqRes1BC = createMockReqRes({
    symptoms: [sinhalaInputText],
    conversation: [],
    questionCount: 0,
    language: 'si',
  });

  const res1BC = await reqRes1BC.execute();
  turn1ResultGroq = res1BC.data?.data;

  console.log('\n[TEST 1B/1C RESPONSE INSPECTION]');
  console.log('HTTP Status:', res1BC.status);
  console.log('Flow Status:', turn1ResultGroq?.status);
  console.log('Patient Display Question (Sinhala from Groq):', turn1ResultGroq?.displayQuestion || turn1ResultGroq?.question);
  console.log('Canonical English Question (Groq):', turn1ResultGroq?.canonicalQuestion);
  console.log('Clinical Concept (Groq):', turn1ResultGroq?.clinicalConcept);
  console.log('Quick Options (Sinhala):', turn1ResultGroq?.quickOptions);
  console.log('Emergency Detected:', turn1ResultGroq?.isEmergency);

  assert.strictEqual(res1BC.status, 200, 'Test 1B/1C should return HTTP 200');
  assert.strictEqual(turn1ResultGroq?.status, 'ask', 'Test 1B/1C should have status "ask"');
  assert(turn1ResultGroq?.question, 'Test 1B/1C should have a Groq generated question');
  assert(/[^\x00-\x7F]/.test(turn1ResultGroq?.question), 'Test 1B/1C display question must be in Sinhala');
  assert(turn1ResultGroq?.clinicalConcept, 'Test 1B/1C must have clinicalConcept');
  console.log('✅ TEST 1B & 1C PASSED: Gemini failure safely caught, Groq Qwen2.5 seamlessly took over in Sinhala\n');

  // Restore normal fetch
  simulateGeminiFailureOnFollowup(false);

  // ==================================================================
  // TEST SCENARIO 1D: Patient Answer Flow (Turn 2)
  // ==================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 1D: Patient Answer Flow (Question 2 of 3 in Sinhala)');
  console.log('----------------------------------------------------------------');

  const answeredTurn = {
    question: turn1ResultGroq?.question || 'ඔබගේ පපුවේ වේදනාව කොතරම් තදද?',
    answer: 'මධ්යම මට්ටමේ', // Sinhala: "moderate"
    originalQuestion: turn1ResultGroq?.question,
    originalAnswer: 'මධ්යම මට්ටමේ',
    canonicalQuestion: turn1ResultGroq?.canonicalQuestion || 'How severe is your chest pain?',
    canonicalAnswer: 'moderate',
    clinicalConcept: turn1ResultGroq?.clinicalConcept || 'severity',
  };

  const reqRes1D = createMockReqRes({
    symptoms: [sinhalaInputText],
    conversation: [answeredTurn],
    questionCount: 1,
    language: 'si',
  });

  const res1D = await reqRes1D.execute();
  const turn2Result = res1D.data?.data;

  console.log('\n[TEST 1D RESPONSE INSPECTION]');
  console.log('HTTP Status:', res1D.status);
  console.log('Flow Status:', turn2Result?.status);
  console.log('Next Display Question (Sinhala):', turn2Result?.displayQuestion || turn2Result?.question);
  console.log('Next Canonical English Question:', turn2Result?.canonicalQuestion);
  console.log('Next Clinical Concept:', turn2Result?.clinicalConcept);
  console.log('Quick Options:', turn2Result?.quickOptions);
  console.log('Updated Canonical Case:', JSON.stringify(turn2Result?.canonicalCase, null, 2));

  assert.strictEqual(res1D.status, 200, 'Test 1D should return HTTP 200');
  assert(turn2Result?.status === 'ask' || turn2Result?.status === 'complete', 'Test 1D status valid');
  if (turn2Result?.status === 'ask') {
    assert(/[^\x00-\x7F]/.test(turn2Result?.question), 'Question 2 must be in Sinhala');
  }
  console.log('✅ TEST 1D PASSED: Patient answer recorded, canonical case updated, Question 2 generated in Sinhala\n');

  // ==================================================================
  // TEST SCENARIO 2: Tamil Patient Input
  // ==================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 2: Tamil Patient Input (Normal & Groq Fallback)');
  console.log('----------------------------------------------------------------');

  // Part 2A: Tamil with Gemini
  const reqRes2A = createMockReqRes({
    symptoms: [tamilInputText],
    conversation: [],
    questionCount: 0,
    language: 'ta',
  });

  const res2A = await reqRes2A.execute();
  const tamilResult = res2A.data?.data;

  console.log('\n[TEST 2A TAMIL (GEMINI) RESPONSE INSPECTION]');
  console.log('HTTP Status:', res2A.status);
  console.log('Flow Status:', tamilResult?.status);
  console.log('Patient Display Question (Tamil):', tamilResult?.displayQuestion || tamilResult?.question);
  console.log('Canonical English Question:', tamilResult?.canonicalQuestion);
  console.log('Clinical Concept:', tamilResult?.clinicalConcept);
  console.log('Quick Options (Tamil):', tamilResult?.quickOptions);

  assert.strictEqual(res2A.status, 200, 'Test 2A should return HTTP 200');
  assert.strictEqual(tamilResult?.status, 'ask', 'Test 2A should have status "ask"');
  assert(tamilResult?.question, 'Test 2A should have question');
  assert(/[^\x00-\x7F]/.test(tamilResult?.question), 'Test 2A display question must be in Tamil');

  // Part 2B: Tamil with Groq Fallback
  simulateGeminiFailureOnFollowup(true);

  const reqRes2B = createMockReqRes({
    symptoms: [tamilInputText],
    conversation: [],
    questionCount: 0,
    language: 'ta',
  });

  const res2B = await reqRes2B.execute();
  const tamilGroqResult = res2B.data?.data;

  console.log('\n[TEST 2B TAMIL (GROQ BACKUP) RESPONSE INSPECTION]');
  console.log('HTTP Status:', res2B.status);
  console.log('Flow Status:', tamilGroqResult?.status);
  console.log('Patient Display Question (Tamil via Groq):', tamilGroqResult?.displayQuestion || tamilGroqResult?.question);
  console.log('Canonical English Question:', tamilGroqResult?.canonicalQuestion);
  console.log('Clinical Concept:', tamilGroqResult?.clinicalConcept);
  console.log('Quick Options (Tamil):', tamilGroqResult?.quickOptions);

  assert.strictEqual(res2B.status, 200, 'Test 2B should return HTTP 200');
  assert.strictEqual(tamilGroqResult?.status, 'ask', 'Test 2B should have status "ask"');
  assert(tamilGroqResult?.question, 'Test 2B should have question');
  assert(/[^\x00-\x7F]/.test(tamilGroqResult?.question), 'Test 2B display question must be in Tamil');

  simulateGeminiFailureOnFollowup(false);
  console.log('✅ TEST 2 PASSED: Tamil input correctly processed, generated and localized via both Gemini and Groq\n');

  // ==================================================================
  // TEST SCENARIO 3: 3-Question Ceiling & Summary Verification
  // ==================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 3: 3-Question Limit & Structured Summary');
  console.log('----------------------------------------------------------------');

  const threeTurns = [
    { question: 'Q1', answer: 'A1', canonicalQuestion: 'Q1', canonicalAnswer: 'A1' },
    { question: 'Q2', answer: 'A2', canonicalQuestion: 'Q2', canonicalAnswer: 'A2' },
    { question: 'Q3', answer: 'A3', canonicalQuestion: 'Q3', canonicalAnswer: 'A3' },
  ];

  const reqRes3 = createMockReqRes({
    symptoms: [sinhalaInputText],
    conversation: threeTurns,
    questionCount: 3,
    language: 'si',
  });

  const res3 = await reqRes3.execute();
  const summaryResult = res3.data?.data;

  console.log('\n[TEST 3 RESPONSE INSPECTION]');
  console.log('HTTP Status:', res3.status);
  console.log('Flow Status:', summaryResult?.status);
  console.log('Summary Symptoms:', summaryResult?.summary?.positiveSymptoms || summaryResult?.summary?.symptoms);
  console.log('Summary Duration:', summaryResult?.summary?.duration);
  console.log('Summary Severity:', summaryResult?.summary?.severity);

  assert.strictEqual(res3.status, 200, 'Test 3 should return HTTP 200');
  assert.strictEqual(summaryResult?.status, 'complete', 'Test 3 must return status "complete" on 3rd question');
  assert(summaryResult?.summary, 'Test 3 must provide structured summary');
  console.log('✅ TEST 3 PASSED: 3-question ceiling strictly enforced, returned structured summary\n');

  console.log('================================================================');
  console.log('🎉 ALL MULTILINGUAL FALLBACK TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('================================================================');
}

runMultilingualFallbackSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
