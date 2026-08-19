const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function queryAndTestModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found in environment');
    return;
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  console.log('Querying Google Models/ListModels API...');
  
  const res = await fetch(listUrl);
  const data = await res.json();

  if (!data.models || !Array.isArray(data.models)) {
    console.error('Failed to list models:', data);
    return;
  }

  const validModels = data.models.filter(
    (m) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
  );

  console.log('\n--- 1. MODELS SUPPORTING generateContent ---');
  validModels.forEach((m) => {
    const cleanName = m.name.replace('models/', '');
    console.log(`[GEMINI MODELS] ${cleanName} supports generateContent`);
  });

  console.log('\n--- 2. TESTING CANDIDATE TEXT MODELS ---');
  const candidateModels = validModels
    .map((m) => m.name.replace('models/', ''))
    .filter(
      (name) =>
        !name.includes('embedding') &&
        !name.includes('tts') &&
        !name.includes('image') &&
        !name.includes('veo') &&
        !name.includes('aqa') &&
        !name.includes('audio') &&
        !name.includes('live') &&
        !name.includes('robotics')
    );

  const results = [];

  for (const modelName of candidateModels) {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              text: 'Respond ONLY with a JSON object: {"status": "ask", "question": "How long have you had the headache?", "field": "duration"}',
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100,
        responseMimeType: 'application/json',
      },
    };

    try {
      const start = Date.now();
      const testRes = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const durationMs = Date.now() - start;

      if (testRes.ok) {
        const body = await testRes.json();
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`✅ [HTTP ${testRes.status}] ${modelName} (${durationMs}ms) -> SUCCESS`);
        console.log(`   Text snippet: ${text.trim().substring(0, 120)}`);
        results.push({ modelName, status: testRes.status, ok: true, text });
      } else {
        const errorText = await testRes.text();
        let shortErr = errorText;
        try {
          const parsedErr = JSON.parse(errorText);
          shortErr = parsedErr.error?.message || errorText;
        } catch (e) {}
        console.log(`❌ [HTTP ${testRes.status}] ${modelName} -> ${shortErr.substring(0, 120)}`);
        results.push({ modelName, status: testRes.status, ok: false, error: shortErr });
      }
    } catch (err) {
      console.log(`❌ [FETCH ERROR] ${modelName} -> ${err.message}`);
      results.push({ modelName, status: 0, ok: false, error: err.message });
    }
  }

  console.log('\n--- 3. SUMMARY OF WORKING MODELS ---');
  const working = results.filter((r) => r.ok);
  if (working.length > 0) {
    working.forEach((w) => console.log(`⭐ WORKING: ${w.modelName}`));
  } else {
    console.log('⚠️ NO WORKING MODELS RETURNED HTTP 200 (all return 404/429/errors)');
  }
}

queryAndTestModels();
