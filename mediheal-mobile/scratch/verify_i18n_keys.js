const fs = require('fs');
const path = require('path');

function extractKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/^\s*([a-zA-Z0-9_]+)\s*:/gm);
  if (!matches) return new Set();
  return new Set(
    matches.map((m) => m.replace(/:\s*$/, '').trim()).filter((k) => k !== 'export' && k !== 'import')
  );
}

const i18nDir = path.join(__dirname, '../src/i18n');
const enKeys = extractKeys(path.join(i18nDir, 'en.ts'));
const siKeys = extractKeys(path.join(i18nDir, 'si.ts'));
const taKeys = extractKeys(path.join(i18nDir, 'ta.ts'));

console.log(`Key counts: EN=${enKeys.size}, SI=${siKeys.size}, TA=${taKeys.size}`);

let missingSi = [];
let missingTa = [];

for (const key of enKeys) {
  if (!siKeys.has(key)) missingSi.push(key);
  if (!taKeys.has(key)) missingTa.push(key);
}

if (missingSi.length > 0) {
  console.error('Missing in Sinhala (si):', missingSi);
}
if (missingTa.length > 0) {
  console.error('Missing in Tamil (ta):', missingTa);
}

if (missingSi.length === 0 && missingTa.length === 0 && enKeys.size === siKeys.size && enKeys.size === taKeys.size) {
  console.log('✅ 100% Key Parity Verified across EN, SI, and TA!');
  process.exit(0);
} else {
  console.error('❌ Key parity check failed.');
  process.exit(1);
}
