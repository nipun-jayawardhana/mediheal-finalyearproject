const express = require('express');
const {
  createEmergencyAlert,
  getPatientEmergencyAlerts,
  getEmergencyAlertById,
  cancelEmergencyAlert,
  resolveEmergencyAlert,
} = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply authentication to all emergency routes
router.use(protect);

// Patient routes
router.post('/', authorize('patient'), createEmergencyAlert);
router.get('/my', authorize('patient'), getPatientEmergencyAlerts);
router.patch('/:alertId/cancel', authorize('patient'), cancelEmergencyAlert);

// Shared route (patient or caregiver)
router.get('/:alertId', authorize('patient', 'caregiver'), getEmergencyAlertById);

// Caregiver route
router.patch('/:alertId/resolve', authorize('caregiver'), resolveEmergencyAlert);

module.exports = router;
