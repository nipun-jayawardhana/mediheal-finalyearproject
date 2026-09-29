require('dotenv').config();
const geminiTranslationService = require('../src/services/geminiTranslationService');

async function testTamilInput() {
  const tamilText = `எனக்கு மார்பு பகுதியில் வலி மற்றும் இறுக்கம் உள்ளது.
சில நேரங்களில் ஆழமாக சுவாசிக்கும்போது வலி அதிகமாகிறது.
மூச்சு விடுவதில் சிரமம் மற்றும் பலவீனம் உள்ளது.`;

  console.log('--- Testing Tamil Input Translation ---');
  const result = await geminiTranslationService.translateInputToCanonicalEnglish(tamilText, 'ta');
  console.log('Tamil Translation Result:', JSON.stringify(result, null, 2));
}

testTamilInput().catch(console.error);
