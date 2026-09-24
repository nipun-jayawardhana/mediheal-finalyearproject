const express = require('express');
const {
  createAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAppointmentById,
  cancelAppointment,
  updateAppointmentStatusByDoctor,
  getDoctorAvailableSlots,
  rescheduleAppointment,
  getDoctorAvailability,
  updateDoctorAvailability,
  triggerAppointmentReminders,
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// --- Available Slots & Reminders ---
router.get('/appointments/doctors/:doctorId/available-slots', protect, getDoctorAvailableSlots);
router.post('/appointments/reminders/process', protect, triggerAppointmentReminders);

// --- Patient & Shared Appointment Endpoints ---
router.post('/appointments', protect, authorize('patient'), createAppointment);
router.get('/appointments/my', protect, authorize('patient'), getMyAppointments);
router.get('/appointments/:appointmentId', protect, getAppointmentById);
router.patch('/appointments/:appointmentId/cancel', protect, cancelAppointment);
router.patch('/appointments/:appointmentId/reschedule', protect, rescheduleAppointment);

// --- Doctor Appointment Endpoints ---
router.get('/doctor/appointments', protect, authorize('doctor'), getDoctorAppointments);
router.patch('/doctor/appointments/:appointmentId/status', protect, authorize('doctor'), updateAppointmentStatusByDoctor);

// --- Doctor Weekly Availability Management ---
router.get('/doctor/availability', protect, authorize('doctor'), getDoctorAvailability);
router.get('/doctor/:doctorId/availability', protect, getDoctorAvailability);
router.put('/doctor/availability', protect, authorize('doctor'), updateDoctorAvailability);
router.put('/doctor/:doctorId/availability', protect, authorize('doctor'), updateDoctorAvailability);

module.exports = router;
