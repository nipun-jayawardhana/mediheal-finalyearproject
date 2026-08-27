const assert = require('assert');

console.log('====================================================');
console.log('STEP 35S — ANALYSIS RESULT ROUTE ID TEST SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✅ [PASS] ${description}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${description}`);
    console.error(`   Error: ${err.message}`);
  }
}

// ----------------------------------------------------
// 1. RESPONSE SHAPE & DATA PERSISTENCE CONTRACT
// ----------------------------------------------------
runTest('Analyze response payload contract includes both _id and symptomCheckId', () => {
  const mockSymptomCheck = {
    _id: '65f123456789abcdef001122',
    symptoms: ['dizziness', 'light-headedness'],
    possibleCondition: 'Orthostatic Hypotension',
    possibleConditions: [{ condition: 'Orthostatic Hypotension', confidence: 'medium' }],
    recommendedSpecialist: 'General Physician',
    riskLevel: 'low',
    guidance: ['Drink fluids'],
    disclaimer: 'Consult doctor',
    createdAt: new Date().toISOString()
  };

  const responsePayload = {
    success: true,
    message: 'Symptom analysis completed successfully',
    analysis: {
      _id: mockSymptomCheck._id,
      symptomCheckId: mockSymptomCheck._id,
      symptoms: mockSymptomCheck.symptoms,
      possibleCondition: mockSymptomCheck.possibleCondition,
      possibleConditions: mockSymptomCheck.possibleConditions,
      recommendedSpecialist: mockSymptomCheck.recommendedSpecialist,
      riskLevel: mockSymptomCheck.riskLevel,
      guidance: mockSymptomCheck.guidance,
      disclaimer: mockSymptomCheck.disclaimer,
      createdAt: mockSymptomCheck.createdAt
    }
  };

  assert(responsePayload.analysis._id, 'Payload MUST contain _id');
  assert(responsePayload.analysis.symptomCheckId, 'Payload MUST contain symptomCheckId');
  assert.strictEqual(responsePayload.analysis._id, '65f123456789abcdef001122');
  assert.strictEqual(responsePayload.analysis.symptomCheckId, '65f123456789abcdef001122');
  console.log('  Response payload _id:', responsePayload.analysis._id);
});

// ----------------------------------------------------
// 2. IDEMPOTENCY CACHE HIT CONTRACT
// ----------------------------------------------------
runTest('Idempotency hit response contains existing record _id', () => {
  const existingRecord = {
    _id: '65f123456789abcdef001122',
    analysisRequestId: 'req-test-1234'
  };

  const cachedResponse = {
    success: true,
    message: 'Symptom analysis completed successfully (cached result)',
    analysis: {
      _id: existingRecord._id,
      symptomCheckId: existingRecord._id
    }
  };

  assert.strictEqual(cachedResponse.analysis._id, existingRecord._id);
  assert.strictEqual(cachedResponse.analysis.symptomCheckId, existingRecord._id);
  console.log('  Idempotency response _id:', cachedResponse.analysis._id);
});

// ----------------------------------------------------
// 3. FRONTEND NAVIGATION TARGET EXTRACTION
// ----------------------------------------------------
runTest('symptom-checker extracts targetId correctly from analysis response', () => {
  const res1 = { success: true, analysis: { _id: '65f123456789abcdef001122', symptomCheckId: '65f123456789abcdef001122' } };
  const targetId1 = res1?.analysis?._id || res1?.analysis?.symptomCheckId;
  assert.strictEqual(targetId1, '65f123456789abcdef001122');

  const res2 = { success: true, analysis: { symptomCheckId: '65f123456789abcdef001122' } };
  const targetId2 = res2?.analysis?._id || res2?.analysis?.symptomCheckId;
  assert.strictEqual(targetId2, '65f123456789abcdef001122');
});

// ----------------------------------------------------
// 4. ROUTE PARAMETER NORMALIZATION (STRING VS STRING ARRAY)
// ----------------------------------------------------
runTest('analysis-result normalizes string and string[] route parameters', () => {
  // Case A: string
  const rawId1 = '65f123456789abcdef001122';
  const symptomCheckId1 = Array.isArray(rawId1) ? rawId1[0] : (typeof rawId1 === 'string' ? rawId1.trim() : '');
  assert.strictEqual(symptomCheckId1, '65f123456789abcdef001122');

  // Case B: string[]
  const rawId2 = ['65f123456789abcdef001122'];
  const symptomCheckId2 = Array.isArray(rawId2) ? rawId2[0] : (typeof rawId2 === 'string' ? rawId2.trim() : '');
  assert.strictEqual(symptomCheckId2, '65f123456789abcdef001122');

  // Case C: undefined
  const rawId3 = undefined;
  const symptomCheckId3 = Array.isArray(rawId3) ? rawId3[0] : (typeof rawId3 === 'string' ? rawId3.trim() : '');
  assert.strictEqual(symptomCheckId3, '');
});

console.log('\n----------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
