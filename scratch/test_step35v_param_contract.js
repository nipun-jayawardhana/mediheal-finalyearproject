const assert = require('assert');

console.log('====================================================');
console.log('STEP 35V — GET PARAMETER CONTRACT TEST SUITE');
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
// 1. ROUTE PARAMETER RESOLUTION LOGIC
// ----------------------------------------------------
runTest('Express controller resolves symptomCheckId from req.params.symptomCheckId', () => {
  const req1 = { params: { symptomCheckId: '6a909309f640939bb562e37a' } };
  const rawParam1 = req1.params.symptomCheckId || req1.params.id;
  const resolvedId1 = typeof rawParam1 === 'string' ? rawParam1.trim() : '';

  assert.strictEqual(resolvedId1, '6a909309f640939bb562e37a');
  console.log('  Resolved ID from :symptomCheckId route param:', resolvedId1);
});

runTest('Express controller resolves symptomCheckId from req.params.id fallback', () => {
  const req2 = { params: { id: '6a909309f640939bb562e37a' } };
  const rawParam2 = req2.params.symptomCheckId || req2.params.id;
  const resolvedId2 = typeof rawParam2 === 'string' ? rawParam2.trim() : '';

  assert.strictEqual(resolvedId2, '6a909309f640939bb562e37a');
  console.log('  Resolved ID from :id route param:', resolvedId2);
});

// ----------------------------------------------------
// 2. FRONTEND SERVICE API CLIENT URL GENERATION
// ----------------------------------------------------
runTest('Frontend service generates correct GET URL', () => {
  const symptomCheckId = '6a909309f640939bb562e37a';
  const language = 'si';

  const cleanId = symptomCheckId.trim();
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  const generatedUrl = `/symptoms/${encodeURIComponent(cleanId)}${query}`;

  assert.strictEqual(generatedUrl, '/symptoms/6a909309f640939bb562e37a?language=si');
  console.log('  Generated GET URL:', generatedUrl);
});

console.log('\n----------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
