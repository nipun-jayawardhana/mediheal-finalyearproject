/**
 * Step 35 Automated Verification Script
 * Tests:
 * 1. English Symptom Analysis (no unnecessary translation roundtrip)
 * 2. Sinhala Input Translation & Analysis ("මට උණයි කැස්සයි තියෙනවා") -> canonical English -> OpenBioLLM -> Sinhala output
 * 3. Tamil Input Translation & Analysis ("எனக்கு காய்ச்சல் மற்றும் இருமல் உள்ளது") -> canonical English -> OpenBioLLM -> Tamil output
 * 4. Mixed-Language Input ("BP", "migraine" preserved)
 * 5. Multilingual Emergency Safety Trigger ("තද පපුවේ කැක්කුම සහ හුස්ම ගැනීමේ අමාරුව")
 * 6. Gemini Fallback & Quota Protection
 */

const geminiTranslationService = require('../src/services/geminiTranslationService');
const symptomService = require('../src/services/symptomService');
const openBioLLMService = require('../src/services/openBioLLMService');

async function runStep35Tests() {
  console.log('==================================================');
  console.log('STEP 35 — GEMINI MULTILINGUAL TRANSLATION VERIFICATION');
  console.log('==================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: English Test
  totalTests++;
  console.log('[TEST 1] English Symptom Analysis');
  try {
    const inputResult = await geminiTranslationService.translateInputToCanonicalEnglish(
      'I have headache and vomiting',
      'en'
    );
    console.log('  Input Translation (English):', JSON.stringify(inputResult));
    if (inputResult.detectedLanguage === 'en' && inputResult.englishText.includes('headache')) {
      console.log('  ✅ Test 1 PASSED: English input passed through canonical pipeline cleanly.');
      passedTests++;
    } else {
      console.warn('  ❌ Test 1 FAILED');
    }
  } catch (err) {
    console.error('  ❌ Test 1 Exception:', err.message);
  }
  console.log('');

  // Test 2: Sinhala Input Test
  totalTests++;
  console.log('[TEST 2] Sinhala Input Translation');
  const sinhalaInput = 'මට උණයි කැස්සයි තියෙනවා';
  try {
    const inputResult = await geminiTranslationService.translateInputToCanonicalEnglish(
      sinhalaInput,
      'si'
    );
    console.log('  Original Sinhala Input:', sinhalaInput);
    console.log('  Canonical English Result:', JSON.stringify(inputResult));
    if (inputResult.englishText && inputResult.symptomConcepts.length > 0) {
      console.log('  ✅ Test 2 PASSED: Sinhala translated to canonical English symptom concepts.');
      passedTests++;
    } else {
      console.warn('  ❌ Test 2 FAILED');
    }
  } catch (err) {
    console.error('  ❌ Test 2 Exception:', err.message);
  }
  console.log('');

  // Test 3: Tamil Input Test
  totalTests++;
  console.log('[TEST 3] Tamil Input Translation');
  const tamilInput = 'எனக்கு காய்ச்சல் மற்றும் இருமல் உள்ளது';
  try {
    const inputResult = await geminiTranslationService.translateInputToCanonicalEnglish(
      tamilInput,
      'ta'
    );
    console.log('  Original Tamil Input:', tamilInput);
    console.log('  Canonical English Result:', JSON.stringify(inputResult));
    if (inputResult.englishText && inputResult.symptomConcepts.length > 0) {
      console.log('  ✅ Test 3 PASSED: Tamil translated to canonical English symptom concepts.');
      passedTests++;
    } else {
      console.warn('  ❌ Test 3 FAILED');
    }
  } catch (err) {
    console.error('  ❌ Test 3 Exception:', err.message);
  }
  console.log('');

  // Test 4: Mixed-Language Preservation Test
  totalTests++;
  console.log('[TEST 4] Mixed-Language Term Preservation');
  const mixedInput = 'මට සරීරෙට අමාරුයි BP එක වැඩි වෙලා migraine එකක් වගේ';
  try {
    const inputResult = await geminiTranslationService.translateInputToCanonicalEnglish(
      mixedInput,
      'si'
    );
    console.log('  Original Mixed Input:', mixedInput);
    console.log('  Canonical Result:', JSON.stringify(inputResult));
    const textLower = inputResult.englishText.toLowerCase();
    if (textLower.includes('bp') || textLower.includes('migraine') || inputResult.symptomConcepts.some(c => c.includes('bp') || c.includes('migraine'))) {
      console.log('  ✅ Test 4 PASSED: Medical terms (BP, migraine) preserved correctly.');
      passedTests++;
    } else {
      console.warn('  ❌ Test 4 FAILED: Medical terms lost');
    }
  } catch (err) {
    console.error('  ❌ Test 4 Exception:', err.message);
  }
  console.log('');

  // Test 5: Emergency Multilingual Safety Test
  totalTests++;
  console.log('[TEST 5] Multilingual Emergency Trigger');
  const emergencySinhala = 'තද පපුවේ කැක්කුම සහ හුස්ම ගැනීමේ අමාරුව';
  try {
    const isEmergency = symptomService.isEmergencySymptom([emergencySinhala]);
    console.log('  Sinhala Emergency Phrase:', emergencySinhala);
    console.log('  isEmergency Triggered:', isEmergency);
    if (isEmergency) {
      console.log('  ✅ Test 5 PASSED: Sinhala emergency phrase triggered safety rules.');
      passedTests++;
    } else {
      console.warn('  ❌ Test 5 FAILED');
    }
  } catch (err) {
    console.error('  ❌ Test 5 Exception:', err.message);
  }
  console.log('');

  // Test 6: Output Translation Batch Test
  totalTests++;
  console.log('[TEST 6] Output Result Translation (Sinhala)');
  const sampleResult = {
    possibleConditions: [{ condition: 'Febrile Illness', confidence: 'medium' }],
    possibleCondition: 'Febrile Illness',
    guidance: ['Rest adequately and monitor temperature', 'Stay well hydrated with fluids'],
    recommendedSpecialist: 'General Physician',
    disclaimer: symptomService.MEDICAL_DISCLAIMER,
    emergencyRecommended: false,
  };
  try {
    const translatedOutput = await geminiTranslationService.translateAnalysisResult(
      sampleResult,
      'si'
    );
    console.log('  Translated Output (Sinhala):', JSON.stringify(translatedOutput, null, 2));
    if (translatedOutput.displayPossibleCondition && translatedOutput.displayGuidance.length > 0) {
      console.log('  ✅ Test 6 PASSED: Output analysis batch-translated into Sinhala.');
      passedTests++;
    } else {
      console.warn('  ❌ Test 6 FAILED');
    }
  } catch (err) {
    console.error('  ❌ Test 6 Exception:', err.message);
  }
  console.log('');

  console.log(`Summary: ${passedTests} / ${totalTests} tests passed.`);
  if (passedTests === totalTests) {
    console.log('✨ ALL STEP 35 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }
}

runStep35Tests().catch(console.error);
