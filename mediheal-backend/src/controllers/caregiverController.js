const mongoose = require('mongoose');
const CaregiverLink = require('../models/CaregiverLink');
const PatientProfile = require('../models/PatientProfile');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const Medication = require('../models/Medication');
const MedicationLog = require('../models/MedicationLog');

/**
 * @desc    Link a caregiver to a patient using caregiverLinkCode
 * @route   POST /api/caregivers/link
 * @access  Private / Caregiver
 */
const linkPatient = async (req, res, next) => {
  try {
    const { caregiverLinkCode, relationship } = req.body;

    // 1. Basic validation for required fields
    if (!caregiverLinkCode || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: caregiverLinkCode and relationship',
      });
    }

    const cleanCode = caregiverLinkCode.toUpperCase().trim();
    const cleanRelationship = relationship.trim();

    // 2. Rule 2: Find patient profile using caregiverLinkCode
    const patientProfile = await PatientProfile.findOne({ caregiverLinkCode: cleanCode });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Invalid caregiver link code. Patient profile not found',
      });
    }

    const patientId = patientProfile.userId;

    // Prevent caregiver from linking to themselves
    if (patientId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot link to your own patient account',
      });
    }

    // 3. Rule 3: Check for existing link to prevent duplicate active links
    let existingLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId,
    });

    if (existingLink) {
      if (existingLink.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Caregiver link already exists for this patient',
        });
      }

      // Reactivate previously removed link
      existingLink.status = 'active';
      existingLink.relationship = cleanRelationship;
      existingLink.linkedAt = new Date();
      await existingLink.save();

      const patientUser = await User.findById(patientId).select('-password');

      return res.status(200).json({
        success: true,
        message: 'Caregiver link reactivated successfully',
        data: {
          _id: existingLink._id,
          caregiverId: existingLink.caregiverId,
          relationship: existingLink.relationship,
          status: existingLink.status,
          linkedAt: existingLink.linkedAt,
          patient: patientUser,
        },
      });
    }

    // 4. Create new CaregiverLink
    const newLink = await CaregiverLink.create({
      caregiverId: req.user._id,
      patientId,
      relationship: cleanRelationship,
      status: 'active',
      linkedAt: new Date(),
    });

    const patientUser = await User.findById(patientId).select('-password');

    return res.status(201).json({
      success: true,
      message: 'Patient linked successfully',
      data: {
        _id: newLink._id,
        caregiverId: newLink.caregiverId,
        relationship: newLink.relationship,
        status: newLink.status,
        linkedAt: newLink.linkedAt,
        patient: patientUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all patients linked to logged-in caregiver (Rule 5)
 * @route   GET /api/caregivers/patients
 * @access  Private / Caregiver
 */
const getLinkedPatients = async (req, res, next) => {
  try {
    // Rule 5: Caregivers can view only active patients linked to them
    const activeLinks = await CaregiverLink.find({
      caregiverId: req.user._id,
      status: 'active',
    }).sort({ linkedAt: -1 });

    const patientIds = activeLinks.map((link) => link.patientId);

    // Fetch user details excluding passwords
    const users = await User.find({ _id: { $in: patientIds } }).select('-password');
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Fetch patient profiles
    const profiles = await PatientProfile.find({ userId: { $in: patientIds } });
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const result = activeLinks.map((link) => {
      const patientIdStr = link.patientId.toString();
      return {
        _id: link._id,
        relationship: link.relationship,
        status: link.status,
        linkedAt: link.linkedAt,
        patient: userMap.get(patientIdStr) || null,
        patientProfile: profileMap.get(patientIdStr) || null,
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed patient information for a linked patient (including medications & adherence summary)
 * @route   GET /api/caregivers/patients/:patientId
 * @access  Private / Caregiver
 */
const getPatientDetailsForCaregiver = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // Rule 5: Ensure active link exists
    const link = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'active',
    });

    if (!link) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Patient is not linked to this caregiver',
      });
    }

    // 1. Basic patient information (excluding password)
    const patientUser = await User.findById(patientId).select('-password');
    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient user account not found',
      });
    }

    // 2. Patient profile
    const patientProfile = await PatientProfile.findOne({ userId: patientId });

    // 3. Upcoming appointments
    const upcomingAppointments = await Appointment.find({
      patientId,
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate('doctorId', 'fullName email phoneNumber preferredLanguage')
      .sort({ appointmentDate: 1, timeSlot: 1 });

    // 4. Recent consultations
    const recentConsultations = await Consultation.find({ patientId })
      .populate('doctorId', 'fullName email phoneNumber preferredLanguage')
      .populate('appointmentId', 'appointmentDate timeSlot status reason')
      .sort({ createdAt: -1 });

    // 5. Active medications
    const activeMedications = await Medication.find({
      patientId,
      isActive: true,
    }).sort({ createdAt: -1 });

    // 6. Recent medication logs
    const recentMedicationLogs = await MedicationLog.find({ patientId })
      .populate('medicationId', 'medicineName dosage frequency timeSlots')
      .sort({ scheduledDate: -1, createdAt: -1 })
      .limit(20);

    // 7. Adherence summary calculation from existing MedicationLog records
    const allLogs = await MedicationLog.find({ patientId });
    const totalScheduled = allLogs.length;
    const totalTaken = allLogs.filter((l) => l.status === 'taken').length;
    const totalMissed = allLogs.filter((l) => l.status === 'missed').length;
    const adherencePercentage =
      totalScheduled > 0
        ? Number(((totalTaken / totalScheduled) * 100).toFixed(2))
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        relationship: link.relationship,
        linkedAt: link.linkedAt,
        patient: patientUser,
        patientProfile,
        upcomingAppointments,
        recentConsultations,
        activeMedications,
        recentMedicationLogs,
        adherenceSummary: {
          totalScheduled,
          totalTaken,
          totalMissed,
          adherencePercentage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove caregiver link (soft delete - updates status to 'removed') (Rule 7)
 * @route   DELETE /api/caregivers/patients/:patientId/link
 * @access  Private / Caregiver
 */
const removeCaregiverLink = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    const link = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'active',
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Active caregiver link for this patient not found',
      });
    }

    // Rule 7: Changes status to 'removed' instead of deleting record
    link.status = 'removed';
    await link.save();

    return res.status(200).json({
      success: true,
      message: 'Caregiver link removed successfully',
      data: link,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  linkPatient,
  getLinkedPatients,
  getPatientDetailsForCaregiver,
  removeCaregiverLink,
};
