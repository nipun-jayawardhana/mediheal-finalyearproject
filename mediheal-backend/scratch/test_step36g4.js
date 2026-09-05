const clinicalCaseService = require('../src/services/clinicalCaseService');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('=== TEST SUITE: STEP 36G.4 ===\n');

// ----------------------------------------------------
// TEST A: INITIAL RASH
// ----------------------------------------------------
console.log('--- TEST A: Initial Rash ---');
const inputA = "I developed an itchy red rash on both arms today. I have no swelling of my lips and no difficulty breathing.";
const caseA = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [inputA] });
console.log('Case A:', JSON.stringify(caseA, null, 2));

assert(caseA.positiveSymptoms.includes('itchy red rash'), 'positiveSymptoms includes "itchy red rash"');
assert(!caseA.positiveSymptoms.includes('swelling'), 'positiveSymptoms does NOT include positive "swelling"');
assert(!caseA.negativeFindings.includes('no rash'), 'negativeFindings does NOT include "no rash"');
assert(caseA.negativeFindings.includes('no lip swelling'), 'negativeFindings includes "no lip swelling"');
assert(caseA.negativeFindings.includes('no difficulty breathing'), 'negativeFindings includes "no difficulty breathing"');
assert(!caseA.negativeFindings.includes('no breathing difficulty'), 'negativeFindings does not contain duplicate "no breathing difficulty"');
assert(caseA.context.includes('both arms'), 'context includes "both arms"');
assert(caseA.duration === 'today', 'duration is "today"');
assert(caseA.severity === null, 'severity is null');

// ----------------------------------------------------
// TEST B: SPREAD QUESTION + NO
// ----------------------------------------------------
console.log('\n--- TEST B: Spread Question + No ---');
const convB = [
  {
    question: "Has the rash spread to other parts of your body?",
    answer: "No"
  }
];
const caseB = clinicalCaseService.buildCanonicalClinicalCase({
  symptoms: [inputA],
  conversation: convB
});
console.log('Case B:', JSON.stringify(caseB, null, 2));

assert(caseB.positiveSymptoms.includes('itchy red rash'), 'positiveSymptoms still includes "itchy red rash" after spread question No');
assert(caseB.negativeFindings.includes('no rash spreading'), 'negativeFindings includes "no rash spreading"');
assert(!caseB.negativeFindings.includes('no rash'), 'negativeFindings must NOT add "no rash"');
assert(caseB.context.includes('both arms'), 'context still includes "both arms"');
assert(caseB.duration === 'today', 'duration is still "today"');

// ----------------------------------------------------
// TEST C: NEGATIVE SYNONYM DEDUPE
// ----------------------------------------------------
console.log('\n--- TEST C: Negative Synonym Dedupe ---');
const caseC = clinicalCaseService.buildCanonicalClinicalCase({
  symptoms: ['rash'],
  negativeFindings: ['no difficulty breathing', 'no breathing difficulty', 'no shortness of breath']
});
console.log('Case C negative findings:', caseC.negativeFindings);

const breathingNegs = caseC.negativeFindings.filter(n => n.includes('breathing') || n.includes('breath'));
assert(breathingNegs.length === 1, 'breathing negatives deduplicated to exactly 1 canonical term');
assert(breathingNegs[0] === 'no difficulty breathing', 'canonical breathing negative is "no difficulty breathing"');

// ----------------------------------------------------
// TEST D: TRUE DURATION CONFLICT
// ----------------------------------------------------
console.log('\n--- TEST D: True Duration Conflict ---');
const convD = [
  {
    question: "How long have you had this itchy red rash?",
    answer: "About a week"
  }
];
const caseD = clinicalCaseService.buildCanonicalClinicalCase({
  symptoms: [inputA],
  conversation: convD
});
console.log('Case D:', JSON.stringify(caseD, null, 2));

assert(caseD.duration === 'today', 'duration remains "today"');
assert(caseD.additionalDetails.some(d => d.includes('duration discrepancy') && d.includes('today')), 'additionalDetails contains duration discrepancy');
assert(caseD.positiveSymptoms.includes('itchy red rash'), 'positiveSymptoms still includes "itchy red rash"');

// ----------------------------------------------------
// TEST E: SAME DURATION NO CONFLICT
// ----------------------------------------------------
console.log('\n--- TEST E: Same Duration No Conflict ---');
const convE = [
  {
    question: "How long have you had this?",
    answer: "About a week"
  }
];
const caseE = clinicalCaseService.buildCanonicalClinicalCase({
  symptoms: ['itchy rash for 1 week'],
  duration: '1 week',
  conversation: convE
});
console.log('Case E:', JSON.stringify(caseE, null, 2));

assert(caseE.duration === '1 week', 'duration is "1 week"');
assert(!caseE.additionalDetails.some(d => d.includes('duration discrepancy')), 'no duration discrepancy created for semantically equivalent durations');

// ----------------------------------------------------
// TEST F: CANONICAL CASE PRESERVATION ACROSS 3 FOLLOW-UPS
// ----------------------------------------------------
console.log('\n--- TEST F: Canonical Case Preservation Across 3 Follow-ups ---');
const convF = [
  {
    question: "Has the rash spread to other parts of your body?",
    answer: "No"
  },
  {
    question: "Do you have any fever?",
    answer: "No"
  },
  {
    question: "Have you tried taking any antacids or medicines?",
    answer: "No, none taken"
  }
];
const caseF = clinicalCaseService.buildCanonicalClinicalCase({
  symptoms: [inputA],
  conversation: convF
});
console.log('Case F:', JSON.stringify(caseF, null, 2));

assert(caseF.positiveSymptoms.includes('itchy red rash'), 'positiveSymptoms still includes "itchy red rash" after 3 follow-up turns');
assert(!caseF.negativeFindings.includes('no rash'), 'no false "no rash" after 3 follow-up turns');
assert(caseF.negativeFindings.includes('no rash spreading'), 'includes "no rash spreading"');
assert(caseF.negativeFindings.includes('no fever'), 'includes "no fever"');
assert(caseF.negativeFindings.includes('no lip swelling'), 'includes "no lip swelling"');
assert(caseF.negativeFindings.includes('no difficulty breathing'), 'includes "no difficulty breathing"');
assert(caseF.context.includes('both arms'), 'context "both arms" preserved');
assert(caseF.duration === 'today', 'duration "today" preserved');

// ----------------------------------------------------
// TEST G: SINHALA PARITY
// ----------------------------------------------------
console.log('\n--- TEST G: Sinhala Parity ---');
const inputG = "අද අත් දෙකේම රතු පාට කැසීමක් ඇති රෑෂ් එකක් ආවා. තොල් ඉදිමීමක්වත් හුස්ම ගන්න අපහසුතාවයක්වත් නැහැ";
const caseG = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [inputG] });
console.log('Case G:', JSON.stringify(caseG, null, 2));

assert(caseG.positiveSymptoms.includes('itchy red rash'), 'Sinhala positiveSymptoms includes "itchy red rash"');
assert(!caseG.positiveSymptoms.includes('swelling'), 'Sinhala positiveSymptoms does not include positive "swelling"');
assert(!caseG.negativeFindings.includes('no rash'), 'Sinhala negativeFindings does not include "no rash"');
assert(caseG.negativeFindings.includes('no lip swelling'), 'Sinhala negativeFindings includes "no lip swelling"');
assert(caseG.negativeFindings.includes('no difficulty breathing'), 'Sinhala negativeFindings includes "no difficulty breathing"');
assert(caseG.context.includes('both arms'), 'Sinhala context includes "both arms"');
assert(caseG.duration === 'today', 'Sinhala duration is "today"');

console.log('\n🎉 ALL STEP 36G.4 TESTS PASSED SUCCESSFULLY! 🎉\n');
