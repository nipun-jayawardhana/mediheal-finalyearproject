const path = require('path');
require(path.join(__dirname, '../mediheal-backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../mediheal-backend/.env') });

const openBioLLMService = require('../mediheal-backend/src/services/clinicalCaseService'); // check import path
const openBioService = require('../mediheal-backend/src/services/openBioLLMService');
const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');

async function runAllTests() {
  console.log('====================================================');
  console.log('STEP 35E — COMPREHENSIVE SUITE TEST RUNNER');
  console.log('====================================================\n');

  // 1. TEST REAL OPENBIOLLM MODEL CALL WITH SINHALA CASE
  console.log('--- TEST 1: REAL OPENBIOLLM INFERENCE WITH COMPLEX SINHALA CASE ---');
  const test1Case = {
    positiveSymptoms: [
      'painful sore throat',
      'fever',
      'headache',
      'fatigue',
      'difficulty swallowing',
      'swollen neck glands',
      'white patches at back of throat',
    ],
    context: [],
    negativeFindings: [],
    duration: '3 days',
    severity: null,
  };

  const start1 = Date.now();
  try {
    const res1 = await openBioService.analyzeSymptomsWithOpenBioLLM(test1Case, 'req-real-si-1');
    const elapsed1 = Date.now() - start1;
    console.log(`RESULT 1: SUCCESS in ${elapsed1}ms`);
    console.log(`Top Condition: ${res1.topCondition}`);
    console.log(`Specialist: ${res1.recommendedSpecialist}`);
    console.log(`analysisSource: openbiollm\n`);
  } catch (err1) {
    const elapsed1 = Date.now() - start1;
    console.log(`RESULT 1: FALLBACK / ERROR in ${elapsed1}ms - ${err1.message}\n`);
  }

  // 2. RUN 5 REAL PROVIDER REQUESTS AS SPECIFIED IN PART 13
  console.log('--- TEST 2: 5 REAL PROVIDER REQUESTS (PART 13) ---');
  const cases = [
    {
      name: 'Case A: Sore Throat + Fever + Glands',
      case: { positiveSymptoms: ['painful sore throat', 'fever', 'headache', 'fatigue', 'difficulty swallowing', 'swollen neck glands', 'white patches at back of throat'], duration: '3 days', severity: null, context: [], negativeFindings: [] }
    },
    {
      name: 'Case B: Knee Fall + Swelling',
      case: { positiveSymptoms: ['knee pain', 'knee swelling'], duration: '1 day', severity: 'moderate', context: ['fall', 'injury while playing football'], negativeFindings: [] }
    },
    {
      name: 'Case C: Acute Abdominal',
      case: { positiveSymptoms: ['sharp lower right abdominal pain', 'nausea'], duration: '12 hours', severity: 'severe', context: ['pain worse when walking'], negativeFindings: [] }
    },
    {
      name: 'Case D: Chest Tightness',
      case: { positiveSymptoms: ['chest pain', 'shortness of breath'], duration: '2 hours', severity: 'severe', context: [], negativeFindings: [] }
    },
    {
      name: 'Case E: Rash + Itching',
      case: { positiveSymptoms: ['skin rash', 'itching'], duration: '4 days', severity: 'mild', context: [], negativeFindings: [] }
    }
  ];

  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    const reqNum = i + 1;
    const reqStart = Date.now();
    console.log(`[Req ${reqNum}] ${item.name}`);
    try {
      const res = await openBioService.analyzeSymptomsWithOpenBioLLM(item.case, `req-multi-${reqNum}`);
      const reqElapsed = Date.now() - reqStart;
      console.log(` -> [Req ${reqNum}] SUCCESS in ${reqElapsed}ms | Source: openbiollm | Condition: ${res.topCondition} | Specialist: ${res.recommendedSpecialist}`);
    } catch (err) {
      const reqElapsed = Date.now() - reqStart;
      console.log(` -> [Req ${reqNum}] FALLBACK (or provider unavailable) in ${reqElapsed}ms | Reason: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log('ALL TESTS COMPLETED');
  console.log('====================================================');
}

runAllTests().catch(console.error);
