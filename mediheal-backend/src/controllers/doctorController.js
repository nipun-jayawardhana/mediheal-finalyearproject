const DoctorProfile = require('../models/DoctorProfile');

/**
 * @desc    Get all active doctors for patients with optional filtering
 * @route   GET /api/doctors
 * @access  Private (Authenticated users - Patients, Caregivers, Doctors, Admin)
 */
const getDoctors = async (req, res, next) => {
  try {
    const { specialization, hospital, search, language, isAvailable } = req.query;
    const filter = {};

    // 1. Filter by specialization (case-insensitive regex)
    if (specialization) {
      filter.specialization = new RegExp(specialization.trim(), 'i');
    }

    // 2. Filter by hospital (case-insensitive regex)
    if (hospital) {
      filter.hospital = new RegExp(hospital.trim(), 'i');
    }

    // 3. Filter by spoken language
    if (language) {
      filter.languages = new RegExp(language.trim(), 'i');
    }

    // 4. Filter by availability status
    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    }

    // Retrieve doctor profiles and populate user information
    let doctors = await DoctorProfile.find(filter)
      .populate('userId', 'fullName email phoneNumber preferredLanguage isActive')
      .sort({ createdAt: -1 });

    // Filter out doctors whose user account is deactivated (isActive = false)
    doctors = doctors.filter((doc) => doc.userId && doc.userId.isActive === true);

    // Optional general text search (matches doctor name, specialization, or hospital)
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      doctors = doctors.filter((doc) => {
        const docName = doc.userId ? doc.userId.fullName : '';
        return (
          searchRegex.test(docName) ||
          searchRegex.test(doc.specialization) ||
          searchRegex.test(doc.hospital)
        );
      });
    }

    return res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single doctor profile by DoctorProfile ID or User ID
 * @route   GET /api/doctors/:doctorId
 * @access  Private (Authenticated users)
 */
const getDoctorById = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    // Search by DoctorProfile _id or User _id
    let doctor = await DoctorProfile.findById(doctorId).populate(
      'userId',
      'fullName email phoneNumber preferredLanguage isActive'
    );

    if (!doctor) {
      doctor = await DoctorProfile.findOne({ userId: doctorId }).populate(
        'userId',
        'fullName email phoneNumber preferredLanguage isActive'
      );
    }

    // Return 404 if doctor profile not found or linked user is deactivated
    if (!doctor || !doctor.userId || doctor.userId.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found or unavailable',
      });
    }

    return res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDoctors,
  getDoctorById,
};
