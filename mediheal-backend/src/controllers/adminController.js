const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const generateTempPassword = require('../utils/generateTempPassword');

/**
 * @desc    Create a new doctor account and doctor profile (Admin only)
 * @route   POST /api/admin/doctors
 * @access  Private / Admin
 */
const createDoctor = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      slmcNumber,
      specialization,
      hospital,
      preferredLanguage,
      yearsOfExperience,
      consultationFee,
      languages,
      availableDays,
      availableTimeSlots,
      biography,
      location,
      latitude,
      longitude,
      isAvailable,
      password,
    } = req.body;

    // 1. Basic validation for required fields
    if (!fullName || !email || !phoneNumber || !slmcNumber || !specialization || !hospital) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: fullName, email, phoneNumber, slmcNumber, specialization, hospital',
      });
    }

    // Coordinate validation if provided
    let parsedLat = undefined;
    let parsedLng = undefined;

    if (latitude !== undefined && latitude !== null && latitude !== '') {
      parsedLat = Number(latitude);
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Latitude must be a valid number between -90 and 90',
        });
      }
    }

    if (longitude !== undefined && longitude !== null && longitude !== '') {
      parsedLng = Number(longitude);
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Longitude must be a valid number between -180 and 180',
        });
      }
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanSlmc = slmcNumber.trim();

    // 2. Check if user with this email already exists
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // 3. Check if doctor with this SLMC number already exists
    const slmcExists = await DoctorProfile.findOne({ slmcNumber: cleanSlmc });
    if (slmcExists) {
      return res.status(400).json({
        success: false,
        message: 'Doctor with this SLMC number already exists',
      });
    }

    // 4. Generate temporary password if not provided
    const tempPassword = password || generateTempPassword();

    // 5. Create User account with role = 'doctor'
    // User schema pre-save hook will hash tempPassword before saving
    const user = await User.create({
      fullName,
      email: cleanEmail,
      phoneNumber,
      password: tempPassword,
      role: 'doctor',
      preferredLanguage: preferredLanguage || 'English',
      isActive: true,
    });

    let doctorProfile;
    try {
      // 6. Create DoctorProfile record
      doctorProfile = await DoctorProfile.create({
        userId: user._id,
        slmcNumber: cleanSlmc,
        specialization,
        hospital,
        yearsOfExperience: yearsOfExperience || 0,
        consultationFee: consultationFee || 0,
        languages: languages || ['English'],
        availableDays: availableDays || [],
        availableTimeSlots: availableTimeSlots || [],
        biography: biography || '',
        location: location || '',
        latitude: parsedLat,
        longitude: parsedLng,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      });
    } catch (profileError) {
      // Rollback user creation if doctor profile creation fails
      await User.findByIdAndDelete(user._id);
      throw profileError;
    }

    // 7. Populate user details
    const populatedDoctor = await DoctorProfile.findById(doctorProfile._id).populate(
      'userId',
      'fullName email phoneNumber role preferredLanguage isActive createdAt'
    );

    // 8. Return response including temporary password for admin notification
    return res.status(201).json({
      success: true,
      message: 'Doctor account and profile created successfully',
      data: {
        doctor: populatedDoctor,
        temporaryPassword: tempPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all doctors for admin with filter options
 * @route   GET /api/admin/doctors
 * @access  Private / Admin
 */
const getAllDoctorsAdmin = async (req, res, next) => {
  try {
    const { specialization, isAvailable, search } = req.query;
    const filter = {};

    if (specialization) {
      filter.specialization = new RegExp(specialization, 'i');
    }

    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    }

    let doctors = await DoctorProfile.find(filter)
      .populate('userId', 'fullName email phoneNumber role preferredLanguage isActive createdAt')
      .sort({ createdAt: -1 });

    // Optional text search filter on doctor name or hospital
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      doctors = doctors.filter((doc) => {
        const docName = doc.userId ? doc.userId.fullName : '';
        return (
          searchRegex.test(docName) ||
          searchRegex.test(doc.specialization) ||
          searchRegex.test(doc.hospital) ||
          searchRegex.test(doc.slmcNumber)
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
 * @desc    Get doctor details by ID (Admin)
 * @route   GET /api/admin/doctors/:doctorId
 * @access  Private / Admin
 */
const getDoctorByIdAdmin = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    // Check if doctorId matches DoctorProfile _id or User _id
    let doctor = await DoctorProfile.findById(doctorId).populate(
      'userId',
      'fullName email phoneNumber role preferredLanguage isActive createdAt'
    );

    if (!doctor) {
      doctor = await DoctorProfile.findOne({ userId: doctorId }).populate(
        'userId',
        'fullName email phoneNumber role preferredLanguage isActive createdAt'
      );
    }

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
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

/**
 * @desc    Update doctor profile and user info (Admin)
 * @route   PUT /api/admin/doctors/:doctorId
 * @access  Private / Admin
 */
const updateDoctorAdmin = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    let doctor = await DoctorProfile.findById(doctorId);
    if (!doctor) {
      doctor = await DoctorProfile.findOne({ userId: doctorId });
    }

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const {
      fullName,
      email,
      phoneNumber,
      preferredLanguage,
      slmcNumber,
      specialization,
      hospital,
      yearsOfExperience,
      consultationFee,
      languages,
      availableDays,
      availableTimeSlots,
      biography,
      location,
      latitude,
      longitude,
      isAvailable,
    } = req.body;

    // Check SLMC uniqueness if changed
    if (slmcNumber && slmcNumber.trim() !== doctor.slmcNumber) {
      const slmcExists = await DoctorProfile.findOne({
        slmcNumber: slmcNumber.trim(),
        _id: { $ne: doctor._id },
      });
      if (slmcExists) {
        return res.status(400).json({
          success: false,
          message: 'Another doctor with this SLMC number already exists',
        });
      }
      doctor.slmcNumber = slmcNumber.trim();
    }

    // Check email uniqueness if user email changed
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const userExists = await User.findOne({
        email: cleanEmail,
        _id: { $ne: doctor.userId },
      });
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'Another user with this email already exists',
        });
      }
    }

    // Update User fields if provided
    const userUpdate = {};
    if (fullName !== undefined) userUpdate.fullName = fullName;
    if (email !== undefined) userUpdate.email = email.toLowerCase().trim();
    if (phoneNumber !== undefined) userUpdate.phoneNumber = phoneNumber;
    if (preferredLanguage !== undefined) userUpdate.preferredLanguage = preferredLanguage;

    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(doctor.userId, userUpdate, { new: true, runValidators: true });
    }

    // Update DoctorProfile fields
    if (specialization !== undefined) doctor.specialization = specialization;
    if (hospital !== undefined) doctor.hospital = hospital;
    if (yearsOfExperience !== undefined) doctor.yearsOfExperience = yearsOfExperience;
    if (consultationFee !== undefined) doctor.consultationFee = consultationFee;
    if (languages !== undefined) doctor.languages = languages;
    if (availableDays !== undefined) doctor.availableDays = availableDays;
    if (availableTimeSlots !== undefined) doctor.availableTimeSlots = availableTimeSlots;
    if (biography !== undefined) doctor.biography = biography;
    if (location !== undefined) doctor.location = location;
    if (isAvailable !== undefined) doctor.isAvailable = isAvailable;

    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const parsedLat = Number(latitude);
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Latitude must be a valid number between -90 and 90',
        });
      }
      doctor.latitude = parsedLat;
    } else if (latitude === null || latitude === '') {
      doctor.latitude = undefined;
    }

    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const parsedLng = Number(longitude);
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Longitude must be a valid number between -180 and 180',
        });
      }
      doctor.longitude = parsedLng;
    } else if (longitude === null || longitude === '') {
      doctor.longitude = undefined;
    }

    await doctor.save();

    const updatedDoctor = await DoctorProfile.findById(doctor._id).populate(
      'userId',
      'fullName email phoneNumber role preferredLanguage isActive createdAt'
    );

    return res.status(200).json({
      success: true,
      message: 'Doctor details updated successfully',
      data: updatedDoctor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Activate or deactivate doctor (Admin)
 * @route   PATCH /api/admin/doctors/:doctorId/status
 * @access  Private / Admin
 */
const updateDoctorStatus = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    let doctor = await DoctorProfile.findById(doctorId);
    if (!doctor) {
      doctor = await DoctorProfile.findOne({ userId: doctorId });
    }

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    const { isActive, isAvailable } = req.body;

    if (isActive === undefined && isAvailable === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide isActive or isAvailable status to update',
      });
    }

    // Update User active status
    if (isActive !== undefined) {
      await User.findByIdAndUpdate(doctor.userId, { isActive }, { new: true });
      // If deactivating user, set isAvailable to false as well
      if (isActive === false) {
        doctor.isAvailable = false;
      }
    }

    // Update DoctorProfile availability status
    if (isAvailable !== undefined) {
      doctor.isAvailable = isAvailable;
    }

    await doctor.save();

    const updatedDoctor = await DoctorProfile.findById(doctor._id).populate(
      'userId',
      'fullName email phoneNumber role preferredLanguage isActive createdAt'
    );

    return res.status(200).json({
      success: true,
      message: `Doctor status updated successfully`,
      data: updatedDoctor,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDoctor,
  getAllDoctorsAdmin,
  getDoctorByIdAdmin,
  updateDoctorAdmin,
  updateDoctorStatus,
};
