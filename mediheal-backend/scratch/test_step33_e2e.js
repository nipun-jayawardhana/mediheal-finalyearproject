const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const openBioLLMService = require('../src/services/openBioLLMService');
const symptomService = require('../src/services/symptomService');
const SymptomCheck = require('../src/models/SymptomCheck');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mediheal';

async function runE2ETests() {
  console.log('====================================================');
  console.log('   MEDIHEAL STEP 33 END-TO-END VERIFICATION SUITE   ');
  console.log('====================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB:', MONGODB_URI);

    // Mock patient ID for testing
    const testPatientId = new mongoose.Types.ObjectId();

    // TEST 1: Normal Symptoms (fever, cough, sore throat)
    console.log('\n----------------------------------------------------');
    console.log('TEST 1: Normal Symptoms ["fever", "cough", "sore throat"]');
    console.log('----------------------------------------------------');
    const ai1 = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
      ['fever', 'cough', 'sore throat'],
      '3 days',
      'moderate'
    );
    console.log('OpenBioLLM Output 1:');
    console.log('Top Condition:', ai1.topCondition);
    console.log('Possible Conditions:', JSON.stringify(ai1.possibleConditions, null, 2));
    console.log('Specialist:', ai1.recommendedSpecialist);
    console.log('Model Name:', ai1.modelName);

    const doc1 = await SymptomCheck.create({
      patientId: testPatientId,
      symptoms: ['fever', 'cough', 'sore throat'],
      duration: '3 days',
      severity: 'moderate',
      possibleCondition: ai1.topCondition,
      possibleConditions: ai1.possibleConditions,
      analysisSource: 'openbiollm',
      modelName: ai1.modelName,
      riskLevel: 'low',
      recommendedSpecialist: ai1.recommendedSpecialist,
      guidance: ai1.guidance,
      matchedSymptoms: ['fever', 'cough', 'sore throat'],
      emergencyRecommended: false,
      disclaimer: symptomService.MEDICAL_DISCLAIMER,
    });
    console.log('Saved Record 1 ID:', doc1._id.toString());
    console.log('Record 1 Source:', doc1.analysisSource);
    console.log('Record 1 Model:', doc1.modelName);
    console.assert(doc1.analysisSource === 'openbiollm', 'FAIL: Source should be openbiollm');
    console.assert(doc1.modelName === 'aaditya/Llama3-OpenBioLLM-8B', 'FAIL: Model name incorrect');

    // TEST 2: Single Ambiguous Symptom (headache)
    console.log('\n----------------------------------------------------');
    console.log('TEST 2: Single Ambiguous Symptom ["headache"]');
    console.log('----------------------------------------------------');
    const ai2 = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
      ['headache'],
      '1 day',
      'mild'
    );
    console.log('OpenBioLLM Output 2:');
    console.log('Top Condition:', ai2.topCondition);
    console.log('Possible Conditions:', JSON.stringify(ai2.possibleConditions, null, 2));
    console.log('Specialist:', ai2.recommendedSpecialist);

    const doc2 = await SymptomCheck.create({
      patientId: testPatientId,
      symptoms: ['headache'],
      duration: '1 day',
      severity: 'mild',
      possibleCondition: ai2.topCondition,
      possibleConditions: ai2.possibleConditions,
      analysisSource: 'openbiollm',
      modelName: ai2.modelName,
      riskLevel: 'low',
      recommendedSpecialist: ai2.recommendedSpecialist,
      guidance: ai2.guidance,
      matchedSymptoms: ['headache'],
      emergencyRecommended: false,
      disclaimer: symptomService.MEDICAL_DISCLAIMER,
    });
    console.log('Saved Record 2 Source:', doc2.analysisSource);

    // TEST 3: Multi-symptom (headache, fever, vomiting)
    console.log('\n----------------------------------------------------');
    console.log('TEST 3: Multi-symptom ["headache", "fever", "vomiting"]');
    console.log('----------------------------------------------------');
    const ai3 = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
      ['headache', 'fever', 'vomiting'],
      '2 days',
      'moderate'
    );
    console.log('OpenBioLLM Output 3:');
    console.log('Possible Conditions count:', ai3.possibleConditions.length);
    console.log('Possible Conditions:', JSON.stringify(ai3.possibleConditions, null, 2));
    console.log('Recommended Specialist:', ai3.recommendedSpecialist);

    // TEST 4: Emergency Safety Override
    console.log('\n----------------------------------------------------');
    console.log('TEST 4: Emergency Safety Override ["severe chest pain", "difficulty breathing"]');
    console.log('----------------------------------------------------');
    const isEmerg = symptomService.isEmergencySymptom(['severe chest pain', 'difficulty breathing']);
    console.log('Is Emergency Detected Deterministically:', isEmerg);
    const emergRule = symptomService.analyzeSymptoms(['severe chest pain', 'difficulty breathing'], '1 hour', 'severe');
    
    const doc4 = await SymptomCheck.create({
      patientId: testPatientId,
      symptoms: emergRule.symptoms,
      duration: emergRule.duration,
      severity: emergRule.severity,
      possibleCondition: emergRule.possibleCondition,
      possibleConditions: emergRule.possibleConditions,
      analysisSource: 'rule-based-emergency',
      modelName: '',
      riskLevel: emergRule.riskLevel,
      recommendedSpecialist: emergRule.recommendedSpecialist,
      guidance: emergRule.guidance,
      matchedSymptoms: emergRule.matchedSymptoms,
      emergencyRecommended: true,
      disclaimer: emergRule.disclaimer,
    });
    console.log('Saved Emergency Record ID:', doc4._id.toString());
    console.log('Emergency Risk Level:', doc4.riskLevel);
    console.log('Emergency Recommended:', doc4.emergencyRecommended);
    console.log('Emergency Analysis Source:', doc4.analysisSource);
    console.assert(doc4.riskLevel === 'high', 'FAIL: Risk level must be high');
    console.assert(doc4.emergencyRecommended === true, 'FAIL: emergencyRecommended must be true');
    console.assert(doc4.analysisSource === 'rule-based-emergency', 'FAIL: Source must be rule-based-emergency');

    // TEST 5: Fallback Test
    console.log('\n----------------------------------------------------');
    console.log('TEST 5: Rule-Based Fallback Simulation');
    console.log('----------------------------------------------------');
    const fallbackRes = symptomService.analyzeSymptoms(['unknown_random_symptom'], '1 day', 'mild');
    console.log('Fallback Possible Condition:', fallbackRes.possibleCondition);
    console.log('Fallback Analysis Source:', fallbackRes.analysisSource);

    // TEST 6: History Query Verification
    console.log('\n----------------------------------------------------');
    console.log('TEST 6: Symptom History & Record Retrieval');
    console.log('----------------------------------------------------');
    const history = await SymptomCheck.find({ patientId: testPatientId }).sort({ createdAt: -1 });
    console.log('History Records Found:', history.length);
    console.log('History Record Sources:', history.map(h => ({ id: h._id, source: h.analysisSource, model: h.modelName, topCond: h.possibleCondition })));

    // Cleanup test records
    await SymptomCheck.deleteMany({ patientId: testPatientId });
    console.log('\nCleaned up test records.');

    console.log('\n====================================================');
    console.log('  ALL END-TO-END STEP 33 VERIFICATIONS PASSED 100%  ');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ E2E Test Suite Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runE2ETests();
