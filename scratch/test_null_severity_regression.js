const path = require('path');
const clinicalCaseService = require(path.join(__dirname, '../mediheal-backend/src/services/clinicalCaseService'));
const symptomService = require(path.join(__dirname, '../mediheal-backend/src/services/symptomService'));
const openBioLLMService = require(path.join(__dirname, '../mediheal-backend/src/services/openBioLLMService'));

async function runNullSeverityHardeningTests() {
  console.log('=== FINAL NULL-SEVERITY HARDENING TEST SUITE ===\n');

  try {
    // VERIFICATION 1: Mild fever + unknown overall severity
    console.log('[VERIFICATION 1] Mild fever + unknown overall severity...');
    const feverCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['I have a mild fever and slight cough'] });
    console.log('  Positive Symptoms:', feverCase.positiveSymptoms);
    console.log('  Case Severity:', feverCase.severity);

    if (feverCase.severity !== null) {
      throw new Error(`Expected severity to be null for mild fever, got: ${feverCase.severity}`);
    }
    const feverAnalysis = symptomService.analyzeSymptoms(feverCase);
    console.log('  Analysis Severity:', feverAnalysis.severity);
    if (feverAnalysis.severity !== null) {
      throw new Error(`Expected analysis.severity to be null, got: ${feverAnalysis.severity}`);
    }
    console.log('  ✔ Mild fever correctly keeps severity = NULL without forcing mild!\n');

    // VERIFICATION 2: Acute abdominal red flags + severity null
    console.log('[VERIFICATION 2] Acute abdominal red flags + severity null...');
    const enInput = "During the last 12 hours I developed sharp pain in the lower-right abdomen. The pain has gradually worsened, especially when walking, coughing, or pressing the area. I have nausea, loss of appetite, and a mild fever.";
    const abdoCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [enInput] });
    console.log('  Abdo Case Severity:', abdoCase.severity);
    const abdoAnalysis = symptomService.analyzeSymptoms(abdoCase);
    console.log('  Abdo Risk Level:', abdoAnalysis.riskLevel);
    console.log('  Abdo Emergency Recommended:', abdoAnalysis.emergencyRecommended);
    if (abdoAnalysis.riskLevel !== 'high' || !abdoAnalysis.emergencyRecommended) {
      throw new Error('Urgent abdominal safety rule failed for null severity case!');
    }
    console.log('  ✔ Acute abdominal safety rule (HIGH RISK) wins regardless of null severity!\n');

    // VERIFICATION 3: Ordinary non-red-flag symptoms + severity null
    console.log('[VERIFICATION 3] Ordinary non-red-flag symptoms + severity null...');
    const ordinaryCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['knee pain after running'] });
    const ordinaryAnalysis = symptomService.analyzeSymptoms(ordinaryCase);
    console.log('  Ordinary Case Severity:', ordinaryAnalysis.severity);
    console.log('  Ordinary Case Risk Level:', ordinaryAnalysis.riskLevel);
    if (ordinaryAnalysis.severity !== null) {
      throw new Error(`Expected ordinary case severity to be null, got: ${ordinaryAnalysis.severity}`);
    }
    console.log('  ✔ Ordinary symptoms keep severity = NULL without crashing or claiming mild!\n');

    // VERIFICATION 4: Explicit moderate/severe selections
    console.log('[VERIFICATION 4] Explicit moderate/severe selections...');
    const modCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['headache'], severity: 'moderate' });
    const sevCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['headache'], severity: 'severe' });
    console.log('  Moderate Selection Severity:', modCase.severity);
    console.log('  Severe Selection Severity:', sevCase.severity);
    if (modCase.severity !== 'moderate' || sevCase.severity !== 'severe') {
      throw new Error('Explicit severity selections failed!');
    }
    console.log('  ✔ Explicit moderate/severe selections preserved correctly!\n');

    console.log('======================================================');
    console.log('FINAL NULL-SEVERITY HARDENING VERIFICATIONS PASSED! 🚀');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runNullSeverityHardeningTests();
