const mongoose = require('mongoose');

/**
 * Connects to MongoDB using Mongoose.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ [DATABASE] MongoDB connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ [DATABASE ERROR] MongoDB connection failed: ${error.message}`);
    console.error(`👉 Make sure MongoDB is running locally or check your MONGODB_URI in .env`);
    // Note: We do not process.exit(1) here so the server can run and return health status even if DB connection fails temporarily
  }
};

module.exports = connectDB;
