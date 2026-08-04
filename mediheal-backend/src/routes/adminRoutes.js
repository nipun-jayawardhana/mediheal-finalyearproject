const express = require('express');
const {
  createDoctor,
  getAllDoctorsAdmin,
  getDoctorByIdAdmin,
  updateDoctorAdmin,
  updateDoctorStatus,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Protect all admin routes: Requires authentication and 'admin' role
router.use(protect);
router.use(authorize('admin'));

// Doctor Management Routes (Admin Only)
router.post('/doctors', createDoctor);
router.get('/doctors', getAllDoctorsAdmin);
router.get('/doctors/:doctorId', getDoctorByIdAdmin);
router.put('/doctors/:doctorId', updateDoctorAdmin);
router.patch('/doctors/:doctorId/status', updateDoctorStatus);

module.exports = router;
