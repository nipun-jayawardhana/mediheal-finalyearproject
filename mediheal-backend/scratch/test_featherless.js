const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.HUGGINGFACE_API_TOKEN;
const model = 'aaditya/Llama3-OpenBioLLM-8B';

async function testFeatherlessVariations() {
  console.log('=== Testing Featherless / Partner Provider URLs ===');

  const testCases = [
    {
      name: 'Router Featherless-AI Chat Completion',
      url: 'https://router.huggingface.co/featherless-ai/v1/chat/completions',
      body: {
        model: model,
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 20
      }
    },
    {
      name: 'Router Featherless Chat Completion',
      url: 'https://router.huggingface.co/featherless/v1/chat/completions',
      body: {
        model: model,
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 20
      }
    },
    {
      name: 'Router HF Inference with provider header featherless-ai',
      url: 'https://router.huggingface.co/hf-inference/v1/chat/completions',
      headers: { 'x-huggingface-provider': 'featherless-ai' },
      body: {
        model: model,
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 20
      }
    },
    {
      name: 'Router HF Inference with provider header featherless',
      url: 'https://router.huggingface.co/hf-inference/v1/chat/completions',
      headers: { 'x-huggingface-provider': 'featherless' },
      body: {
        model: model,
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 20
      }
    },
    {
      name: 'API Inference Direct with X-Wait-For-Model',
      url: `https://api-inference.huggingface.co/models/${model}`,
      headers: { 'x-wait-for-model': 'true' },
      body: {
        inputs: 'Hello world',
        parameters: { max_new_tokens: 20 }
      }
    },
    {
      name: 'Router Models Featherless-AI',
      url: `https://router.huggingface.co/featherless-ai/models/${model}`,
      body: {
        inputs: 'Hello world',
        parameters: { max_new_tokens: 20 }
      }
    }
  ];

  for (const tc of testCases) {
    console.log(`\n--- ${tc.name} ---`);
    console.log(`URL: ${tc.url}`);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(tc.headers || {})
      };
      const res = await fetch(tc.url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(tc.body)
      });
      console.log('Status:', res.status, res.statusText);
      const text = await res.text();
      console.log('Response body:', text.substring(0, 500));
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

testFeatherlessVariations();
