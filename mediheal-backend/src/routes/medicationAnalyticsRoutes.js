const express = require('express');
const {
  getMyAdherenceAnalytics,
  getCaregiverPatientAdherenceAnalytics,
  getDoctorPatientAdherenceAnalytics,
} = require('../controllers/medicationAnalyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// 1. Patient Medication Analytics (own data only)
router.get(
  '/medication-analytics/my',
  protect,
  authorize('patient'),
  getMyAdherenceAnalytics
);

// 2. Caregiver Medication Analytics (linked patient only)
router.get(
  '/caregiver/medication-analytics/patient/:patientId',
  protect,
  authorize('caregiver'),
  getCaregiverPatientAdherenceAnalytics
);
router.get(
  '/caregivers/medication-analytics/patient/:patientId',
  protect,
  authorize('caregiver'),
  getCaregiverPatientAdherenceAnalytics
);

// 3. Doctor Medication Analytics (assigned patient only)
router.get(
  '/doctor/patients/:patientId/medication-analytics',
  protect,
  authorize('doctor'),
  getDoctorPatientAdherenceAnalytics
);

module.exports = router;
