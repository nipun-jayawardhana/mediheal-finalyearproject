const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.HUGGINGFACE_API_TOKEN;
const model = 'aaditya/Llama3-OpenBioLLM-8B';
const url = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';

async function testWithRetry() {
  console.log('=== Calling OpenBioLLM 8B via Featherless Provider with Retry ===');
  
  const systemPrompt = `You are an AI healthcare navigation assistant. You perform preliminary symptom analysis.
Given the patient's symptoms, duration, and severity, output JSON ONLY with up to 3 plausible possible conditions, guidance steps, and recommended specialist.
Format:
{
  "possibleConditions": [
    { "condition": "Condition Name", "confidence": "high|medium|low" }
  ],
  "recommendedSpecialist": "General Physician|Cardiologist|Dermatologist|Gastroenterologist|ENT Specialist|Orthopedic Specialist|Neurologist|Psychiatrist",
  "guidance": ["Step 1", "Step 2"]
}`;

  const userPrompt = `Symptoms: fever, cough, sore throat
Duration: 3 days
Severity: moderate`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 350
  };

  const maxRetries = 6;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n--- Attempt ${attempt}/${maxRetries} ---`);
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
      console.log('Response Body:', text);

      if (res.status === 200) {
        console.log('\nSUCCESS! Parsing response JSON...');
        const json = JSON.parse(text);
        console.log('Generated Choice Content:', json.choices?.[0]?.message?.content);
        return;
      }

      if (res.status === 503 || res.status === 429) {
        console.log('Model loading/at capacity. Waiting 6 seconds before retry...');
        await new Promise(r => setTimeout(r, 6000));
      } else {
        break;
      }
    } catch (e) {
      console.error('Request error:', e.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

testWithRetry();
