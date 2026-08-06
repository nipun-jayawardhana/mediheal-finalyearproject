const express = require('express');
const {
  addMedication,
  getPatientMedicationsCaregiver,
  updateMedication,
  deactivateMedication,
  getPatientMedicationLogsCaregiver,
  getMyMedications,
  markDoseTaken,
  getMyMedicationLogs,
} = require('../controllers/medicationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply global authentication middleware
router.use(protect);

// --- Patient Medication Endpoints ---
router.get('/medications/my', authorize('patient'), getMyMedications);
router.get('/medications/my/logs', authorize('patient'), getMyMedicationLogs);
router.post('/medications/:medicationId/taken', authorize('patient'), markDoseTaken);

// --- Caregiver Medication Endpoints ---
router.post('/medications', authorize('caregiver'), addMedication);
router.get('/medications/patient/:patientId', authorize('caregiver'), getPatientMedicationsCaregiver);
router.put('/medications/:medicationId', authorize('caregiver'), updateMedication);
router.delete('/medications/:medicationId', authorize('caregiver'), deactivateMedication);
router.get('/medications/patient/:patientId/logs', authorize('caregiver'), getPatientMedicationLogsCaregiver);

module.exports = router;
