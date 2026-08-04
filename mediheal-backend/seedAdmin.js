const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./src/models/User');

// Load environment variables from .env file
dotenv.config();

/**
 * Seed script to create initial system Administrator account.
 */
const seedAdmin = async () => {
  let connection;
  try {
    const adminName = process.env.ADMIN_NAME || 'System Administrator';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mediheal.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

    if (!adminEmail || !adminPassword) {
      console.error('❌ [SEED ERROR] ADMIN_EMAIL and ADMIN_PASSWORD must be defined in environment variables.');
      process.exit(1);
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mediheal';
    connection = await mongoose.connect(mongoUri);
    console.log('✅ [SEED] Connected to MongoDB database successfully.');

    const cleanEmail = adminEmail.toLowerCase().trim();

    // Check if an admin user already exists
    const existingAdmin = await User.findOne({ email: cleanEmail });

    if (existingAdmin) {
      console.log(`ℹ️ [SEED] Admin user '${cleanEmail}' already exists in database. No action taken.`);
    } else {
      // User model pre-save hook will automatically hash adminPassword using bcryptjs
      const adminUser = await User.create({
        fullName: adminName,
        email: cleanEmail,
        phoneNumber: '+94770000000',
        password: adminPassword,
        role: 'admin',
        preferredLanguage: 'English',
        isActive: true,
      });

      console.log('🎉 [SEED] Initial Admin account created successfully:');
      console.log(`   ID: ${adminUser._id}`);
      console.log(`   Name: ${adminUser.fullName}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Role: ${adminUser.role}`);
    }
  } catch (error) {
    console.error(`❌ [SEED ERROR] Failed to seed admin user: ${error.message}`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔒 [SEED] Database connection closed gracefully.');
    }
    process.exit(0);
  }
};

seedAdmin();
