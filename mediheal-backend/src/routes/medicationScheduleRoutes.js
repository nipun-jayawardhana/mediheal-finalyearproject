const express = require('express');
const {
  getMyTodayMedicationSchedules,
  markScheduleDoseTaken,
  getMedicationHistory,
  getPatientMissedMedications,
} = require('../controllers/medicationScheduleController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply global authentication middleware
router.use(protect);

// --- Patient Medication Schedule & Tracking Endpoints ---
router.get('/medication-schedules/my', authorize('patient'), getMyTodayMedicationSchedules);
router.get('/medication-schedules/missed', authorize('patient'), getPatientMissedMedications);
router.post('/medication-schedules/:id/taken', authorize('patient'), markScheduleDoseTaken);
router.get('/medication-schedules/history', authorize('patient'), getMedicationHistory);

module.exports = router;
