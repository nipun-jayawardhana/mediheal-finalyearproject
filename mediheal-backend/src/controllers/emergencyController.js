const mongoose = require('mongoose');
const EmergencyAlert = require('../models/EmergencyAlert');
const PatientProfile = require('../models/PatientProfile');
const CaregiverLink = require('../models/CaregiverLink');

/**
 * @desc    Create a new Emergency Alert (Patient only)
 * @route   POST /api/emergency
 * @access  Private (Patient only)
 */
const createEmergencyAlert = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const { latitude, longitude, message } = req.body;

    // 1. Validate required message field
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an emergency message',
      });
    }

    const cleanMessage = message.trim();
    if (cleanMessage.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Emergency message cannot exceed 500 characters',
      });
    }

    // 2. Validate optional latitude if supplied
    if (latitude !== undefined && latitude !== null) {
      const latNum = Number(latitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({
          success: false,
          message: 'Latitude must be a valid number between -90 and 90',
        });
      }
    }

    // 3. Validate optional longitude if supplied
    if (longitude !== undefined && longitude !== null) {
      const lngNum = Number(longitude);
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({
          success: false,
          message: 'Longitude must be a valid number between -180 and 180',
        });
      }
    }

    // 4. Retrieve patient profile to populate emergency contacts if available
    const patientProfile = await PatientProfile.findOne({ userId: patientId });
    const emergencyContactName = patientProfile ? patientProfile.emergencyContactName || '' : '';
    const emergencyContactPhone = patientProfile ? patientProfile.emergencyContactPhone || '' : '';

    // 5. Retrieve all active caregivers linked to this patient
    const activeLinks = await CaregiverLink.find({
      patientId,
      status: 'active',
    });
    const caregiverIds = activeLinks.map((link) => link.caregiverId);

    // Check if an active emergency alert already exists for this patient
    const existingActive = await EmergencyAlert.findOne({
      patientId,
      status: 'active',
    });

    if (existingActive) {
      return res.status(200).json({
        success: true,
        message: 'An active emergency alert already exists',
        data: existingActive,
      });
    }

    // 6. Create EmergencyAlert record
    const alert = await EmergencyAlert.create({
      patientId,
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : undefined,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : undefined,
      message: cleanMessage,
      emergencyContactName,
      emergencyContactPhone,
      caregiverIds,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Emergency alert created successfully',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient's own emergency alerts
 * @route   GET /api/emergency/my
 * @access  Private (Patient only)
 */
const getPatientEmergencyAlerts = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    const alerts = await EmergencyAlert.find({ patientId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single emergency alert by ID (Patient owner or actively linked Caregiver)
 * @route   GET /api/emergency/:alertId
 * @access  Private (Patient or Caregiver)
 */
const getEmergencyAlertById = async (req, res, next) => {
  try {
    const { alertId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emergency alert ID format',
      });
    }

    const alert = await EmergencyAlert.findById(alertId).populate(
      'patientId',
      'fullName email phoneNumber preferredLanguage'
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Emergency alert record not found',
      });
    }

    const userIdStr = req.user._id.toString();
    const alertPatientIdStr = alert.patientId._id ? alert.patientId._id.toString() : alert.patientId.toString();

    // Authorization checks
    if (req.user.role === 'patient') {
      if (alertPatientIdStr !== userIdStr) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this emergency alert',
        });
      }
    } else if (req.user.role === 'caregiver') {
      // Check if caregiver has an active link to the patient or is in caregiverIds
      const activeLink = await CaregiverLink.findOne({
        caregiverId: req.user._id,
        patientId: alertPatientIdStr,
        status: 'active',
      });

      const isListedCaregiver = alert.caregiverIds.some(
        (id) => id.toString() === userIdStr
      );

      if (!activeLink && !isListedCaregiver) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this patient emergency alert',
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Role not authorized to view emergency alerts',
      });
    }

    return res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel own emergency alert (Patient only)
 * @route   PATCH /api/emergency/:alertId/cancel
 * @access  Private (Patient only)
 */
const cancelEmergencyAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;

    console.log('[EMERGENCY API] Cancel request received');
    console.log(`[EMERGENCY API] Alert ID: ${alertId}`);

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emergency alert ID format',
      });
    }

    const alert = await EmergencyAlert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Emergency alert record not found',
      });
    }

    // Ownership check
    if (alert.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this emergency alert',
      });
    }

    console.log(`[EMERGENCY API] Current status: ${alert.status}`);

    // Status validations
    if (alert.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'A resolved emergency alert cannot be cancelled',
      });
    }

    if (alert.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Emergency alert is already cancelled',
      });
    }

    alert.status = 'cancelled';
    alert.cancelledAt = new Date();
    if (reason && typeof reason === 'string') {
      alert.cancellationReason = reason.trim();
    }

    await alert.save();
    console.log('[EMERGENCY API] Updated status: cancelled');

    return res.status(200).json({
      success: true,
      message: 'Emergency alert cancelled successfully',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resolve active emergency alert (Caregiver only, actively linked)
 * @route   PATCH /api/emergency/:alertId/resolve
 * @access  Private (Caregiver only)
 */
const resolveEmergencyAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emergency alert ID format',
      });
    }

    const alert = await EmergencyAlert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Emergency alert record not found',
      });
    }

    // Check active link requirement
    const activeLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId: alert.patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be actively linked to the patient to resolve their emergency alert',
      });
    }

    // Status validations
    if (alert.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'A cancelled emergency alert cannot be resolved',
      });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Emergency alert is already resolved',
      });
    }

    alert.status = 'resolved';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();

    await alert.save();

    return res.status(200).json({
      success: true,
      message: 'Emergency alert resolved successfully',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get emergency alerts for actively linked patients (Caregiver only)
 * @route   GET /api/caregivers/emergency-alerts
 * @access  Private (Caregiver only)
 */
const getCaregiverEmergencyAlerts = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;

    // Find all active links for caregiver
    const activeLinks = await CaregiverLink.find({
      caregiverId,
      status: 'active',
    });
    const patientIds = activeLinks.map((link) => link.patientId);

    if (patientIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const filter = { patientId: { $in: patientIds } };
    if (req.query.status) {
      filter.status = req.query.status.trim();
    }

    const alerts = await EmergencyAlert.find(filter)
      .populate('patientId', 'fullName email phoneNumber preferredLanguage')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEmergencyAlert,
  getPatientEmergencyAlerts,
  getEmergencyAlertById,
  cancelEmergencyAlert,
  resolveEmergencyAlert,
  getCaregiverEmergencyAlerts,
};
