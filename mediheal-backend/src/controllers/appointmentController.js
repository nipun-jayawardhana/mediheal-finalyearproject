const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const {
  generateDoctorSlots,
  validateSlotAvailability,
  processAppointmentReminders,
  DAYS_OF_WEEK,
  timeToMinutes,
} = require('../services/appointmentSlotService');

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
    const { doctorId, appointmentDate, timeSlot, reason, reasonForVisit } = req.body;
    const effectiveReason = reason || reasonForVisit;

    // 1. Basic validation for required fields
    if (!doctorId || !appointmentDate || !timeSlot || !effectiveReason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: doctorId, appointmentDate, timeSlot, and reason',
      });
    }

    // Security check: Patient can only book for self
    if (req.body.patientId && req.body.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot create appointments for another patient',
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

    // 4. Validate slot availability with doctor's structured availability
    const dateStr = typeof appointmentDate === 'string' && appointmentDate.includes('T')
      ? appointmentDate.split('T')[0]
      : String(appointmentDate);

    const slotValidation = await validateSlotAvailability(doctorId, dateStr, timeSlot);
    if (!slotValidation.valid) {
      return res.status(slotValidation.statusCode || 400).json({
        success: false,
        message: slotValidation.message,
      });
    }

    const bookingDate = new Date(appointmentDate);

    // 5. Atomic check for duplicate bookings (same doctor, same date, same time slot, non-cancelled/rescheduled)
    const startOfDay = new Date(bookingDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(bookingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const duplicateBooking = await Appointment.findOne({
      doctorId: doctorUser._id,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      timeSlot: timeSlot.trim(),
      status: { $nin: ['cancelled', 'rescheduled'] },
    });

    if (duplicateBooking) {
      return res.status(409).json({
        success: false,
        message: 'Doctor is already booked for this time slot on the selected date',
      });
    }

    // 6. Create appointment (strictly for authenticated patient)
    const appointment = await Appointment.create({
      patientId: req.user._id,
      doctorId: doctorUser._id,
      appointmentDate: bookingDate,
      timeSlot: timeSlot.trim(),
      reason: effectiveReason.trim(),
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

/**
 * @desc    Get available slots for a doctor on a specific date
 * @route   GET /api/appointments/doctors/:doctorId/available-slots
 * @access  Private / Authenticated
 */
const getDoctorAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required',
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date query parameter is required (format: YYYY-MM-DD)',
      });
    }

    const includeUnavailable = req.query.includeAll === 'true' || req.query.includeUnavailable === 'true';
    const slotsResult = await generateDoctorSlots(doctorId, date, { includeUnavailable });

    return res.status(200).json(slotsResult);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reschedule an existing appointment (Patient or assigned Doctor)
 * @route   PATCH /api/appointments/:appointmentId/reschedule
 * @access  Private (Patient or Doctor)
 */
const rescheduleAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTimeSlot, newTime, reason } = req.body;
    const effectiveNewTime = (newTimeSlot || newTime || '').trim();

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format',
      });
    }

    if (!newDate || !effectiveNewTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide newDate and newTimeSlot (or newTime) for rescheduling',
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Role-based access: Patient must own, or doctor must be assigned
    const isPatient = appointment.patientId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only reschedule your own appointments',
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be rescheduled',
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled appointments cannot be rescheduled. Please book a new appointment',
      });
    }

    // Format date string for slot validation
    const dateStr = typeof newDate === 'string' && newDate.includes('T')
      ? newDate.split('T')[0]
      : String(newDate);

    // Validate new slot availability with doctor's schedule
    const slotValidation = await validateSlotAvailability(
      appointment.doctorId,
      dateStr,
      effectiveNewTime
    );

    if (!slotValidation.valid) {
      return res.status(slotValidation.statusCode || 400).json({
        success: false,
        message: slotValidation.message,
      });
    }

    // Ensure slot not booked by another active appointment
    const targetDate = new Date(newDate);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const conflictingBooking = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: appointment.doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      timeSlot: effectiveNewTime,
      status: { $nin: ['cancelled', 'rescheduled'] },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: 'Doctor is already booked for this time slot on the selected date',
      });
    }

    // Push previous booking to rescheduleHistory
    if (!appointment.rescheduleHistory) {
      appointment.rescheduleHistory = [];
    }

    appointment.rescheduleHistory.push({
      oldDate: appointment.appointmentDate,
      oldTime: appointment.timeSlot,
      newDate: targetDate,
      newTime: effectiveNewTime,
      changedBy: req.user._id,
      changedAt: new Date(),
    });

    appointment.appointmentDate = targetDate;
    appointment.timeSlot = effectiveNewTime;
    if (reason && reason.trim()) {
      appointment.reason = reason.trim();
    }

    await appointment.save();

    const updatedAppointment = await populateAppointmentDetails(
      Appointment.findById(appointment._id)
    );

    return res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get weekly availability for the logged-in doctor
 * @route   GET /api/doctor/availability
 * @access  Private / Doctor
 */
const getDoctorAvailability = async (req, res, next) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    let weeklyAvailability = doctorProfile.weeklyAvailability;
    if (!weeklyAvailability || weeklyAvailability.length === 0) {
      weeklyAvailability = [
        { dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00', enabled: true, slotDuration: 30 },
        { dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '17:00', enabled: true, slotDuration: 30 },
        { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '17:00', enabled: true, slotDuration: 30 },
        { dayOfWeek: 'Thursday', startTime: '09:00', endTime: '17:00', enabled: true, slotDuration: 30 },
        { dayOfWeek: 'Friday', startTime: '09:00', endTime: '17:00', enabled: true, slotDuration: 30 },
        { dayOfWeek: 'Saturday', startTime: '09:00', endTime: '13:00', enabled: false, slotDuration: 30 },
        { dayOfWeek: 'Sunday', startTime: '09:00', endTime: '13:00', enabled: false, slotDuration: 30 },
      ];
    }

    return res.status(200).json({
      success: true,
      data: {
        weeklyAvailability,
        defaultSlotDuration: doctorProfile.defaultSlotDuration || 30,
        availableDays: doctorProfile.availableDays,
        isAvailable: doctorProfile.isAvailable !== false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update weekly availability for doctor
 * @route   PUT /api/doctor/availability, PUT /api/doctor/:doctorId/availability
 * @access  Private / Doctor
 */
const updateDoctorAvailability = async (req, res, next) => {
  try {
    // Security check: Doctor can only update their own availability
    if (req.params.doctorId) {
      const myProfile = await DoctorProfile.findOne({ userId: req.user._id });
      const paramId = req.params.doctorId.toString();
      const isOwnUserId = paramId === req.user._id.toString();
      const isOwnProfileId = myProfile && myProfile._id.toString() === paramId;

      if (!isOwnUserId && !isOwnProfileId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own doctor availability',
        });
      }
    }

    if (req.body.doctorId) {
      const myProfile = await DoctorProfile.findOne({ userId: req.user._id });
      const bodyDocId = req.body.doctorId.toString();
      const isOwnUserId = bodyDocId === req.user._id.toString();
      const isOwnProfileId = myProfile && myProfile._id.toString() === bodyDocId;

      if (!isOwnUserId && !isOwnProfileId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own doctor availability',
        });
      }
    }

    const { weeklyAvailability, defaultSlotDuration, isAvailable } = req.body;

    let doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    if (Array.isArray(weeklyAvailability)) {
      for (const item of weeklyAvailability) {
        if (!DAYS_OF_WEEK.includes(item.dayOfWeek)) {
          return res.status(400).json({
            success: false,
            message: `Invalid day of week: ${item.dayOfWeek}`,
          });
        }

        const startMin = timeToMinutes(item.startTime);
        const endMin = timeToMinutes(item.endTime);

        if (startMin >= endMin) {
          return res.status(400).json({
            success: false,
            message: `Start time (${item.startTime}) must be earlier than end time (${item.endTime}) for ${item.dayOfWeek}`,
          });
        }

        if (item.slotDuration && ![15, 20, 30, 45, 60].includes(Number(item.slotDuration))) {
          return res.status(400).json({
            success: false,
            message: 'Invalid slot duration. Allowed: 15, 20, 30, 45, 60 minutes',
          });
        }
      }

      doctorProfile.weeklyAvailability = weeklyAvailability;
      // Sync legacy availableDays
      doctorProfile.availableDays = weeklyAvailability
        .filter((w) => w.enabled)
        .map((w) => w.dayOfWeek);
    }

    if (defaultSlotDuration && [15, 20, 30, 45, 60].includes(Number(defaultSlotDuration))) {
      doctorProfile.defaultSlotDuration = Number(defaultSlotDuration);
    }

    if (typeof isAvailable === 'boolean') {
      doctorProfile.isAvailable = isAvailable;
    }

    await doctorProfile.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor availability updated successfully',
      data: {
        weeklyAvailability: doctorProfile.weeklyAvailability,
        defaultSlotDuration: doctorProfile.defaultSlotDuration || 30,
        availableDays: doctorProfile.availableDays,
        isAvailable: doctorProfile.isAvailable,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process upcoming appointment reminders (24 hours prior)
 * @route   POST /api/appointments/reminders/process
 * @access  Private
 */
const triggerAppointmentReminders = async (req, res, next) => {
  try {
    const result = await processAppointmentReminders();
    return res.status(200).json({
      success: true,
      message: 'Appointment reminders processed successfully',
      data: result,
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
  getDoctorAvailableSlots,
  rescheduleAppointment,
  getDoctorAvailability,
  updateDoctorAvailability,
  triggerAppointmentReminders,
};
