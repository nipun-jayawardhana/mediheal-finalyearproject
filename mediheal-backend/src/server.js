// Load .env before app so services that read process.env at require time see the configured values
const { validateEnv } = require('./config/env');
const app = require('./app');
const connectDB = require('./config/db');

// 1. Validate environment variables
validateEnv();

// 2. Connect to MongoDB
connectDB();

// 3. Start Express server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 [SERVER] MediHeal Backend running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🔗 [HEALTH CHECK] http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (err) => {
  console.error(`❌ [UNHANDLED REJECTION] ${err.message}`);
  // Keep server running or gracefully close server if critical
});

module.exports = server;
