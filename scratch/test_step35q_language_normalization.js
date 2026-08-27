const assert = require('assert');
const { formatConditionForDisplay } = require('../mediheal-mobile/src/utils/languageUtils');

console.log('====================================================');
console.log('STEP 35Q — LANGUAGE NORMALIZATION TEST SUITE');
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
// 1. SINHALA LANGUAGE NORMALIZATION
// ----------------------------------------------------
runTest('Sinhala mode removes English parenthetical text', () => {
  const input1 = "මුත්රා මාර්ග ආසාදනය (Urinary Tract Infection)";
  const res1 = formatConditionForDisplay(input1, 'si');
  console.log(`  Input: "${input1}" -> Output: "${res1}"`);
  assert.strictEqual(res1, "මුත්රා මාර්ග ආසාදනය");
  assert(!res1.includes('Urinary'), 'Must NOT contain English text');

  const input2 = "මුත්රා මාර්ගයේ ප්රදාහය (Urethritis)";
  const res2 = formatConditionForDisplay(input2, 'si');
  console.log(`  Input: "${input2}" -> Output: "${res2}"`);
  assert.strictEqual(res2, "මුත්රා මාර්ගයේ ප්රදාහය");

  const specialist = "හෘද රෝග විශේෂඥ (Cardiologist)";
  const resSpec = formatConditionForDisplay(specialist, 'si');
  console.log(`  Specialist Input: "${specialist}" -> Output: "${resSpec}"`);
  assert.strictEqual(resSpec, "හෘද රෝග විශේෂඥ");
});

// ----------------------------------------------------
// 2. TAMIL LANGUAGE NORMALIZATION
// ----------------------------------------------------
runTest('Tamil mode removes English parenthetical text', () => {
  const input = "சிறுநீரகப் பாதை தொற்று (Urinary Tract Infection)";
  const res = formatConditionForDisplay(input, 'ta');
  console.log(`  Input: "${input}" -> Output: "${res}"`);
  assert.strictEqual(res, "சிறுநீரகப் பாதை தொற்று");
  assert(!res.includes('Urinary'), 'Must NOT contain English text');
});

// ----------------------------------------------------
// 3. ENGLISH LANGUAGE NORMALIZATION
// ----------------------------------------------------
runTest('English mode shows canonical English condition only', () => {
  const input1 = "Urinary Tract Infection";
  const res1 = formatConditionForDisplay(input1, 'en');
  console.log(`  Input: "${input1}" -> Output: "${res1}"`);
  assert.strictEqual(res1, "Urinary Tract Infection");

  const input2 = "මුත්රා මාර්ග ආසාදනය (Urinary Tract Infection)";
  const res2 = formatConditionForDisplay(input2, 'en');
  console.log(`  Input: "${input2}" -> Output: "${res2}"`);
  assert.strictEqual(res2, "Urinary Tract Infection");
  assert(!/[^\x00-\x7F]/.test(res2), 'Must NOT contain Sinhala characters in English mode');
});

// ----------------------------------------------------
// 4. UNICODE NFC NORMALIZATION
// ----------------------------------------------------
runTest('Unicode string is normalized with NFC', () => {
  const rawText = "මුත්රා මාර්ග ආසාදනය";
  const normalized = formatConditionForDisplay(rawText, 'si');
  assert.strictEqual(normalized, rawText.normalize('NFC'));
});

// ----------------------------------------------------
// 5. CANONICAL ENGLISH OBJECT PRESERVATION
// ----------------------------------------------------
runTest('Internal canonical object condition property remains intact', () => {
  const conditionItem = { condition: "Urinary Tract Infection", confidence: "high" };
  const displayCondition = formatConditionForDisplay(conditionItem.condition, 'si');
  
  assert.strictEqual(conditionItem.condition, "Urinary Tract Infection", "Internal condition property must remain pure English");
  assert.strictEqual(typeof displayCondition, "string");
});

console.log('\n----------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
  process.exit(1);
}
