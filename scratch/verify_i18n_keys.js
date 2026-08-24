const fs = require('fs');
const path = require('path');

function extractKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(/^\s*([a-zA-Z0-9_]+)\s*:/gm)];
  return new Set(matches.map((m) => m[1]));
}

function audit() {
  console.log('==================================================');
  console.log('I18N DICTIONARY COMPLETENESS AUDIT');
  console.log('==================================================\n');

  const enPath = path.join(__dirname, '..', 'mediheal-mobile', 'src', 'i18n', 'en.ts');
  const siPath = path.join(__dirname, '..', 'mediheal-mobile', 'src', 'i18n', 'si.ts');
  const taPath = path.join(__dirname, '..', 'mediheal-mobile', 'src', 'i18n', 'ta.ts');

  const enKeys = extractKeys(enPath);
  const siKeys = extractKeys(siPath);
  const taKeys = extractKeys(taPath);

  console.log(`Total English keys: ${enKeys.size}`);
  console.log(`Total Sinhala keys: ${siKeys.size}`);
  console.log(`Total Tamil keys:   ${taKeys.size}\n`);

  let missingSi = [];
  let missingTa = [];

  for (const key of enKeys) {
    if (!siKeys.has(key)) missingSi.push(key);
    if (!taKeys.has(key)) missingTa.push(key);
  }

  if (missingSi.length > 0) {
    console.warn('⚠️ Missing Sinhala Keys:', missingSi);
  } else {
    console.log('✅ Sinhala dictionary has 100% key parity with English!');
  }

  if (missingTa.length > 0) {
    console.warn('⚠️ Missing Tamil Keys:', missingTa);
  } else {
    console.log('✅ Tamil dictionary has 100% key parity with English!');
  }

  if (missingSi.length === 0 && missingTa.length === 0) {
    console.log('\n✨ ALL I18N DICTIONARIES HAVE PERFECT KEY PARITY!');
  }
}

audit();
