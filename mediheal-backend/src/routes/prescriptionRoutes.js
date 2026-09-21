const express = require('express');
const {
  createPrescription,
  getMyPrescriptions,
  getPrescriptionById,
} = require('../controllers/prescriptionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply authentication middleware
router.use(protect);

// --- Doctor Prescription Endpoints ---
router.post('/prescriptions', authorize('doctor'), createPrescription);

// --- Patient Prescription Endpoints ---
router.get('/prescriptions/my', authorize('patient'), getMyPrescriptions);

// --- General Single Prescription Endpoint ---
router.get('/prescriptions/:prescriptionId', getPrescriptionById);

module.exports = router;
