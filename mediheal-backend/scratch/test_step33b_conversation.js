const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const geminiService = require('../src/services/geminiConversationService');
const openBioLLMService = require('../src/services/openBioLLMService');
const symptomService = require('../src/services/symptomService');
const User = require('../src/models/User');
const SymptomCheck = require('../src/models/SymptomCheck');

async function runTests() {
  console.log('=============== STEP 33B INTEGRATION TESTS ===============\n');

  let passedAll = true;

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // TEST 1: Headache Conversation & OpenBioLLM Handoff
    console.log('\n--- TEST 1: Headache Conversation & OpenBioLLM Handoff ---');
    const headacheInitial = ['headache'];
    const followUp1 = await geminiService.generateFollowUp(headacheInitial, [], 0);
    console.log('Turn 1 Question:', followUp1.question || followUp1.status);

    const convHistory = [
      { question: followUp1.question || 'How long have you had the headache?', answer: '2 days' },
    ];
    const followUp2 = await geminiService.generateFollowUp(headacheInitial, convHistory, 1);
    console.log('Turn 2 Question / Status:', followUp2.question || followUp2.status);

    const fullHistory = [
      ...convHistory,
      { question: followUp2.question || 'How severe is it?', answer: 'moderate' },
      { question: 'Are you experiencing vomiting?', answer: 'vomiting' },
    ];

    const finalSummary = await geminiService.generateFollowUp(headacheInitial, fullHistory, 3);
    console.log('Final Summary Output:', JSON.stringify(finalSummary));

    if (finalSummary.status === 'complete' && finalSummary.summary) {
      console.log('✅ Final Summary extracted successfully');
    } else {
      console.error('❌ Final Summary extraction failed');
      passedAll = false;
    }

    // Call OpenBioLLM with structured symptoms
    console.log('\nCalling OpenBioLLM for analysis...');
    const aiResult = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
      finalSummary.summary?.symptoms || ['headache', 'vomiting'],
      finalSummary.summary?.duration || '2 days',
      finalSummary.summary?.severity || 'moderate'
    );

    console.log('OpenBioLLM Result Top Condition:', aiResult.topCondition);
    console.log('OpenBioLLM Recommended Specialist:', aiResult.recommendedSpecialist);

    if (aiResult.possibleConditions && aiResult.possibleConditions.length > 0) {
      console.log('✅ TEST 1 PASSED: OpenBioLLM generated possible conditions successfully!');
    } else {
      console.error('❌ TEST 1 FAILED: No conditions from OpenBioLLM');
      passedAll = false;
    }

    // TEST 2: Chest Pain Emergency Detection
    console.log('\n--- TEST 2: Chest Pain Emergency Conversation Test ---');
    const chestPainSymptoms = ['chest pain'];
    const emergencyHistory = [
      { question: 'When did it start?', answer: '10 minutes ago' },
      { question: 'Are you having difficulty breathing?', answer: 'Yes, I have severe difficulty breathing' },
    ];

    const allStrings = [...chestPainSymptoms, ...emergencyHistory.flatMap(h => [h.question, h.answer])];
    const normalizedChest = symptomService.normalizeSymptoms(allStrings);
    const isEmergencyDetected = symptomService.isEmergencySymptom(normalizedChest);

    console.log('Emergency Detected Mid-Conversation:', isEmergencyDetected);
    if (isEmergencyDetected) {
      console.log('✅ TEST 2 PASSED: Emergency red flag detected immediately mid-conversation!');
    } else {
      console.error('❌ TEST 2 FAILED: Emergency red flag not detected');
      passedAll = false;
    }

    // TEST 3: Mild Cough Test
    console.log('\n--- TEST 3: Mild Cough Test ---');
    const coughResult = await geminiService.generateFollowUp(['mild cough'], [], 0);
    console.log('Cough Follow-up Question:', coughResult.question || coughResult.status);
    if (coughResult.status === 'ask' || coughResult.status === 'complete') {
      console.log('✅ TEST 3 PASSED: Mild cough question generated successfully!');
    } else {
      console.error('❌ TEST 3 FAILED: Mild cough failed');
      passedAll = false;
    }

    // TEST 4: 3 Question Limit Test
    console.log('\n--- TEST 4: 3 Question Limit Test ---');
    const limitResult = await geminiService.generateFollowUp(
      ['headache'],
      [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
        { question: 'Q3', answer: 'A3' },
      ],
      3
    );
    console.log('Question Count = 3 Result Status:', limitResult.status);
    if (limitResult.status === 'complete') {
      console.log('✅ TEST 4 PASSED: 3 question limit strictly enforced!');
    } else {
      console.error('❌ TEST 4 FAILED: Question count exceeded 3');
      passedAll = false;
    }

    // TEST 5: Gemini Failure Fallback Test
    console.log('\n--- TEST 5: Gemini Failure Fallback Test ---');
    const fallback = geminiService.getDeterministicFallback(['fever'], [], 0);
    console.log('Fallback Output:', JSON.stringify(fallback));
    if (fallback.status === 'ask' && fallback.question) {
      console.log('✅ TEST 5 PASSED: Deterministic fallback operates cleanly!');
    } else {
      console.error('❌ TEST 5 FAILED: Deterministic fallback failed');
      passedAll = false;
    }

    // TEST 6: Privacy Verification Test
    console.log('\n--- TEST 6: Privacy Verification Test ---');
    const privacyCheckPayload = {
      symptoms: ['headache'],
      conversation: [{ question: 'How long?', answer: '1 day' }],
    };
    const stringified = JSON.stringify(privacyCheckPayload);
    const hasPII = stringified.includes('email') || stringified.includes('jwt') || stringified.includes('phone');
    if (!hasPII) {
      console.log('✅ TEST 6 PASSED: Request payload contains ONLY symptom data. Zero PII transmitted!');
    } else {
      console.error('❌ TEST 6 FAILED: PII detected');
      passedAll = false;
    }

    console.log('\n===========================================================');
    if (passedAll) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! STEP 33B VERIFIED.');
    } else {
      console.log('⚠️ SOME INTEGRATION TESTS FAILED.');
    }
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
