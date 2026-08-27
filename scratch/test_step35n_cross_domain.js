const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiConversationService = require('../mediheal-backend/src/services/geminiConversationService');

function testCrossDomains() {
  console.log('==================================================');
  console.log('STEP 35N — CROSS-DOMAIN REGRESSION TESTS (A, B, C, D)');
  console.log('==================================================\n');

  // TEST A: Headache
  console.log('--- TEST A: Headache ---');
  const textA = "I have had a throbbing left-sided headache for two days with nausea and sensitivity to bright light, but no fever.";
  const caseA = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textA] });
  console.log('Case A positiveSymptoms:', caseA.positiveSymptoms);
  console.log('Case A negativeFindings:', caseA.negativeFindings);
  console.log('Case A duration:', caseA.duration);

  // Check 1: Duration question MUST be rejected (already known)
  const qA_dur = "How long have you had this headache?";
  const valA_dur = geminiConversationService.validateFollowUpQuestion({ question: qA_dur, canonicalCase: caseA });
  console.log(`Question: "${qA_dur}" -> accepted=${valA_dur.accepted}, reason=${valA_dur.reason}`);

  // Check 2: Fever question MUST be rejected (already in negativeFindings)
  const qA_fev = "Do you have a fever?";
  const valA_fev = geminiConversationService.validateFollowUpQuestion({ question: qA_fev, canonicalCase: caseA });
  console.log(`Question: "${qA_fev}" -> accepted=${valA_fev.accepted}, reason=${valA_fev.reason}`);

  // Check 3: Useful missing neuro/headache question MUST be accepted
  const qA_val = "Have you noticed any neck stiffness or confusion?";
  const valA_val = geminiConversationService.validateFollowUpQuestion({ question: qA_val, canonicalCase: caseA });
  console.log(`Question: "${qA_val}" -> accepted=${valA_val.accepted}, reason=${valA_val.reason}`);

  const passA = !valA_dur.accepted && !valA_fev.accepted && valA_val.accepted;
  console.log('TEST A Result:', passA ? 'PASS ✅' : 'FAIL ❌');

  // TEST B: Urinary
  console.log('\n--- TEST B: Urinary ---');
  const textB = "I have burning when urinating for three days with unusual penile discharge but no fever.";
  const caseB = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textB] });
  console.log('Case B positiveSymptoms:', caseB.positiveSymptoms);
  console.log('Case B negativeFindings:', caseB.negativeFindings);

  // Urinary follow-up MUST BE ACCEPTED (Proves urinary domain is not globally blocked!)
  const qB_uri = "Have you noticed any urinary frequency, urgency, or blood in your urine?";
  const valB_uri = geminiConversationService.validateFollowUpQuestion({ question: qB_uri, canonicalCase: caseB });
  console.log(`Question: "${qB_uri}" -> accepted=${valB_uri.accepted}, reason=${valB_uri.reason}`);

  const passB = valB_uri.accepted && valB_uri.reason === 'relevant';
  console.log('TEST B Result (Urinary questions allowed for urinary complaints):', passB ? 'PASS ✅' : 'FAIL ❌');

  // TEST C: Respiratory
  console.log('\n--- TEST C: Respiratory ---');
  const textC = "I have cough, fever and shortness of breath since yesterday.";
  const caseC = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textC] });
  console.log('Case C positiveSymptoms:', caseC.positiveSymptoms);
  console.log('Case C duration:', caseC.duration);

  // Relevant respiratory question MUST BE ACCEPTED
  const qC_resp = "Are you coughing up any green or yellow phlegm, or chest pain?";
  const valC_resp = geminiConversationService.validateFollowUpQuestion({ question: qC_resp, canonicalCase: caseC });
  console.log(`Question: "${qC_resp}" -> accepted=${valC_resp.accepted}, reason=${valC_resp.reason}`);

  const passC = valC_resp.accepted && valC_resp.reason === 'relevant';
  console.log('TEST C Result:', passC ? 'PASS ✅' : 'FAIL ❌');

  // TEST D: Abdominal
  console.log('\n--- TEST D: Abdominal ---');
  const textD = "I have burning upper abdominal pain after spicy food with nausea and no vomiting.";
  const caseD = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [textD] });
  console.log('Case D positiveSymptoms:', caseD.positiveSymptoms);
  console.log('Case D negativeFindings:', caseD.negativeFindings);

  // Vomiting question MUST BE REJECTED (already in negativeFindings)
  const qD_vom = "Have you been vomiting or throwing up?";
  const valD_vom = geminiConversationService.validateFollowUpQuestion({ question: qD_vom, canonicalCase: caseD });
  console.log(`Question: "${qD_vom}" -> accepted=${valD_vom.accepted}, reason=${valD_vom.reason}`);

  // Valid GI question MUST BE ACCEPTED
  const qD_val = "Have you noticed any changes in your stool or relief with antacids?";
  const valD_val = geminiConversationService.validateFollowUpQuestion({ question: qD_val, canonicalCase: caseD });
  console.log(`Question: "${qD_val}" -> accepted=${valD_val.accepted}, reason=${valD_val.reason}`);

  const passD = !valD_vom.accepted && valD_val.accepted;
  console.log('TEST D Result:', passD ? 'PASS ✅' : 'FAIL ❌');

  if (passA && passB && passC && passD) {
    console.log('\n==================================================');
    console.log('✅ ALL CROSS-DOMAIN REGRESSION TESTS PASSED');
    console.log('==================================================\n');
  } else {
    console.error('\n❌ CROSS-DOMAIN REGRESSION TESTS FAILED');
    process.exit(1);
  }
}

testCrossDomains();
