const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');

/**
 * Helper function to populate patient and doctor User details in appointment queries
 */
const populateAppointmentDetails = (query) => {
  return query
    .populate('patientId', 'fullName email phoneNumber preferredLanguage')
    .populate('doctorId', 'fullName email phoneNumber preferredLanguage');
};

/**
 * @desc    Create a new appointment (Patient only)
 * @route   POST /api/appointments
 * @access  Private / Patient
 */
const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, timeSlot, reason } = req.body;

    // 1. Basic validation for required fields
    if (!doctorId || !appointmentDate || !timeSlot || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: doctorId, appointmentDate, timeSlot, and reason',
      });
    }

    // 2. Validate ObjectId format for doctorId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format',
      });
    }

    // 3. Resolve doctor User and DoctorProfile
    let doctorUser = null;
    let doctorProfile = null;

    // Check if passed doctorId is a DoctorProfile ID or a User ID
    doctorProfile = await DoctorProfile.findById(doctorId);
    if (doctorProfile) {
      doctorUser = await User.findById(doctorProfile.userId);
    } else {
      doctorUser = await User.findById(doctorId);
      if (doctorUser && doctorUser.role === 'doctor') {
        doctorProfile = await DoctorProfile.findOne({ userId: doctorUser._id });
      }
    }

    // Verify doctor existence, role, and active status
    if (!doctorUser || doctorUser.role !== 'doctor' || !doctorUser.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected doctor is inactive, invalid, or does not exist',
      });
    }

    // Verify doctor availability status if profile exists
    if (doctorProfile && doctorProfile.isAvailable === false) {
      return res.status(400).json({
        success: false,
        message: 'Selected doctor is currently not available for appointments',
      });
    }

    // 4. Validate appointment date (cannot be in the past)
    const bookingDate = new Date(appointmentDate);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment date format',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingDay = new Date(bookingDate);
    bookingDay.setHours(0, 0, 0, 0);

    if (bookingDay < today) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date cannot be in the past',
      });
    }

    // 5. Check for duplicate bookings (same doctor, same date, same time slot, non-cancelled)
    const startOfDay = new Date(bookingDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(bookingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const duplicateBooking = await Appointment.findOne({
      doctorId: doctorUser._id,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      timeSlot: timeSlot.trim(),
      status: { $ne: 'cancelled' },
    });

    if (duplicateBooking) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is already booked for this time slot on the selected date',
      });
    }

    // 6. Create appointment
    const appointment = await Appointment.create({
      patientId: req.user._id,
      doctorId: doctorUser._id,
      appointmentDate: bookingDate,
      timeSlot: timeSlot.trim(),
      reason: reason.trim(),
      status: 'pending',
    });

    // 7. Populate response details
    const populatedAppointment = await populateAppointmentDetails(
      Appointment.findById(appointment._id)
    );

    return res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: populatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in patient's appointments
 * @route   GET /api/appointments/my
 * @access  Private / Patient
 */
const getMyAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { patientId: req.user._id };

    if (status) {
      filter.status = status.toLowerCase().trim();
    }

    const appointments = await populateAppointmentDetails(
      Appointment.find(filter).sort({ appointmentDate: 1, timeSlot: 1 })
    );

    return res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in doctor's assigned appointments
 * @route   GET /api/doctor/appointments
 * @access  Private / Doctor
 */
const getDoctorAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { doctorId: req.user._id };

    if (status) {
      filter.status = status.toLowerCase().trim();
    }

    const appointments = await populateAppointmentDetails(
      Appointment.find(filter).sort({ appointmentDate: 1, timeSlot: 1 })
    );

    return res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get appointment details by ID
 * @route   GET /api/appointments/:appointmentId
 * @access  Private (Patient can view own, Doctor can view assigned, Admin can view all)
 */
const getAppointmentById = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format',
      });
    }

    const appointment = await populateAppointmentDetails(
      Appointment.findById(appointmentId)
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Role-based access control check
    if (req.user.role === 'patient') {
      if (appointment.patientId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own appointments',
        });
      }
    } else if (req.user.role === 'doctor') {
      if (appointment.doctorId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view appointments assigned to you',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel an appointment (Patient only)
 * @route   PATCH /api/appointments/:appointmentId/cancel
 * @access  Private / Patient
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { cancellationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format',
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Ensure patient owns this appointment
    if (appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only cancel your own appointments',
      });
    }

    // Check status restrictions
    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be cancelled',
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled',
      });
    }

    // Update status to cancelled
    appointment.status = 'cancelled';
    appointment.cancellationReason = cancellationReason
      ? cancellationReason.trim()
      : 'Cancelled by patient';

    await appointment.save();

    const updatedAppointment = await populateAppointmentDetails(
      Appointment.findById(appointment._id)
    );

    return res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update appointment status to confirmed or completed (Doctor only)
 * @route   PATCH /api/doctor/appointments/:appointmentId/status
 * @access  Private / Doctor
 */
const updateAppointmentStatusByDoctor = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format',
      });
    }

    if (!status || !['confirmed', 'completed'].includes(status.toLowerCase().trim())) {
      return res.status(400).json({
        success: false,
        message: 'Doctors can only change status to confirmed or completed',
      });
    }

    const newStatus = status.toLowerCase().trim();

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Ensure doctor is assigned to this appointment
    if (appointment.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update appointments assigned to you',
      });
    }

    // Check status transition restrictions
    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be modified',
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled appointments cannot be updated',
      });
    }

    appointment.status = newStatus;
    await appointment.save();

    const updatedAppointment = await populateAppointmentDetails(
      Appointment.findById(appointment._id)
    );

    return res.status(200).json({
      success: true,
      message: `Appointment status updated to ${newStatus} successfully`,
      data: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAppointmentById,
  cancelAppointment,
  updateAppointmentStatusByDoctor,
};
