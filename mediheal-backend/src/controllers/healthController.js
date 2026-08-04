const mongoose = require('mongoose');

/**
 * Health check controller function.
 * Returns server status, current timestamp, and database connection state.
 */
const getHealthStatus = (req, res) => {
  const dbStateMap = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
  };

  const dbState = mongoose.connection.readyState;

  res.status(200).json({
    success: true,
    message: 'MediHeal Backend API is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStateMap[dbState] || 'Unknown',
      connected: dbState === 1,
    },
  });
};

module.exports = { getHealthStatus };
