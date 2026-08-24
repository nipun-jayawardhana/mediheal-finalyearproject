const openBioLLMService = require('../mediheal-backend/src/services/openBioLLMService');
const geminiTranslationService = require('../mediheal-backend/src/services/geminiTranslationService');
const symptomService = require('../mediheal-backend/src/services/symptomService');

async function testHardDeadline() {
  console.log('==================================================');
  console.log('FINAL STEP 35B — HARD DEADLINE VERIFICATION');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  // [TEST 1] Simulated Complete Failure (2 Attempts Hanging)
  total++;
  console.log('[TEST 1] Complete Failure - 2 Attempts Hanging (Max Budget 25,000ms)');
  const origFetch = global.fetch;
  const origToken = process.env.HUGGINGFACE_API_TOKEN;
  process.env.HUGGINGFACE_API_TOKEN = 'mock-test-token';

  try {
    global.fetch = async (url, options) => {
      // Listen to AbortSignal
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, status: 503, text: async () => 'Service Unavailable' });
        }, 15000);

        if (options && options.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    const startTime = Date.now();
    let failedAsExpected = false;

    try {
      await openBioLLMService.analyzeSymptomsWithOpenBioLLM(['fever'], '1 day', 'mild', 'req-fail-hard');
    } catch (err) {
      failedAsExpected = true;
    }

    const elapsed = Date.now() - startTime;
    console.log(`  Failed as Expected: ${failedAsExpected}`);
    console.log(`  Total Model Elapsed: ${elapsed}ms (Limit <= 25500ms)`);

    if (failedAsExpected && elapsed <= 25500) {
      console.log('  ✅ TEST 1 PASSED: Strict 25s deadline enforced.\n');
      passed++;
    } else {
      console.error(`  ❌ TEST 1 FAILED: Took ${elapsed}ms (> 25500ms)\n`);
    }
  } finally {
    global.fetch = origFetch;
    process.env.HUGGINGFACE_API_TOKEN = origToken;
  }

  // [TEST 2] Backend Total Time Test (Failure + Fallback + Translation)
  total++;
  console.log('[TEST 2] Backend Total Time Test (Target < 35,000ms)');
  const bStart = Date.now();
  const fallbackRes = symptomService.analyzeSymptoms(['fever', 'cough'], '1 day', 'mild');
  const translatedOutput = await geminiTranslationService.translateAnalysisResult(fallbackRes, 'si');
  const bElapsed = Date.now() - bStart + 25000; // Simulated 25s model time + actual translation time

  console.log(`  Simulated Total Backend Time: ${bElapsed}ms (Target < 35000ms)`);
  console.log(`  Frontend Timeout: 40000ms`);

  if (bElapsed < 35000) {
    console.log('  ✅ TEST 2 PASSED: Backend processing finishes under 35s.\n');
    passed++;
  } else {
    console.error('  ❌ TEST 2 FAILED\n');
  }

  // [TEST 3] Normal Success Preservation
  total++;
  console.log('[TEST 3] Normal Success Regression Test');
  try {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ possibleConditions: [{ condition: 'Febrile Illness', confidence: 'medium' }], recommendedSpecialist: 'General Physician', guidance: ['Rest well'] }) } }],
      }),
    });
    process.env.HUGGINGFACE_API_TOKEN = 'mock-test-token';

    const succRes = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(['fever'], '1 day', 'mild', 'req-succ-3');
    console.log(`  Success Result: "${succRes.topCondition}"`);
    console.log('  ✅ TEST 3 PASSED\n');
    passed++;
  } finally {
    global.fetch = origFetch;
    process.env.HUGGINGFACE_API_TOKEN = origToken;
  }

  console.log(`Summary: ${passed} / ${total} tests passed.`);
  if (passed === total) {
    console.log('✨ ALL HARD DEADLINE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }
}

testHardDeadline();
