const PatientProfile = require('../models/PatientProfile');
const EmergencyAlert = require('../models/EmergencyAlert');
const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');
const MedicationSchedule = require('../models/MedicationSchedule');
const Medication = require('../models/Medication');
const { formatDateKey } = require('../services/medicationScheduleService');
const generateLinkCode = require('../utils/generateLinkCode');

/**
 * Today's remaining medication doses for the dashboard, soonest first.
 * Combines doctor-prescribed schedules and caregiver-added medications.
 * Falls back to today's overdue (still pending) doses when nothing is left later today.
 */
const getTodayUpcomingDoses = async (userId) => {
  const now = new Date();
  const todayStr = formatDateKey(now);
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const doses = [];

  const schedules = await MedicationSchedule.find({
    patientId: userId,
    'adherenceRecords.scheduledDateStr': todayStr,
  }).lean();
  for (const schedule of schedules) {
    for (const rec of schedule.adherenceRecords || []) {
      if (rec.scheduledDateStr !== todayStr || rec.status !== 'PENDING') continue;
      doses.push({
        _id: `${schedule._id}-${rec._id}`,
        medicineName: schedule.medicineName,
        dosage: schedule.dosage,
        timeSlots: [rec.scheduledTime],
        source: 'prescription',
      });
    }
  }

  const caregiverMeds = await Medication.find({
    patientId: userId,
    isActive: true,
    startDate: { $lte: endOfToday },
    endDate: { $gte: startOfToday },
  }).lean();
  for (const med of caregiverMeds) {
    for (const slot of med.timeSlots || []) {
      doses.push({
        _id: `${med._id}-${slot}`,
        medicineName: med.medicineName,
        dosage: med.dosage,
        timeSlots: [slot],
        source: 'caregiver',
      });
    }
  }

  const byTime = (a, b) => a.timeSlots[0].localeCompare(b.timeSlots[0]);
  const upcoming = doses.filter((d) => d.timeSlots[0] >= nowHHMM).sort(byTime);
  if (upcoming.length > 0) return upcoming;
  // Nothing later today: surface doctor doses that are due but not yet marked taken
  return doses.filter((d) => d.source === 'prescription').sort(byTime);
};

/**
 * @desc    Create a new patient profile
 * @route   POST /api/patients/profile
 * @access  Private (Patient role only)
 */
const createPatientProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Check if patient profile already exists for this user
    const existingProfile = await PatientProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Patient profile already exists for this account',
      });
    }

    const {
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      emergencyContactName,
      emergencyContactPhone,
      medicalConditions,
      allergies,
      patientLocation,
      preferredDoctorRadius,
    } = req.body;

    // 2. Validate required fields
    if (
      !dateOfBirth ||
      !gender ||
      !bloodGroup ||
      !address ||
      !emergencyContactName ||
      !emergencyContactPhone
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: dateOfBirth, gender, bloodGroup, address, emergencyContactName, emergencyContactPhone',
      });
    }

    // 3. Generate unique caregiver linking code
    const caregiverLinkCode = await generateLinkCode();

    // 4. Create patient profile
    const profile = await PatientProfile.create({
      userId,
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      emergencyContactName,
      emergencyContactPhone,
      medicalConditions: medicalConditions || [],
      allergies: allergies || [],
      caregiverLinkCode,
      patientLocation: patientLocation || { latitude: null, longitude: null },
      preferredDoctorRadius: preferredDoctorRadius ? Number(preferredDoctorRadius) : 10,
    });

    return res.status(201).json({
      success: true,
      message: 'Patient profile created successfully',
      data: {
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current patient profile
 * @route   GET /api/patients/profile
 * @access  Private (Patient role only)
 */
const getPatientProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const profile = await PatientProfile.findOne({ userId }).populate(
      'userId',
      'fullName email phoneNumber role preferredLanguage isActive'
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Please create your profile.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Patient profile retrieved successfully',
      data: {
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update current patient profile
 * @route   PUT /api/patients/profile
 * @access  Private (Patient role only)
 */
const updatePatientProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let profile = await PatientProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Cannot update.',
      });
    }

    const {
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      emergencyContactName,
      emergencyContactPhone,
      medicalConditions,
      allergies,
      patientLocation,
      preferredDoctorRadius,
    } = req.body;

    // Update only provided fields
    if (dateOfBirth !== undefined) profile.dateOfBirth = dateOfBirth;
    if (gender !== undefined) profile.gender = gender;
    if (bloodGroup !== undefined) profile.bloodGroup = bloodGroup;
    if (address !== undefined) profile.address = address;
    if (emergencyContactName !== undefined) profile.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) profile.emergencyContactPhone = emergencyContactPhone;
    if (medicalConditions !== undefined) profile.medicalConditions = medicalConditions;
    if (allergies !== undefined) profile.allergies = allergies;
    if (patientLocation !== undefined) {
      profile.patientLocation = {
        latitude: patientLocation?.latitude !== undefined ? patientLocation.latitude : profile.patientLocation?.latitude,
        longitude: patientLocation?.longitude !== undefined ? patientLocation.longitude : profile.patientLocation?.longitude,
      };
    }
    if (preferredDoctorRadius !== undefined) {
      profile.preferredDoctorRadius = Number(preferredDoctorRadius);
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      data: {
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient dashboard summary data
 * @route   GET /api/patients/dashboard
 * @access  Private (Patient role only)
 */
const getPatientDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const profile = await PatientProfile.findOne({ userId });
    const activeEmergencyAlert = await EmergencyAlert.findOne({
      patientId: userId,
      status: 'active',
    }).sort({ createdAt: -1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawAppointments = await Appointment.find({
      patientId: userId,
      appointmentDate: { $gte: today },
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate('doctorId', 'fullName email phoneNumber preferredLanguage')
      .sort({ appointmentDate: 1, timeSlot: 1 })
      .limit(5);

    const upcomingAppointments = await Promise.all(
      rawAppointments.map(async (appt) => {
        const apptObj = appt.toObject();
        if (appt.doctorId?._id) {
          const docProf = await DoctorProfile.findOne({ userId: appt.doctorId._id });
          if (docProf) {
            apptObj.specialization = docProf.specialization;
            apptObj.hospital = docProf.hospital;
          }
        }
        return apptObj;
      })
    );

    let medications = [];
    try {
      medications = await getTodayUpcomingDoses(userId);
    } catch (medErr) {
      console.warn('Dashboard medication lookup warning:', medErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Patient dashboard retrieved successfully',
      data: {
        user: req.user,
        patientProfile: profile || null,
        medications,
        upcomingAppointments,
        latestSymptomCheck: null,
        activeEmergencyAlert: activeEmergencyAlert || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPatientProfile,
  getPatientProfile,
  updatePatientProfile,
  getPatientDashboard,
};
