const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testCandidateModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const candidates = [
    'gemini-3.6-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-flash',
  ];

  for (const modelName of candidates) {
    console.log(`\nTesting model candidate: ${modelName}...`);
    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: 'Return only this JSON: {"status":"ask","question":"How long have you had the headache?","field":"duration"}',
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: 'application/json',
      },
    };

    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`[GEMINI SERVICE] Selected model: ${modelName}`);
        console.log('[GEMINI SERVICE] Raw Response Text:', text);
        console.log('[GEMINI SERVICE] generateContent test: PASS');
        return modelName;
      } else {
        const errText = await res.text();
        console.log(`Model ${modelName} returned HTTP ${res.status}: ${errText.substring(0, 150)}`);
      }
    } catch (err) {
      console.error(`Model ${modelName} error:`, err.message);
    }
  }
}

testCandidateModels();
