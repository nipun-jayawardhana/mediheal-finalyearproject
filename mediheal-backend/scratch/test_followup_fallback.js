require('dotenv').config();
const assert = require('assert');
const geminiConversationService = require('../src/services/geminiConversationService');

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING FOLLOW-UP AI FALLBACK INTEGRATION TESTS');
  console.log('====================================================\n');

  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGroqKey = process.env.GROQ_API_KEY;

  // ----------------------------------------------------------------
  // Test 1: Normal Gemini
  // ----------------------------------------------------------------
  console.log('--- TEST 1: Normal Gemini ---');
  try {
    const res1 = await geminiConversationService.generateFollowUp(
      ['knee pain', 'swelling'],
      [],
      0
    );
    console.log('Test 1 Result status:', res1?.status);
    console.log('Test 1 Question:', res1?.question);
    assert(res1 && (res1.status === 'ask' || res1.status === 'complete'), 'Test 1 should return ask or complete');
    assert(res1.question || res1.summary, 'Test 1 should have question or summary');
    console.log('✅ TEST 1 PASSED: Gemini operational\n');
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
  }

  // ----------------------------------------------------------------
  // Test 2: Force Gemini failure -> Groq Qwen2.5 backup
  // ----------------------------------------------------------------
  console.log('--- TEST 2: Force Gemini Failure -> Groq Qwen2.5 Backup ---');
  try {
    process.env.GEMINI_API_KEY = 'invalid_gemini_key_for_testing_12345';
    const res2 = await geminiConversationService.generateFollowUp(
      ['severe headache', 'sensitivity to light'],
      [],
      0
    );
    console.log('Test 2 Result status:', res2?.status);
    console.log('Test 2 Question:', res2?.question);
    console.log('Test 2 Concept:', res2?.concept);
    console.log('Test 2 Quick options:', res2?.quickOptions);
    assert(res2 && res2.status === 'ask', 'Test 2 should return ask status');
    assert(typeof res2.question === 'string' && res2.question.length > 0, 'Test 2 should return a question');
    assert(Array.isArray(res2.quickOptions) && res2.quickOptions.length > 0, 'Test 2 should have quickOptions');
    console.log('✅ TEST 2 PASSED: Groq Qwen2.5 took over successfully\n');
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
  } finally {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }

  // ----------------------------------------------------------------
  // Test 3: Both unavailable -> Deterministic Fallback
  // ----------------------------------------------------------------
  console.log('--- TEST 3: Both Gemini & Groq Unavailable -> Deterministic Fallback ---');
  try {
    process.env.GEMINI_API_KEY = 'invalid_gemini_key_for_testing_12345';
    process.env.GROQ_API_KEY = 'invalid_groq_key_for_testing_12345';
    const res3 = await geminiConversationService.generateFollowUp(
      ['cough', 'fever'],
      [],
      0
    );
    console.log('Test 3 Result status:', res3?.status);
    console.log('Test 3 Question:', res3?.question);
    console.log('Test 3 Quick options:', res3?.quickOptions);
    assert(res3 && res3.status === 'ask', 'Test 3 should return ask status');
    assert(typeof res3.question === 'string' && res3.question.length > 0, 'Test 3 should return a question');
    console.log('✅ TEST 3 PASSED: Deterministic fallback took over safely\n');
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
  } finally {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.GROQ_API_KEY = originalGroqKey;
  }

  // ----------------------------------------------------------------
  // Test 4: Verify groqFollowupService direct interface
  // ----------------------------------------------------------------
  console.log('--- TEST 4: Direct groqFollowupService Interface ---');
  const groqFollowupService = require('../src/services/groqFollowupService');
  try {
    const res4 = await groqFollowupService.generateFollowUpQuestion({
      symptoms: ['stomach ache', 'nausea'],
      canonicalCase: null,
      previousQuestions: [],
      language: 'en',
      questionCount: 0
    });
    console.log('Test 4 Result:', res4);
    assert(typeof res4.question === 'string', 'Should return question');
    assert(typeof res4.concept === 'string', 'Should return concept');
    assert(Array.isArray(res4.quickOptions), 'Should return quickOptions');
    console.log('✅ TEST 4 PASSED: groqFollowupService signature matches specification\n');
  } catch (err) {
    console.error('❌ TEST 4 FAILED:', err.message);
  }

  console.log('====================================================');
  console.log('ALL TEST SUITE CASES COMPLETED');
  console.log('====================================================');
}

runTestSuite().catch(console.error);
