const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Enable JSON body parsing for incoming requests
app.use(express.json());

// Enable URL-encoded request body parsing
app.use(express.urlencoded({ extended: true }));

// Register Routes
app.use('/api/health', healthRoutes);

// Centralized 404 handler for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
