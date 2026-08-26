const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');

async function runTests() {
  console.log('=== STEP 35H AUTOMATED TEST SUITE ===\n');

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

  // 1. EXACT ABDOMINAL TEST (Section 11)
  const abdominalInput = 'For the past two days, I have had a sharp pain in the lower right side of my abdomen. The pain started mildly but has gradually become worse, especially when I walk quickly, cough, bend forward, or press that area. I also feel nauseous, I have lost my appetite, and I had a mild fever.';

  const abdominalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: [abdominalInput],
    conversation: [],
  });

  console.log('Abdominal Case Output:');
  console.log('Positive Symptoms:', abdominalCase.positiveSymptoms);
  console.log('Duration:', abdominalCase.duration);
  console.log('Context:', abdominalCase.context);
  console.log('Severity:', abdominalCase.severity);
  console.log('');

  // Expected positiveSymptoms: ["sharp lower right abdominal pain", "nausea", "loss of appetite", "mild fever"]
  assert(
    abdominalCase.positiveSymptoms.length === 4 &&
    abdominalCase.positiveSymptoms.includes('sharp lower right abdominal pain') &&
    abdominalCase.positiveSymptoms.includes('nausea') &&
    abdominalCase.positiveSymptoms.includes('loss of appetite') &&
    abdominalCase.positiveSymptoms.includes('mild fever'),
    '1.1 Exact Abdominal Test: Positive symptoms match expected canonical concepts exactly'
  );

  assert(abdominalCase.duration === '2 days', '1.2 Exact Abdominal Test: Duration parsed as "2 days"');
  assert(abdominalCase.severity === null, '1.3 Exact Abdominal Test: Severity remains null (not explicitly rated)');

  assert(
    abdominalCase.context.some(c => c.includes('progressively worsening')) &&
    abdominalCase.context.some(c => c.includes('walking quickly')) &&
    abdominalCase.context.some(c => c.includes('coughing')) &&
    abdominalCase.context.some(c => c.includes('bending forward')) &&
    abdominalCase.context.some(c => c.includes('pressure')),
    '1.4 Exact Abdominal Test: Context captures worsening trend and all 4 aggravating factors'
  );

  // Prohibited symptoms in positiveSymptoms
  const prohibited = ['for the past two days', 'walking', 'coughing', 'bend forward', 'pressure', 'or pressure', 'pain worsening'];
  const hasProhibited = prohibited.some(p => abdominalCase.positiveSymptoms.includes(p));
  assert(!hasProhibited, '1.5 Exact Abdominal Test: Duration, aggravating factors, and progression are NOT present in positiveSymptoms');

  // 2. GENERAL REGRESSION TEST A: "I cough and my chest hurts"
  const testA = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['I cough and my chest hurts'],
  });
  assert(
    testA.positiveSymptoms.includes('cough') && testA.positiveSymptoms.includes('chest pain'),
    '2. Test A: "I cough and my chest hurts" includes both cough and chest pain in positiveSymptoms'
  );

  // 3. GENERAL REGRESSION TEST B: "My chest pain gets worse when I cough"
  const testB = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['My chest pain gets worse when I cough'],
  });
  assert(
    testB.positiveSymptoms.includes('chest pain') && !testB.positiveSymptoms.includes('cough'),
    '3.1 Test B: "My chest pain gets worse when I cough" includes chest pain and excludes cough from positiveSymptoms'
  );
  assert(
    testB.context.some(c => c.includes('coughing')),
    '3.2 Test B: Aggravating factor "pain worse when coughing" placed in context'
  );

  // 4. GENERAL REGRESSION TEST C: "My knee hurts when I climb stairs"
  const testC = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['My knee hurts when I climb stairs'],
  });
  assert(
    testC.positiveSymptoms.includes('knee pain') && !testC.positiveSymptoms.includes('climbing stairs'),
    '4.1 Test C: Knee pain placed in positiveSymptoms, stairs excluded'
  );
  assert(
    testC.context.some(c => c.includes('stairs') || c.includes('climbing') || c.includes('climb')),
    '4.2 Test C: "pain worse climbing stairs" placed in context'
  );

  // 5. GENERAL REGRESSION TEST D: "I feel dizzy when I stand up"
  const testD = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['I feel dizzy when I stand up'],
  });
  assert(
    testD.positiveSymptoms.includes('dizziness') && !testD.positiveSymptoms.includes('standing up'),
    '5.1 Test D: Dizziness placed in positiveSymptoms'
  );
  assert(
    testD.context.some(c => c.includes('standing')),
    '5.2 Test D: "triggered by standing" placed in context'
  );

  // 6. GENERAL REGRESSION TEST E: "I have fever and cough for three days"
  const testE = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['I have fever and cough for three days'],
  });
  assert(
    testE.positiveSymptoms.includes('fever') && testE.positiveSymptoms.includes('cough'),
    '6.1 Test E: Fever and cough placed in positiveSymptoms'
  );
  assert(testE.duration === '3 days', '6.2 Test E: Duration parsed as "3 days"');

  // 7. QUESTION-AWARE FOLLOW-UP CLASSIFICATION
  const testFollowUpAggravating = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['lower right abdominal pain'],
    conversation: [
      { question: 'Does the pain get worse when coughing?', answer: 'Yes, when I cough' }
    ],
  });
  assert(
    !testFollowUpAggravating.positiveSymptoms.includes('cough'),
    '7.1 Question-Aware Follow-Up: "Yes" to "worse when coughing" does NOT add cough to positiveSymptoms'
  );
  assert(
    testFollowUpAggravating.context.some(c => c.includes('coughing')),
    '7.2 Question-Aware Follow-Up: "Yes" to "worse when coughing" adds aggravating factor to context'
  );

  const testFollowUpSymptomQ = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['fever'],
    conversation: [
      { question: 'Do you have a cough?', answer: 'Yes' }
    ],
  });
  assert(
    testFollowUpSymptomQ.positiveSymptoms.includes('cough'),
    '7.3 Question-Aware Follow-Up: "Yes" to "Do you have a cough?" adds cough to positiveSymptoms'
  );

  const testFollowUpNegation = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['stomach pain'],
    conversation: [
      { question: 'Do you have vomiting?', answer: 'No' }
    ],
  });
  assert(
    testFollowUpNegation.negativeFindings.includes('no vomiting') && !testFollowUpNegation.positiveSymptoms.includes('vomiting'),
    '7.4 Question-Aware Follow-Up: "No" to "Do you have vomiting?" adds "no vomiting" to negativeFindings'
  );

  // 8. GLOBAL SEVERITY SEPARATION
  const testMildFever = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['mild fever'],
  });
  assert(testMildFever.positiveSymptoms.includes('mild fever'), '8.1 Mild fever placed in positiveSymptoms');
  assert(testMildFever.severity === null, '8.2 Mild fever does NOT mutate global severity to mild');

  // 9. DEDUPLICATION & SPECIFICITY PRESERVATION
  const testDupes = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['sharp lower right abdominal pain', 'sharp pain in lower right abdomen', 'i feel nauseous', 'nausea', 'stomach pain'],
  });
  assert(
    testDupes.positiveSymptoms.length === 2 &&
    testDupes.positiveSymptoms.includes('sharp lower right abdominal pain') &&
    testDupes.positiveSymptoms.includes('nausea'),
    '9. Deduplication & Specificity: Duplicate terms merged and specific abdominal pain kept over generic stomach pain'
  );

  // 10. MULTILINGUAL TESTS (Sinhala & Tamil)
  const siCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['පසුගිය දින දෙක තුළ මට පහළ දකුණු බඩේ තද කැක්කුමක් පැවතුනි'],
  });
  assert(siCase.duration === '2 days', '10.1 Sinhala duration parsed as "2 days"');

  const taCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: ['கடந்த இரண்டு நாட்களாக எனக்கு வயிற்றின் கீழ் வலது பக்கத்தில் கடுமையான வலி உள்ளது'],
  });
  assert(taCase.duration === '2 days', '10.2 Tamil duration parsed as "2 days"');

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
