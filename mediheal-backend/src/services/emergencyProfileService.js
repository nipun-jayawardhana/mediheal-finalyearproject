const EmergencyHealthProfile = require('../models/EmergencyHealthProfile');
const PatientProfile = require('../models/PatientProfile');
const User = require('../models/User');
const MedicationSchedule = require('../models/MedicationSchedule');
const Prescription = require('../models/Prescription');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

/**
 * Derives currently active medications for a patient based on MedicationSchedule and Prescription
 * @param {string|mongoose.Types.ObjectId} patientId
 * @returns {Promise<Array>} List of active medications
 */
const deriveCurrentMedications = async (patientId) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find medication schedules where end date is today or in the future
  const schedules = await MedicationSchedule.find({
    patientId,
    endDate: { $gte: todayStart },
  })
    .populate('prescriptionId', 'status validUntil')
    .sort({ endDate: -1 });

  // Filter out any schedules linked to inactive/completed/discontinued prescriptions
  const activeSchedules = schedules.filter((schedule) => {
    if (schedule.prescriptionId) {
      return schedule.prescriptionId.status === 'active';
    }
    return true;
  });

  // Deduplicate by medicineName (case-insensitive) keeping the most recent active one
  const seenMedicines = new Set();
  const currentMedications = [];

  for (const s of activeSchedules) {
    const key = (s.medicineName || '').trim().toLowerCase();
    if (!key || seenMedicines.has(key)) continue;

    seenMedicines.add(key);
    currentMedications.push({
      medicineName: s.medicineName.trim(),
      dosage: s.dosage.trim(),
      frequency: s.frequency.trim(),
      duration: s.duration ? s.duration.trim() : '',
      instructions: s.instructions ? s.instructions.trim() : '',
      startDate: s.startDate,
      endDate: s.endDate,
    });
  }

  return currentMedications;
};

/**
 * Retrieve emergency health profile for an authenticated patient
 * @param {string|mongoose.Types.ObjectId} patientId
 */
const getEmergencyProfile = async (patientId) => {
  const user = await User.findById(patientId).select('fullName email phoneNumber role preferredLanguage');
  if (!user) {
    const error = new Error('Patient user not found');
    error.statusCode = 404;
    throw error;
  }

  const patientProfile = await PatientProfile.findOne({ userId: patientId });
  const emergencyProfile = await EmergencyHealthProfile.findOne({ patientId });
  const currentMedications = await deriveCurrentMedications(patientId);

  // If neither emergency profile nor patient profile exists, return uncompleted state
  if (!emergencyProfile && !patientProfile) {
    return {
      isCompleted: false,
      data: null,
      message: 'Emergency profile not completed',
    };
  }

  // If EmergencyHealthProfile exists, use its fields
  if (emergencyProfile) {
    return {
      isCompleted: true,
      data: {
        patient: {
          id: user._id,
          fullName: user.fullName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          dateOfBirth: patientProfile?.dateOfBirth || null,
          gender: patientProfile?.gender || null,
        },
        bloodGroup: emergencyProfile.bloodGroup || 'Unknown',
        allergies: emergencyProfile.allergies || [],
        hasNoKnownAllergies: emergencyProfile.hasNoKnownAllergies || false,
        chronicConditions: emergencyProfile.chronicConditions || [],
        emergencyContact: {
          name: emergencyProfile.emergencyContact?.name || '',
          relationship: emergencyProfile.emergencyContact?.relationship || '',
          phone: emergencyProfile.emergencyContact?.phone || '',
        },
        emergencyNotes: emergencyProfile.emergencyNotes || '',
        currentMedications,
        isCompleted: true,
        createdAt: emergencyProfile.createdAt,
        updatedAt: emergencyProfile.updatedAt,
      },
    };
  }

  // Fallback: If only PatientProfile exists from onboarding, offer it as baseline
  const hasNoKnownAllergies = (patientProfile.allergies || []).some(
    (a) => a.toLowerCase() === 'no known allergies'
  );

  return {
    isCompleted: true,
    data: {
      patient: {
        id: user._id,
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: patientProfile.dateOfBirth,
        gender: patientProfile.gender,
      },
      bloodGroup: patientProfile.bloodGroup || 'Unknown',
      allergies: patientProfile.allergies || [],
      hasNoKnownAllergies,
      chronicConditions: patientProfile.medicalConditions || [],
      emergencyContact: {
        name: patientProfile.emergencyContactName || '',
        relationship: '',
        phone: patientProfile.emergencyContactPhone || '',
      },
      emergencyNotes: '',
      currentMedications,
      isCompleted: true,
      createdAt: patientProfile.createdAt,
      updatedAt: patientProfile.updatedAt,
    },
  };
};

/**
 * Create or update emergency health profile for an authenticated patient
 * @param {string|mongoose.Types.ObjectId} patientId
 * @param {Object} payload
 */
const upsertEmergencyProfile = async (patientId, payload) => {
  const user = await User.findById(patientId).select('fullName email phoneNumber role');
  if (!user) {
    const error = new Error('Patient user not found');
    error.statusCode = 404;
    throw error;
  }

  const {
    bloodGroup,
    allergies,
    hasNoKnownAllergies,
    chronicConditions,
    emergencyContact,
    emergencyNotes,
  } = payload;

  // Validate bloodGroup if provided
  if (bloodGroup !== undefined && bloodGroup !== null) {
    if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      const error = new Error(
        `Invalid blood group '${bloodGroup}'. Allowed: ${VALID_BLOOD_GROUPS.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Clean and sanitize allergies
  let sanitizedAllergies = [];
  let isNoKnownAllergies = Boolean(hasNoKnownAllergies);

  if (Array.isArray(allergies)) {
    sanitizedAllergies = allergies
      .map((a) => (typeof a === 'string' ? a.trim() : ''))
      .filter((a) => a.length > 0);

    if (sanitizedAllergies.some((a) => a.toLowerCase() === 'no known allergies')) {
      isNoKnownAllergies = true;
    }
  }

  // Clean and sanitize chronic conditions
  let sanitizedConditions = [];
  if (Array.isArray(chronicConditions)) {
    sanitizedConditions = chronicConditions
      .map((c) => (typeof c === 'string' ? c.trim() : ''))
      .filter((c) => c.length > 0);
  }

  // Clean emergency contact
  const sanitizedContact = {
    name: emergencyContact?.name ? String(emergencyContact.name).trim() : '',
    relationship: emergencyContact?.relationship ? String(emergencyContact.relationship).trim() : '',
    phone: emergencyContact?.phone ? String(emergencyContact.phone).trim() : '',
  };

  const updateFields = {
    bloodGroup: bloodGroup || 'Unknown',
    allergies: sanitizedAllergies,
    hasNoKnownAllergies: isNoKnownAllergies,
    chronicConditions: sanitizedConditions,
    emergencyContact: sanitizedContact,
    emergencyNotes: typeof emergencyNotes === 'string' ? emergencyNotes.trim() : '',
  };

  // Upsert EmergencyHealthProfile
  const profile = await EmergencyHealthProfile.findOneAndUpdate(
    { patientId },
    { $set: updateFields },
    { new: true, upsert: true, runValidators: true }
  );

  // Synchronize changes to PatientProfile if it exists
  const patientProfile = await PatientProfile.findOne({ userId: patientId });
  if (patientProfile) {
    if (bloodGroup && bloodGroup !== 'Unknown') {
      patientProfile.bloodGroup = bloodGroup;
    }
    patientProfile.allergies = sanitizedAllergies;
    patientProfile.medicalConditions = sanitizedConditions;
    if (sanitizedContact.name) {
      patientProfile.emergencyContactName = sanitizedContact.name;
    }
    if (sanitizedContact.phone) {
      patientProfile.emergencyContactPhone = sanitizedContact.phone;
    }
    await patientProfile.save();
  }

  const currentMedications = await deriveCurrentMedications(patientId);

  return {
    isCompleted: true,
    data: {
      patient: {
        id: user._id,
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: patientProfile?.dateOfBirth || null,
        gender: patientProfile?.gender || null,
      },
      bloodGroup: profile.bloodGroup,
      allergies: profile.allergies,
      hasNoKnownAllergies: profile.hasNoKnownAllergies,
      chronicConditions: profile.chronicConditions,
      emergencyContact: profile.emergencyContact,
      emergencyNotes: profile.emergencyNotes,
      currentMedications,
      isCompleted: true,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  };
};

module.exports = {
  VALID_BLOOD_GROUPS,
  deriveCurrentMedications,
  getEmergencyProfile,
  upsertEmergencyProfile,
};
