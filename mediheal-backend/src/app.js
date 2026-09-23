const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const adminRoutes = require('./routes/adminRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const caregiverRoutes = require('./routes/caregiverRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const medicationScheduleRoutes = require('./routes/medicationScheduleRoutes');
const medicationAnalyticsRoutes = require('./routes/medicationAnalyticsRoutes');
const symptomRoutes = require('./routes/symptomRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const communityRoutes = require('./routes/communityRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const emergencyProfileRoutes = require('./routes/emergencyProfileRoutes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) - permissive for local / mobile dev
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept'],
    credentials: false,
  })
);
app.options('*', cors());

// Enable JSON body parsing for incoming requests
app.use(express.json());

// Enable URL-encoded request body parsing
app.use(express.urlencoded({ extended: true }));

// Register Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/caregiver', caregiverRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/community', communityRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', consultationRoutes);
app.use('/api', medicationRoutes);
app.use('/api', prescriptionRoutes);
app.use('/api', medicationScheduleRoutes);
app.use('/api', medicationAnalyticsRoutes);
app.use('/api/emergency-profile', emergencyProfileRoutes);
app.use('/api/notifications', notificationRoutes);

// Centralized 404 handler for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
