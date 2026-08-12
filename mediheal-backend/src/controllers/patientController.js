const PatientProfile = require('../models/PatientProfile');
const EmergencyAlert = require('../models/EmergencyAlert');
const generateLinkCode = require('../utils/generateLinkCode');

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

    return res.status(200).json({
      success: true,
      message: 'Patient dashboard retrieved successfully',
      data: {
        user: req.user,
        patientProfile: profile || null,
        medications: [],
        upcomingAppointments: [],
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
