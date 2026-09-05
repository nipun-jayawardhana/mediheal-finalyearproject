const fs = require('fs');
const path = require('path');

const langs = ['en', 'si', 'ta'];
const requiredKeys = ['signOut', 'signOutConfirmTitle', 'signOutConfirmMsg', 'cancel'];

console.log('=== VERIFYING I18N LOGOUT KEYS ===');
for (const lang of langs) {
  const filePath = path.join(__dirname, '../mediheal-mobile/src/i18n', `${lang}.ts`);
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`\n--- ${lang.toUpperCase()} ---`);
  for (const key of requiredKeys) {
    const regex = new RegExp(`${key}\\s*:\\s*(['"][^'"]+['"])`);
    const match = content.match(regex);
    if (!match) {
      console.error(`❌ Missing key ${key} in ${lang}`);
      process.exit(1);
    }
    console.log(`✅ ${key}: ${match[1]}`);
  }
}
console.log('\n🎉 ALL LOGOUT CONFIRMATION I18N KEYS VERIFIED SUCCESSFULLY!');
