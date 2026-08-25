const path = require('path');
require(path.join(__dirname, '../mediheal-backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../mediheal-backend/.env') });

const clinicalCaseService = require('../mediheal-backend/src/services/clinicalCaseService');
const geminiTranslationService = require('../mediheal-backend/src/services/geminiTranslationService');

async function runExtractionTest() {
  console.log('=== TEST 1: SINHALA COMPLEX CASE EXTRACTION ===');

  const sinhalaInput = "පසුගිය දින තුන තුළ මට උණ, හිසරදය, තෙහෙට්ටුව සහ ගිලීමේ අපහසුතා සමඟ වේදනාකාරී උගුරේ අමාරුවක් තිබුණා, මගේ බෙල්ලේ ඉදිමුණු ග්රන්ථි සහ මගේ උගුරේ පිටුපස සුදු ලප කිහිපයක් මම දැක තිබෙනවා.";

  console.log('Raw Sinhala Input:\n', sinhalaInput);

  // 1. Translation step
  const translated = await geminiTranslationService.translateInputToCanonicalEnglish(sinhalaInput, 'si');
  console.log('\nTranslation Output:');
  console.log('Detected Language:', translated.detectedLanguage);
  console.log('English Text:', translated.englishText);
  console.log('Extracted Concepts:', translated.symptomConcepts);
  console.log('Extracted Duration:', translated.duration);

  // 2. Canonical Case Assembly
  const parsedDuration = translated.duration || clinicalCaseService.extractDurationFromText(sinhalaInput);

  const clinicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: translated.symptomConcepts,
    duration: parsedDuration,
    severity: null,
  });

  console.log('\n[CLINICAL CASE] Output:');
  console.log('Positive Symptoms:');
  console.log(clinicalCase.positiveSymptoms.join(' |\n'));
  console.log('Duration:', clinicalCase.duration);
  console.log('Severity:', clinicalCase.severity || 'not explicitly rated');

  const requiredSymptoms = [
    'painful sore throat',
    'fever',
    'headache',
    'fatigue',
    'difficulty swallowing',
    'swollen neck glands',
    'white patches at back of throat',
  ];

  const missing = requiredSymptoms.filter(req => !clinicalCase.positiveSymptoms.some(s => s.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(s.toLowerCase())));

  console.log('\nVerification:');
  console.log('Duration "3 days" matched:', clinicalCase.duration === '3 days' ? 'PASS' : `FAIL (${clinicalCase.duration})`);
  console.log('All 7 positive symptoms preserved:', missing.length === 0 ? 'PASS' : `FAIL (missing: ${missing.join(', ')})`);
}

runExtractionTest().catch(console.error);
