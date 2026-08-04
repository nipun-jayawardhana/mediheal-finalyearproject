/**
 * Generates a secure temporary password for newly created doctor accounts.
 * Includes uppercase, lowercase, numbers, and special characters.
 * 
 * @param {number} length - Desired length of temporary password (default: 10)
 * @returns {string} Temporary password
 */
const generateTempPassword = (length = 10) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%!';
  const allChars = upper + lower + digits + special;

  let passwordArray = [
    upper.charAt(Math.floor(Math.random() * upper.length)),
    lower.charAt(Math.floor(Math.random() * lower.length)),
    digits.charAt(Math.floor(Math.random() * digits.length)),
    special.charAt(Math.floor(Math.random() * special.length)),
  ];

  for (let i = passwordArray.length; i < length; i++) {
    passwordArray.push(allChars.charAt(Math.floor(Math.random() * allChars.length)));
  }

  // Fisher-Yates shuffle array to randomize character positions
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
};

module.exports = generateTempPassword;
