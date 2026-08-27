const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');

function runRegressionTests() {
  console.log('==================================================');
  console.log('STEP 35M — ADDITIONAL REGRESSION TESTS (A, B, C, D)');
  console.log('==================================================\n');

  let allPassed = true;

  // TEST A
  const textA = "I have nausea but no vomiting or diarrhea.";
  console.log(`TEST A: "${textA}"`);
  const caseA = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textA] });
  console.log('  positiveSymptoms:', caseA.positiveSymptoms);
  console.log('  negativeFindings:', caseA.negativeFindings);
  const passA = caseA.positiveSymptoms.includes('nausea') &&
                caseA.negativeFindings.includes('no vomiting') &&
                caseA.negativeFindings.includes('no diarrhea');
  console.log('  Result:', passA ? 'PASS ✅' : 'FAIL ❌\n');
  if (!passA) allPassed = false;

  // TEST B
  const textB = "I have burning urination but no fever.";
  console.log(`\nTEST B: "${textB}"`);
  const caseB = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textB] });
  console.log('  positiveSymptoms:', caseB.positiveSymptoms);
  console.log('  negativeFindings:', caseB.negativeFindings);
  const passB = caseB.positiveSymptoms.some(s => s.includes('burning') || s.includes('urinate') || s.includes('urination')) &&
                caseB.negativeFindings.includes('no fever');
  console.log('  Result:', passB ? 'PASS ✅' : 'FAIL ❌\n');
  if (!passB) allPassed = false;

  // TEST C
  const textC = "I have chest pain but no shortness of breath or sweating.";
  console.log(`\nTEST C: "${textC}"`);
  const caseC = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textC] });
  console.log('  positiveSymptoms:', caseC.positiveSymptoms);
  console.log('  negativeFindings:', caseC.negativeFindings);
  const passC = caseC.positiveSymptoms.includes('chest pain') &&
                caseC.negativeFindings.includes('no breathing difficulty') &&
                caseC.negativeFindings.includes('no sweating');
  console.log('  Result:', passC ? 'PASS ✅' : 'FAIL ❌\n');
  if (!passC) allPassed = false;

  // TEST D
  const textD = "I have severe abdominal pain and fever.";
  console.log(`\nTEST D: "${textD}"`);
  const caseD = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textD] });
  console.log('  positiveSymptoms:', caseD.positiveSymptoms);
  console.log('  negativeFindings:', caseD.negativeFindings);
  const passD = caseD.positiveSymptoms.some(s => s.includes('abdominal') || s.includes('stomach')) &&
                caseD.positiveSymptoms.includes('fever') &&
                caseD.negativeFindings.length === 0;
  console.log('  Result:', passD ? 'PASS ✅' : 'FAIL ❌\n');
  if (!passD) allPassed = false;

  if (allPassed) {
    console.log('==================================================');
    console.log('✅ ALL REGRESSION TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } else {
    console.error('❌ ONE OR MORE REGRESSION TESTS FAILED');
    process.exit(1);
  }
}

runRegressionTests();
