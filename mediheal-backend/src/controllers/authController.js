const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * @desc    Register a new user (Public - Patients & Caregivers only)
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password, role, preferredLanguage } = req.body;

    // 1. Basic validation for required fields
    if (!fullName || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: fullName, email, phoneNumber, and password',
      });
    }

    // 2. Enforce security rule: Public registration allows ONLY 'patient' and 'caregiver'
    const requestedRole = role ? role.toLowerCase() : 'patient';
    const allowedPublicRoles = ['patient', 'caregiver'];

    if (!allowedPublicRoles.includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Public registration is only permitted for patient and caregiver roles. Doctor and admin accounts cannot be created publicly.',
      });
    }

    // 3. Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // 4. Create new user
    const user = await User.create({
      fullName,
      email,
      phoneNumber,
      password,
      role: requestedRole,
      preferredLanguage: preferredLanguage || 'English',
    });

    // 5. Generate JWT token
    const token = generateToken(user._id, user.role);

    // 6. Return response
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          preferredLanguage: user.preferredLanguage,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validation for email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // 2. Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // 3. Verify user existence and password
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 4. Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.',
      });
    }

    // 5. Generate token
    const token = generateToken(user._id, user.role);

    // 6. Return response
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          preferredLanguage: user.preferredLanguage,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged-in user profile
 * @route   GET /api/auth/me
 * @access  Private (Protected by authentication middleware)
 */
const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
};
