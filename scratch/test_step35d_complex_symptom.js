const path = require('path');
const clinicalCaseService = require(path.join(__dirname, '../mediheal-backend/src/services/clinicalCaseService'));
const symptomService = require(path.join(__dirname, '../mediheal-backend/src/services/symptomService'));
const geminiTranslationService = require(path.join(__dirname, '../mediheal-backend/src/services/geminiTranslationService'));

async function runStep35DTests() {
  console.log('=== STEP 35D — COMPLEX SYMPTOM EXTRACTION & ACUTE ABDOMINAL SAFETY TEST ===\n');

  try {
    // TEST 1: English Equivalent Statement
    const enInput = "During the last 12 hours I developed sharp pain in the lower-right abdomen. The pain has gradually worsened, especially when walking, coughing, or pressing the area. I have nausea, loss of appetite, and a mild fever.";
    console.log('[TEST 1] Testing English Input Parsing...');
    const enCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: [enInput] });
    console.log('  Positive Symptoms:', enCase.positiveSymptoms);
    console.log('  Context:', enCase.context);
    console.log('  Duration:', enCase.duration);
    console.log('  Severity:', enCase.severity);

    // Verifications for Test 1
    const hasLowerRightPain = enCase.positiveSymptoms.some((s) => s.toLowerCase().includes('lower right abdominal') || s.toLowerCase().includes('sharp lower right'));
    const hasSharp = enCase.positiveSymptoms.some((s) => s.toLowerCase().includes('sharp'));
    const hasDuration12h = enCase.duration.includes('12 hour');
    const hasLossAppetite = enCase.positiveSymptoms.some((s) => s.toLowerCase().includes('loss of appetite'));
    const hasMildFever = enCase.positiveSymptoms.some((s) => s.toLowerCase().includes('mild fever') || s.toLowerCase().includes('fever'));
    const hasWorsening = enCase.context.some((c) => c.toLowerCase().includes('worsening'));
    const hasWalking = enCase.context.some((c) => c.toLowerCase().includes('walking'));
    const hasCoughing = enCase.context.some((c) => c.toLowerCase().includes('coughing'));
    const hasPressure = enCase.context.some((c) => c.toLowerCase().includes('pressure') || c.toLowerCase().includes('press'));

    console.log('\n  --- EN VERIFICATIONS ---');
    console.log('  ✔ Location preserved (lower right abdominal):', hasLowerRightPain);
    console.log('  ✔ Quality preserved (sharp):', hasSharp);
    console.log('  ✔ Duration extracted (12 hours):', hasDuration12h);
    console.log('  ✔ Loss of appetite preserved:', hasLossAppetite);
    console.log('  ✔ Mild fever preserved:', hasMildFever);
    console.log('  ✔ Severity NOT forced to mild (global severity):', enCase.severity === null || enCase.severity === 'unspecified');
    console.log('  ✔ Progression preserved (worsening):', hasWorsening);
    console.log('  ✔ Aggravating factor walking preserved:', hasWalking);
    console.log('  ✔ Aggravating factor coughing preserved:', hasCoughing);
    console.log('  ✔ Aggravating factor pressure preserved:', hasPressure);

    if (!hasLowerRightPain || !hasSharp || !hasDuration12h || !hasLossAppetite || !hasWorsening) {
      throw new Error('English input verification failed!');
    }

    // TEST 2: Rule Engine Urgent Abdominal Safety Trigger
    console.log('\n[TEST 2] Testing Urgent Abdominal Safety Rule in Rule Engine...');
    const analysis = symptomService.analyzeSymptoms(enCase);
    console.log('  Analysis Source:', analysis.analysisSource);
    console.log('  Possible Condition:', analysis.possibleCondition);
    console.log('  Risk Level:', analysis.riskLevel);
    console.log('  Recommended Specialist:', analysis.recommendedSpecialist);
    console.log('  Emergency Recommended:', analysis.emergencyRecommended);
    console.log('  Guidance:', analysis.guidance);

    if (analysis.riskLevel !== 'high' || !analysis.emergencyRecommended) {
      throw new Error('Urgent abdominal safety rule failed! Expected riskLevel high.');
    }
    if (!analysis.possibleCondition.toLowerCase().includes('acute abdominal')) {
      throw new Error('Expected acute abdominal condition in rule result.');
    }
    console.log('  ✔ Acute Abdominal Safety Rule Triggered Successfully!');

    // TEST 3: Sinhala Input Translation & Extraction (via geminiTranslationService if key present)
    const siInput = "පසුගිය පැය දොළහ තුළ මගේ උදරයේ පහළ දකුණු පැත්තේ තියුණු වේදනාවක් ඇති වූ අතර, වේදනාව ක්රමයෙන් නරක අතට හැරුණි, විශේෂයෙන් මම ඇවිදින විට, කැස්ස හෝ එම ප්රදේශය තද කරන විට, මට ඔක්කාරය දැනෙන විට, මගේ ආහාර රුචිය නැති වී, මෘදු උණක් ඇති විය.";
    console.log('\n[TEST 3] Testing Sinhala Input Translation & Extraction...');
    const siTrans = await geminiTranslationService.translateInputToCanonicalEnglish(siInput, 'si');
    console.log('  Translated English Text:', siTrans.englishText);
    console.log('  Extracted Symptom Concepts:', siTrans.symptomConcepts);

    const siCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: siTrans.symptomConcepts.length > 0 ? siTrans.symptomConcepts : [siTrans.englishText] });
    console.log('  Sinhala Case Positive Symptoms:', siCase.positiveSymptoms);
    console.log('  Sinhala Case Context:', siCase.context);
    console.log('  Sinhala Case Duration:', siCase.duration);

    // TEST 4: Regression Test Cases
    console.log('\n[TEST 4] Running Clinical Case Regressions...');
    
    // Knee fall
    const kneeCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['knee pain after I fell down while playing football'] });
    console.log('  Knee Case:', kneeCase.positiveSymptoms, '| Context:', kneeCase.context);
    if (!kneeCase.positiveSymptoms.includes('knee pain') || !kneeCase.context.some((c) => c.includes('fall'))) {
      throw new Error('Knee fall regression failed!');
    }

    // Headache + nausea
    const headCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['throbbing headache and nausea for 2 days'] });
    console.log('  Headache Case:', headCase.positiveSymptoms, '| Duration:', headCase.duration);
    if (!headCase.positiveSymptoms.includes('headache') || !headCase.positiveSymptoms.includes('nausea') || !headCase.duration.includes('2 day')) {
      throw new Error('Headache regression failed!');
    }

    // Chest pain + difficulty breathing (Emergency)
    const chestCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms: ['severe chest pain and difficulty breathing'] });
    const chestAnalysis = symptomService.analyzeSymptoms(chestCase);
    console.log('  Chest Case Risk Level:', chestAnalysis.riskLevel, '| Source:', chestAnalysis.analysisSource);
    if (chestAnalysis.riskLevel !== 'high' || !chestAnalysis.emergencyRecommended) {
      throw new Error('Chest pain emergency regression failed!');
    }

    console.log('\n======================================================');
    console.log('STEP 35D COMPLEX SYMPTOM & SAFETY TESTS PASSED CLEANLY! 🚀');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ STEP 35D TEST FAILED:', err.message);
    process.exit(1);
  }
}

runStep35DTests();
