const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.HUGGINGFACE_API_TOKEN;

console.log('HUGGINGFACE_API_TOKEN present:', !!token);
if (token) {
  console.log('Token length:', token.length);
  console.log('Token starts with:', token.substring(0, 4));
}

const model = 'aaditya/Llama3-OpenBioLLM-8B';

// Check Model Info on HF API first
async function checkModelInfo() {
  console.log('\n=== 1. Checking Model Info on HF API ===');
  const infoUrl = `https://huggingface.co/api/models/${model}`;
  try {
    const res = await fetch(infoUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    console.log('Model Info HTTP Status:', res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      console.log('Model ID:', data.id);
      console.log('Pipeline Tag:', data.pipeline_tag);
      console.log('Tags:', data.tags ? data.tags.filter(t => t.includes('llama') || t.includes('bio') || t.includes('license') || t.includes('provider') || t.includes('inference')) : []);
      console.log('Inference Status:', data.inference);
      console.log('Disabled / Private:', data.private || data.disabled);
    } else {
      const text = await res.text();
      console.log('Model Info error response:', text.substring(0, 300));
    }
  } catch (err) {
    console.error('Model Info fetch error:', err.message);
  }
}

// Test Inference Endpoints
async function testInferenceEndpoints() {
  console.log('\n=== 2. Testing Direct Inference Endpoints ===');
  
  const endpoints = [
    `https://router.huggingface.co/hf-inference/v1/chat/completions`,
    `https://router.huggingface.co/hf-inference/models/${model}`,
    `https://api-inference.huggingface.co/models/${model}`,
  ];

  for (const url of endpoints) {
    console.log(`\nTesting URL: ${url}`);
    try {
      const isChat = url.endsWith('/chat/completions');
      const body = isChat ? {
        model: model,
        messages: [
          { role: 'system', content: 'You are a biomedical AI assistant. Return JSON.' },
          { role: 'user', content: 'Symptoms: fever, cough, sore throat. Duration: 3 days. Severity: moderate. Provide 3 possible conditions in JSON format.' }
        ],
        max_tokens: 300,
        temperature: 0.2
      } : {
        inputs: "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\nSymptoms: fever, cough, sore throat\nDuration: 3 days\nSeverity: moderate\nGenerate preliminary possible-condition guidance.<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
        parameters: { max_new_tokens: 300 }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      console.log('HTTP Status:', res.status, res.statusText);
      const text = await res.text();
      console.log('Response body (first 400 chars):', text.substring(0, 400));
    } catch (err) {
      console.error('Fetch error for', url, ':', err.message);
    }
  }
}

async function main() {
  await checkModelInfo();
  await testInferenceEndpoints();
}

main();
