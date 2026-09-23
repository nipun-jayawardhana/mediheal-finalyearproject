const {
  getEmergencyProfile,
  upsertEmergencyProfile,
} = require('../services/emergencyProfileService');

/**
 * @desc    Get current patient's emergency health profile
 * @route   GET /api/emergency-profile/my
 * @access  Private (Patient role only)
 */
const getMyEmergencyProfile = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const result = await getEmergencyProfile(patientId);

    if (!result.isCompleted) {
      return res.status(200).json({
        success: true,
        data: null,
        message: result.message || 'Emergency profile not completed',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * @desc    Update/Create current patient's emergency health profile
 * @route   PUT /api/emergency-profile/my
 * @access  Private (Patient role only)
 */
const updateMyEmergencyProfile = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const result = await upsertEmergencyProfile(patientId, req.body);

    return res.status(200).json({
      success: true,
      message: 'Emergency health profile updated successfully',
      data: result.data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  getMyEmergencyProfile,
  updateMyEmergencyProfile,
};
