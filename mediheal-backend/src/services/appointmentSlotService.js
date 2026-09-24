const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');
const User = require('../models/User');
const Notification = require('../models/Notification');

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Convert HH:MM time string to minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Convert minutes from midnight to HH:MM string
 */
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Parse YYYY-MM-DD date string safely in local time
 */
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
};

/**
 * Resolve doctor User and DoctorProfile by ID
 */
const resolveDoctor = async (doctorId) => {
  if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
    return { doctorUser: null, doctorProfile: null };
  }

  let doctorProfile = await DoctorProfile.findById(doctorId);
  let doctorUser = null;

  if (doctorProfile) {
    doctorUser = await User.findById(doctorProfile.userId);
  } else {
    doctorUser = await User.findById(doctorId);
    if (doctorUser && doctorUser.role === 'doctor') {
      doctorProfile = await DoctorProfile.findOne({ userId: doctorUser._id });
    }
  }

  return { doctorUser, doctorProfile };
};

/**
 * Generate valid appointment slots for a given doctor and date
 * Excludes booked slots and past slots for today
 */
const generateDoctorSlots = async (doctorId, dateString, options = {}) => {
  const { doctorUser, doctorProfile } = await resolveDoctor(doctorId);

  if (!doctorUser || doctorUser.role !== 'doctor' || !doctorUser.isActive) {
    throw new Error('Doctor profile not found or inactive');
  }

  if (doctorProfile && doctorProfile.isAvailable === false) {
    return {
      success: true,
      date: dateString,
      doctorId: doctorUser._id.toString(),
      slotDuration: 30,
      slots: [],
      message: 'Doctor is currently not accepting appointments',
    };
  }

  const bookingDate = parseLocalDate(dateString);
  if (!bookingDate) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookingDayStart = new Date(bookingDate);
  bookingDayStart.setHours(0, 0, 0, 0);

  if (bookingDayStart < today) {
    return {
      success: true,
      date: dateString,
      doctorId: doctorUser._id.toString(),
      slotDuration: 30,
      slots: [],
      message: 'Selected date is in the past',
    };
  }

  const dayOfWeek = DAYS_OF_WEEK[bookingDate.getDay()]; // e.g. "Monday"

  // Determine availability rule for this day
  let dayRule = null;
  let slotDuration = 30;

  if (doctorProfile && Array.isArray(doctorProfile.weeklyAvailability) && doctorProfile.weeklyAvailability.length > 0) {
    dayRule = doctorProfile.weeklyAvailability.find(
      (w) => w.dayOfWeek.toLowerCase() === dayOfWeek.toLowerCase()
    );
    if (doctorProfile.defaultSlotDuration) {
      slotDuration = doctorProfile.defaultSlotDuration;
    }
  }

  // Check if doctor has enabled this day
  if (dayRule) {
    if (!dayRule.enabled) {
      return {
        success: true,
        date: dateString,
        doctorId: doctorUser._id.toString(),
        slotDuration: dayRule.slotDuration || slotDuration,
        slots: [],
        message: `Doctor is not available on ${dayOfWeek}`,
      };
    }
    slotDuration = dayRule.slotDuration || slotDuration;
  } else if (doctorProfile && Array.isArray(doctorProfile.availableDays) && doctorProfile.availableDays.length > 0) {
    // Backward compatibility with legacy availableDays array
    const isLegacyAvailableDay = doctorProfile.availableDays.some(
      (d) => d.toLowerCase().trim() === dayOfWeek.toLowerCase()
    );
    if (!isLegacyAvailableDay) {
      return {
        success: true,
        date: dateString,
        doctorId: doctorUser._id.toString(),
        slotDuration,
        slots: [],
        message: `Doctor is not available on ${dayOfWeek}`,
      };
    }
  }

  const startTimeStr = dayRule?.startTime || '09:00';
  const endTimeStr = dayRule?.endTime || '17:00';

  const startMinutes = timeToMinutes(startTimeStr);
  const endMinutes = timeToMinutes(endTimeStr);

  // Generate slots from startMinutes to endMinutes
  // A slot is valid only if its start time + slotDuration <= endMinutes
  const rawSlots = [];
  for (let t = startMinutes; t + slotDuration <= endMinutes; t += slotDuration) {
    rawSlots.push(minutesToTime(t));
  }

  // Fetch already booked appointments on this date
  const startOfDay = new Date(bookingDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(bookingDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingBookings = await Appointment.find({
    doctorId: doctorUser._id,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled', 'rescheduled'] },
  });

  const bookedSlots = new Set(existingBookings.map((b) => b.timeSlot.trim()));

  // Check if date is today for past time slots filtering
  const now = new Date();
  const isToday = bookingDayStart.getTime() === today.getTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const allSlots = rawSlots.map((timeStr) => {
    const isBooked = bookedSlots.has(timeStr);
    const isPast = isToday && timeToMinutes(timeStr) <= currentMinutes;
    const available = !isBooked && !isPast;

    return {
      time: timeStr,
      available,
    };
  });

  const slots = options.includeUnavailable ? allSlots : allSlots.filter((s) => s.available);

  return {
    success: true,
    date: dateString,
    doctorId: doctorUser._id.toString(),
    slotDuration,
    slots,
  };
};

/**
 * Validate whether a requested slot is currently valid and available for booking
 */
const validateSlotAvailability = async (doctorId, dateString, timeSlot) => {
  const { doctorUser } = await resolveDoctor(doctorId);
  if (!doctorUser) {
    return { valid: false, statusCode: 400, message: 'Invalid doctor ID format or doctor not found' };
  }

  const generated = await generateDoctorSlots(doctorId, dateString, { includeUnavailable: true });

  if (!generated.slots || generated.slots.length === 0) {
    return {
      valid: false,
      statusCode: 400,
      message: generated.message || 'No available slots for the selected date',
    };
  }

  const targetSlot = generated.slots.find((s) => s.time === timeSlot.trim());

  if (!targetSlot) {
    return {
      valid: false,
      statusCode: 400,
      message: 'The requested time slot is not part of the doctor availability schedule',
    };
  }

  if (!targetSlot.available) {
    // Determine whether it's booked or in the past
    const bookingDate = parseLocalDate(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDayStart = new Date(bookingDate);
    bookingDayStart.setHours(0, 0, 0, 0);

    const isToday = bookingDayStart.getTime() === today.getTime();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isPast = isToday && timeToMinutes(timeSlot) <= currentMinutes;

    if (isPast) {
      return {
        valid: false,
        statusCode: 400,
        message: 'The requested appointment time slot is already in the past',
      };
    }

    return {
      valid: false,
      statusCode: 409,
      message: 'Doctor is already booked for this time slot on the selected date',
    };
  }

  return {
    valid: true,
    doctorUser,
    slotDuration: generated.slotDuration,
  };
};

/**
 * Idempotently check upcoming appointments and generate 24-hour reminder notifications
 */
const processAppointmentReminders = async () => {
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Look for active appointments scheduled within the next 24 hours
  const upcomingAppointments = await Appointment.find({
    status: { $in: ['pending', 'confirmed'] },
    appointmentDate: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000), $lte: next24Hours },
  })
    .populate('doctorId', 'fullName')
    .populate('patientId', 'fullName');

  let remindersCreated = 0;

  for (const appt of upcomingAppointments) {
    // Check if an APPOINTMENT_REMINDER notification already exists for this appointment
    const existingReminder = await Notification.findOne({
      userId: appt.patientId._id,
      type: 'APPOINTMENT_REMINDER',
      appointmentId: appt._id,
    });

    if (existingReminder) {
      continue;
    }

    const doctorName = appt.doctorId?.fullName || 'Doctor';
    const apptDateStr = new Date(appt.appointmentDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    await Notification.create({
      userId: appt.patientId._id,
      type: 'APPOINTMENT_REMINDER',
      title: '📅 Appointment Reminder',
      message: `You have an appointment with Dr. ${doctorName} on ${apptDateStr} at ${appt.timeSlot}.`,
      appointmentId: appt._id,
      scheduledDate: apptDateStr,
      scheduledTime: appt.timeSlot,
      status: 'UNREAD',
    });

    remindersCreated++;
  }

  return {
    success: true,
    evaluated: upcomingAppointments.length,
    remindersCreated,
  };
};

module.exports = {
  DAYS_OF_WEEK,
  timeToMinutes,
  minutesToTime,
  parseLocalDate,
  resolveDoctor,
  generateDoctorSlots,
  validateSlotAvailability,
  processAppointmentReminders,
};
