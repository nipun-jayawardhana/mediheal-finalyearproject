const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.HUGGINGFACE_API_TOKEN;
const model = 'aaditya/Llama3-OpenBioLLM-8B';
const url = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';

async function testPrompt(symptomsText, durationText, severityText) {
  console.log(`\n========================================`);
  console.log(`Testing Symptoms: ${symptomsText} | Duration: ${durationText} | Severity: ${severityText}`);
  console.log(`========================================`);

  const systemMessage = `You are OpenBioLLM, a specialized biomedical AI assistant for preliminary symptom analysis.
Your task is to analyze patient symptoms and return a JSON object with possible medical conditions, a recommended medical specialist, and general healthcare guidance steps.

Strict Rules:
- Return ONLY valid JSON. No conversational preamble, no markdown formatting.
- "possibleConditions" MUST be an array of up to 3 objects, each with "condition" (the name of a real medical condition) and "confidence" ("high", "medium", or "low").
- "recommendedSpecialist" MUST be ONE of: "General Physician", "Cardiologist", "Dermatologist", "Gastroenterologist", "ENT Specialist", "Orthopedic Specialist", "Neurologist", "Psychiatrist".
- "guidance" MUST be an array of 2-3 safe general self-care recommendations.
- Do NOT prescribe specific prescription medications or claim a definitive diagnosis.`;

  const userMessage = `Patient Symptoms: ${symptomsText}
Duration: ${durationText}
Severity: ${severityText}

JSON Output:`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.2,
    max_tokens: 350
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('HTTP Status:', res.status, res.statusText);
    const text = await res.text();
    if (res.status === 200) {
      const json = JSON.parse(text);
      const content = json.choices?.[0]?.message?.content;
      console.log('RAW CONTENT GENERATED:\n', content);
      return content;
    } else {
      console.log('Error Body:', text);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function runAllTests() {
  await testPrompt('fever, cough, sore throat', '3 days', 'moderate');
  await new Promise(r => setTimeout(r, 2000));
  await testPrompt('headache', '1 day', 'mild');
  await new Promise(r => setTimeout(r, 2000));
  await testPrompt('headache, fever, vomiting', '2 days', 'moderate');
}

runAllTests();
