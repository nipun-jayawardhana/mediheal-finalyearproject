const express = require('express');
const {
  linkPatient,
  getLinkedPatients,
  getPatientDetailsForCaregiver,
  removeCaregiverLink,
} = require('../controllers/caregiverController');
const {
  getCaregiverEmergencyAlerts,
  getCaregiverEmergencyAlertHealthSummary,
} = require('../controllers/emergencyController');
const {
  getCaregiverMissedMedications,
  getCaregiverPatientTodayMedications,
} = require('../controllers/caregiverMedicationController');
const {
  getCaregiverPatientAdherenceAnalytics,
} = require('../controllers/medicationAnalyticsController');
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
router.get('/emergency-alerts/:alertId/health-summary', getCaregiverEmergencyAlertHealthSummary);
router.get('/patients/:patientId', getPatientDetailsForCaregiver);
router.delete('/patients/:patientId/link', removeCaregiverLink);

// Medication Monitoring (Phase 3 & Phase 6)
router.get('/medications/missed', getCaregiverMissedMedications);
router.get('/medications/patient/:patientId/today', getCaregiverPatientTodayMedications);
router.get('/medication-analytics/patient/:patientId', getCaregiverPatientAdherenceAnalytics);

module.exports = router;
