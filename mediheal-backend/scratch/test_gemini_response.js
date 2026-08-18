const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const geminiService = require('../src/services/geminiConversationService');

async function testResponse() {
  console.log('Testing gemini-3.6-flash generateFollowUp directly...');
  const res = await geminiService.generateFollowUp(['headache'], [], 0);
  console.log('Generated Follow-up Result:', JSON.stringify(res, null, 2));
}

testResponse();
