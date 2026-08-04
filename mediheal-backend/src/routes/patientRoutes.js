const express = require('express');
const {
  createPatientProfile,
  getPatientProfile,
  updatePatientProfile,
  getPatientDashboard,
} = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Protect all patient routes: Requires authentication and 'patient' role
router.use(protect);
router.use(authorize('patient'));

// Patient Profile Endpoints
router.post('/profile', createPatientProfile);
router.get('/profile', getPatientProfile);
router.put('/profile', updatePatientProfile);

// Patient Dashboard Endpoint
router.get('/dashboard', getPatientDashboard);

module.exports = router;
