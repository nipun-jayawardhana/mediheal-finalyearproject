const express = require('express');
const {
  createAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAppointmentById,
  cancelAppointment,
  updateAppointmentStatusByDoctor,
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// --- Patient Appointment Endpoints ---
router.post('/appointments', protect, authorize('patient'), createAppointment);
router.get('/appointments/my', protect, authorize('patient'), getMyAppointments);
router.get('/appointments/:appointmentId', protect, getAppointmentById);
router.patch('/appointments/:appointmentId/cancel', protect, authorize('patient'), cancelAppointment);

// --- Doctor Appointment Endpoints ---
router.get('/doctor/appointments', protect, authorize('doctor'), getDoctorAppointments);
router.patch('/doctor/appointments/:appointmentId/status', protect, authorize('doctor'), updateAppointmentStatusByDoctor);

module.exports = router;
