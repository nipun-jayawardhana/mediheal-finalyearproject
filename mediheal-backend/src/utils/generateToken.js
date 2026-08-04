const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT token for a given user ID and role.
 * @param {string} id - User MongoDB ObjectId
 * @param {string} role - User role (patient, caregiver, doctor, admin)
 * @returns {string} JWT Token
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

module.exports = generateToken;
