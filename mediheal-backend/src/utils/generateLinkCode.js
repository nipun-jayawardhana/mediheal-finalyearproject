const PatientProfile = require('../models/PatientProfile');

/**
 * Generates a unique caregiver linking code formatted as MH-XXXX (e.g. MH-8492).
 * Ensures uniqueness by checking against existing PatientProfile documents.
 * @returns {Promise<string>} Unique caregiver linking code
 */
const generateLinkCode = async () => {
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4-digit number (1000-9999)
    code = `MH-${randomDigits}`;

    // Check if code already exists in PatientProfile collection
    const existing = await PatientProfile.findOne({ caregiverLinkCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

module.exports = generateLinkCode;
