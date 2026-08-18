const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
let content = fs.readFileSync(envPath, 'utf8');

if (!content.includes('HUGGINGFACE_MODEL')) {
  content += '\nHUGGINGFACE_MODEL=aaditya/Llama3-OpenBioLLM-8B\n';
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('Added HUGGINGFACE_MODEL to .env');
} else {
  console.log('HUGGINGFACE_MODEL already present in .env');
}
