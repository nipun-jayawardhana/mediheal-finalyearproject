const mongoose = require('mongoose');
const User = require('../models/User');
const CaregiverLink = require('../models/CaregiverLink');
const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const { calculateAdherenceAnalytics } = require('../services/medicationAnalyticsService');

/**
 * @desc    Get logged-in patient's medication adherence analytics
 * @route   GET /api/medication-analytics/my?range=30d
 * @access  Private / Patient
 */
const getMyAdherenceAnalytics = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const { range = '30d' } = req.query;

    const result = await calculateAdherenceAnalytics(patientId, range);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get medication adherence analytics for a linked patient (Caregiver)
 * @route   GET /api/caregiver/medication-analytics/patient/:patientId?range=30d
 * @access  Private / Caregiver
 */
const getCaregiverPatientAdherenceAnalytics = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { range = '30d' } = req.query;
    const caregiverId = req.user._id;

    // 1. Validate patientId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // 2. Verify target patient exists
    const patientUser = await User.findById(patientId);
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    // 3. Verify active caregiver link
    const activeLink = await CaregiverLink.findOne({
      caregiverId,
      patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not linked to this patient.',
      });
    }

    // 4. Calculate analytics
    const result = await calculateAdherenceAnalytics(patientId, range);

    // Attach patient metadata for convenience
    result.patient = {
      _id: patientUser._id,
      fullName: patientUser.fullName,
      email: patientUser.email,
    };

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient medication adherence analytics (Authorized Doctor only)
 * @route   GET /api/doctor/patients/:patientId/medication-analytics?range=30d
 * @access  Private / Doctor
 */
const getDoctorPatientAdherenceAnalytics = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { range = '30d' } = req.query;
    const doctorId = req.user._id;

    // 1. Validate patientId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // 2. Verify target patient exists
    const patientUser = await User.findById(patientId);
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    // 3. Authorization check: Doctor must have an appointment, consultation, or prescription with patient
    const hasAppointment = await Appointment.exists({
      doctorId,
      patientId,
    });
    const hasConsultation = await Consultation.exists({
      doctorId,
      patientId,
    });
    const hasPrescription = await Prescription.exists({
      doctorId,
      patientId,
    });

    if (!hasAppointment && !hasConsultation && !hasPrescription) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Doctors can view adherence analytics only for their own patients',
      });
    }

    // 4. Calculate analytics (Read-only)
    const result = await calculateAdherenceAnalytics(patientId, range);

    result.patient = {
      _id: patientUser._id,
      fullName: patientUser.fullName,
      email: patientUser.email,
    };

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyAdherenceAnalytics,
  getCaregiverPatientAdherenceAnalytics,
  getDoctorPatientAdherenceAnalytics,
};
