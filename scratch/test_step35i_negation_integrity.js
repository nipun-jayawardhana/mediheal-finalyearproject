const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');

async function runTests() {
  console.log('=== STEP 35I AUTOMATED TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. EXACT REAL TEST CASE (GERD / Dyspepsia Input)
  const realStatement = 'Since yesterday evening I have had a burning pain in the upper middle part of my abdomen that becomes worse after eating spicy food and when I lie down. Sometimes I feel a sour taste coming into my mouth and I have been burping frequently. I feel slightly nauseous, but I have not vomited, I do not have diarrhea, and I have no fever.';

  const realConversation = [
    { question: 'Does eating food make this burning pain better or worse?', answer: 'Better' },
    { question: 'Have you tried taking any antacids or over-the-counter medicine for this burning pain?', answer: 'No, none taken' },
    { question: 'Have you noticed any difficulty or pain when swallowing your food?', answer: 'Yes' },
  ];

  const case1 = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [realStatement],
    conversation: realConversation,
  });

  console.log('Case 1 Output:');
  console.log('Positive Symptoms:', case1.positiveSymptoms);
  console.log('Negative Findings:', case1.negativeFindings);
  console.log('Context:', case1.context);
  console.log('Duration:', case1.duration);
  console.log('Severity:', case1.severity);
  console.log('Additional Details:', case1.additionalDetails);
  console.log('');

  // 1.1 Positive Symptoms assertions
  assert(
    case1.positiveSymptoms.includes('burning upper abdominal pain') &&
    case1.positiveSymptoms.includes('sour taste in mouth') &&
    case1.positiveSymptoms.includes('frequent burping') &&
    case1.positiveSymptoms.includes('nausea') &&
    case1.positiveSymptoms.includes('swallowing difficulty/pain'),
    '1.1 Real Test: Positive symptoms preserve location, quality, sour taste, burping, nausea, and swallowing difficulty'
  );

  // 1.2 Prohibited symptoms in positiveSymptoms
  const prohibitedPositives = ['fever', 'mild fever', 'vomiting', 'diarrhea', 'stomach pain', 'spicy food', 'lying down', 'better'];
  const hasProhibited = prohibitedPositives.some(p => case1.positiveSymptoms.includes(p));
  assert(!hasProhibited, '1.2 Real Test: Denied symptoms, triggers, and food ratings are NOT in positiveSymptoms');

  // 1.3 Negative Findings assertion
  assert(
    case1.negativeFindings.includes('no vomiting') &&
    case1.negativeFindings.includes('no diarrhea') &&
    case1.negativeFindings.includes('no fever'),
    '1.3 Real Test: Negative findings correctly extract denied symptoms (no vomiting, no diarrhea, no fever)'
  );

  // 1.4 Context assertion
  assert(
    case1.context.some(c => c.includes('spicy food')) &&
    case1.context.some(c => c.includes('lying down')) &&
    case1.context.some(c => c.includes('improves with eating')),
    '1.4 Real Test: Context preserves aggravating factors (spicy food, lying down) and relief factor (improves with eating)'
  );

  // 1.5 Duration & Severity assertion
  assert(case1.duration === '1 day', '1.5 Real Test: Duration correctly extracted as "1 day"');
  assert(case1.severity === null, '1.6 Real Test: Global severity remains null (not explicitly rated)');

  // 1.6 Additional Details assertion
  assert(
    case1.additionalDetails.some(d => d.includes('yesterday evening')) &&
    case1.additionalDetails.some(d => d.includes('no antacid')),
    '1.7 Real Test: Additional details record onset time and treatment history'
  );

  // 2. TEST NEGATION PAIRS (A to D)
  const negA = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['I have fever'] });
  assert(negA.positiveSymptoms.includes('fever') && negA.negativeFindings.length === 0, '2.1 Negation Pair A: "I have fever" -> positive fever');

  const negB = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['I have no fever'] });
  assert(!negB.positiveSymptoms.includes('fever') && negB.negativeFindings.includes('no fever'), '2.2 Negation Pair B: "I have no fever" -> negative no fever');

  const negC = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['I feel nauseous but I have not vomited'] });
  assert(
    negC.positiveSymptoms.includes('nausea') && !negC.positiveSymptoms.includes('vomiting') && negC.negativeFindings.includes('no vomiting'),
    '2.3 Negation Pair C: "I feel nauseous but I have not vomited" -> positive nausea, negative no vomiting'
  );

  const negD = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['No chest pain or shortness of breath'] });
  assert(
    negD.negativeFindings.includes('no chest pain') && negD.negativeFindings.includes('no breathing difficulty'),
    '2.4 Negation Pair D: "No chest pain or shortness of breath" -> negative no chest pain, negative no breathing difficulty'
  );

  // 3. KEYWORD VS RELATIONSHIP TESTS (A to D)
  const relA = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['I have a cough'] });
  assert(relA.positiveSymptoms.includes('cough'), '3.1 Relationship Test A: "I have a cough" -> positive cough');

  const relB = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['My abdominal pain worsens when I cough'] });
  assert(
    !relB.positiveSymptoms.includes('cough') && relB.context.some(c => c.includes('coughing')),
    '3.2 Relationship Test B: "My abdominal pain worsens when I cough" -> context coughing, no positive cough'
  );

  // 4. SPECIFICITY TEST
  const specTest = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['burning pain in the upper middle abdomen'] });
  assert(
    specTest.positiveSymptoms.includes('burning upper abdominal pain') && !specTest.positiveSymptoms.includes('stomach pain'),
    '4. Specificity Test: "burning pain in upper middle abdomen" -> burning upper abdominal pain (no stomach pain)'
  );

  // 5. FOLLOW-UP MERGE TEST
  const mergeTest = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['burning upper abdominal pain'],
    conversation: [{ question: 'Any difficulty swallowing?', answer: 'Yes' }],
  });
  assert(
    mergeTest.positiveSymptoms.includes('burning upper abdominal pain') && mergeTest.positiveSymptoms.includes('swallowing difficulty/pain'),
    '5. Follow-Up Merge Test: Swallowing difficulty added to burning upper abdominal pain'
  );

  // 6. MULTILINGUAL NEGATION TESTS
  const siNeg = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['මට උණ නැත'] });
  assert(!siNeg.positiveSymptoms.includes('fever') && siNeg.negativeFindings.includes('no fever'), '6.1 Sinhala Negation: "මට උණ නැත" -> negative no fever');

  const taNeg = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['எனக்கு காய்ச்சல் இல்லை'] });
  assert(!taNeg.positiveSymptoms.includes('fever') && taNeg.negativeFindings.includes('no fever'), '6.2 Tamil Negation: "எனக்கு காய்ச்சல் இல்லை" -> negative no fever');

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
