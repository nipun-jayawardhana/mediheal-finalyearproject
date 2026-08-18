const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line) => {
    const parts = line.split('=');
    if (parts.length > 0 && parts[0].trim()) {
      console.log('KEY NAME:', parts[0].trim(), '| Has Value:', parts.slice(1).join('=').trim().length > 0);
    }
  });
} else {
  console.log('.env file not found');
}
