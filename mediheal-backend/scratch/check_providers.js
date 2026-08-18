const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.HUGGINGFACE_API_TOKEN;
const model = 'aaditya/Llama3-OpenBioLLM-8B';

async function checkModelCardAndProviders() {
  console.log('=== Checking HF Model Details & Inference Config ===');
  const url = `https://huggingface.co/api/models/${model}?expand[]=inferenceProviderMapping&expand[]=siblings`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('Inference Provider Mapping:', JSON.stringify(data.inferenceProviderMapping || {}, null, 2));
    console.log('Widget Data / Inference config:', JSON.stringify(data.widgetData || data.config || {}, null, 2));
    
    // Also test router endpoints for specific providers if available
    // e.g. https://router.huggingface.co/featherless/v1/chat/completions
    // or https://router.huggingface.co/together/v1/chat/completions
    // or https://router.huggingface.co/sambanova/v1/chat/completions
    // or https://router.huggingface.co/novita/v1/chat/completions
    // or https://router.huggingface.co/hyperbolic/v1/chat/completions
    // or https://router.huggingface.co/deepinfra/v1/chat/completions
    // or https://router.huggingface.co/nebius/v1/chat/completions
    // or https://router.huggingface.co/fal-ai/v1/chat/completions
    
    const providers = ['featherless', 'together', 'sambanova', 'novita', 'hyperbolic', 'deepinfra', 'nebius', 'fal-ai', 'hf-inference', 'groq', 'cerebras', 'replicate'];
    console.log('\n--- Testing Router Providers ---');
    for (const p of providers) {
      const pUrl = `https://router.huggingface.co/${p}/v1/chat/completions`;
      try {
        const pRes = await fetch(pUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10
          })
        });
        const text = await pRes.text();
        console.log(`Provider [${p}] status:`, pRes.status, pRes.statusText, '| body:', text.substring(0, 150));
      } catch (e) {
        console.log(`Provider [${p}] fetch error:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkModelCardAndProviders();
