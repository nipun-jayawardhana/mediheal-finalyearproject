require('dotenv').config();

const key = process.env.GROQ_API_KEY;

async function testGroq() {
  const prompt = 'The patient reported knee pain for 2 days. Generate ONE follow-up question. Respond strictly with JSON: {"question": "...", "concept": "...", "quickOptions": ["Yes", "No"]}';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: 'You are a clinical follow-up assistant. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  const d = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', d.choices?.[0]?.message?.content);
}

testGroq().catch(console.error);
