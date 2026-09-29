require('dotenv').config();
const geminiTranslationService = require('../src/services/geminiTranslationService');

async function testSinhalaInput() {
  const sinhalaText = `මගේ පපුව ප්රදේශයේ වේදනාවක් සහ තද බවක් දැනෙනවා. 
සමහර විට චලනය වන විට හෝ ගැඹුරු හුස්මක් ගන්නා විට එය වැඩි වෙනවා. 
හුස්ම ගැනීමේ අපහසුතාව, දහඩිය දැමීම සහ දුර්වල බවක් දැනෙනවා.`;

  console.log('--- Testing Sinhala Input Translation ---');
  const result = await geminiTranslationService.translateInputToCanonicalEnglish(sinhalaText, 'si');
  console.log('Translation Result:', JSON.stringify(result, null, 2));
}

testSinhalaInput().catch(console.error);
