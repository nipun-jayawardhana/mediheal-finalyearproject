const express = require('express');
const {
  createConsultation,
  getMyConsultations,
  getConsultationById,
  getPatientConsultationHistoryForDoctor,
} = require('../controllers/consultationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// --- Doctor Endpoints ---
router.post('/consultations', protect, authorize('doctor'), createConsultation);
router.get(
  '/doctor/patients/:patientId/history',
  protect,
  authorize('doctor'),
  getPatientConsultationHistoryForDoctor
);

// --- General / Patient Consultation Endpoints ---
router.get('/consultations/my', protect, getMyConsultations);
router.get('/consultations/:consultationId', protect, getConsultationById);

module.exports = router;
