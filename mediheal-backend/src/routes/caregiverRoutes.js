const express = require('express');
const {
  linkPatient,
  getLinkedPatients,
  getPatientDetailsForCaregiver,
  removeCaregiverLink,
} = require('../controllers/caregiverController');
const { getCaregiverEmergencyAlerts } = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply authentication & caregiver role middleware to all routes
router.use(protect);
router.use(authorize('caregiver'));

// Caregiver Endpoints
router.post('/link', linkPatient);
router.get('/patients', getLinkedPatients);
router.get('/emergency-alerts', getCaregiverEmergencyAlerts);
router.get('/patients/:patientId', getPatientDetailsForCaregiver);
router.delete('/patients/:patientId/link', removeCaregiverLink);

module.exports = router;
