const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function discoverGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing Gemini API key...');
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found in process.env');
    return;
  }

  // 1. Try v1beta models endpoint
  const urlV1Beta = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(urlV1Beta);
    const data = await res.json();
    console.log('v1beta Models Response:', JSON.stringify(data, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('v1beta error:', err.message);
  }

  // 2. Try v1 models endpoint
  const urlV1 = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  try {
    const res = await fetch(urlV1);
    const data = await res.json();
    console.log('v1 Models Response:', JSON.stringify(data, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('v1 error:', err.message);
  }

  // 3. Try header x-goog-api-key
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': apiKey },
    });
    const data = await res.json();
    console.log('Header x-goog-api-key Response:', JSON.stringify(data, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('Header error:', err.message);
  }
}

discoverGeminiModels();
