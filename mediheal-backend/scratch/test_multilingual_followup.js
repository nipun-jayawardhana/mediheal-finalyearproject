require('dotenv').config();
const assert = require('assert');
const { handleFollowUp } = require('../src/controllers/symptomController');

// Mock Express req and res
function mockReqRes(body) {
  const req = {
    body,
    user: { _id: 'test_patient_123' },
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };
  const next = (err) => {
    if (err) throw err;
  };
  return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
}

async function testMultilingual() {
  console.log('Testing Multilingual Follow-Up with Groq fallback active...');

  // Force Gemini failure to test Groq in Sinhala
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'invalid_key';

  try {
    const { req, res, getResult } = mockReqRes({
      symptoms: ['හිසරදය'], // Sinhala: Headache
      conversation: [],
      questionCount: 0,
      language: 'si',
    });

    await handleFollowUp(req, res, () => {});
    const out = getResult();
    console.log('Sinhala status:', out.status);
    console.log('Sinhala question:', out.data?.data?.question);
    console.log('Sinhala canonicalQuestion:', out.data?.data?.canonicalQuestion);
    console.log('Sinhala clinicalConcept:', out.data?.data?.clinicalConcept);
    console.log('Sinhala quickOptions:', out.data?.data?.quickOptions);
    assert(out.status === 200, 'Status should be 200');
    assert(out.data?.data?.question, 'Should have translated question');
    console.log('✅ Sinhala follow-up with Groq fallback verified successfully!');
  } finally {
    process.env.GEMINI_API_KEY = origKey;
  }
}

testMultilingual().catch(console.error);
