const express = require('express');
const {
  getDoctors,
  getDoctorById,
} = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Patients and authenticated users can view doctors
router.use(protect);

// Patient Doctor View Routes
router.get('/', getDoctors);
router.get('/:doctorId', getDoctorById);

module.exports = router;
