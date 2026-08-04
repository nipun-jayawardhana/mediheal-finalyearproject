const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable validation function.
 * Ensures required environment variables are defined before starting the app.
 */
const validateEnv = () => {
  const requiredEnvVars = ['PORT', 'MONGODB_URI'];
  const missing = [];

  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    console.error(`❌ [ENV ERROR] Missing required environment variables: ${missing.join(', ')}`);
    console.error(`👉 Please check your .env file or copy .env.example to .env.`);
    process.exit(1);
  }

  console.log('✅ [ENV SETUP] Environment variables validated successfully.');
};

module.exports = { validateEnv };
