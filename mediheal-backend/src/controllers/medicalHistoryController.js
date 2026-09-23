const { getPatientTimeline } = require('../services/medicalHistoryService');

/**
 * @desc    Get chronological medical history timeline for logged-in patient
 * @route   GET /api/patient/medical-history or GET /api/patients/medical-history
 * @access  Private / Patient only
 */
const getPatientMedicalHistory = async (req, res, next) => {
  try {
    // Security check: Only patient can access their own medical history
    if (!req.user || req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only registered patients can access their medical history timeline',
      });
    }

    const patientId = req.user._id;
    const timeline = await getPatientTimeline(patientId);

    return res.status(200).json({
      success: true,
      count: timeline.length,
      data: timeline,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatientMedicalHistory,
};
