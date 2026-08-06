const mongoose = require('mongoose');
const Consultation = require('../models/Consultation');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

/**
 * Helper function to populate patient, doctor, and appointment details
 * safely without exposing passwords.
 */
const populateConsultationDetails = (query) => {
  return query
    .populate('patientId', 'fullName email phoneNumber preferredLanguage')
    .populate('doctorId', 'fullName email phoneNumber preferredLanguage')
    .populate('appointmentId', 'appointmentDate timeSlot status reason');
};

/**
 * @desc    Create a new consultation (Assigned Doctor only)
 * @route   POST /api/consultations
 * @access  Private / Doctor
 */
const createConsultation = async (req, res, next) => {
  try {
    const {
      appointmentId,
      diagnosis,
      clinicalNotes,
      prescriptions,
      recommendations,
      followUpDate,
    } = req.body;

    // 1. Validate required fields
    if (!appointmentId || !diagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: appointmentId and diagnosis',
      });
    }

    // 2. Validate ObjectId format for appointmentId
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format',
      });
    }

    // 3. Find target appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // 4. Rule 1: Only the assigned doctor can create a consultation
    if (appointment.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the assigned doctor can create a consultation for this appointment',
      });
    }

    // 5. Rule 3: Appointment status must be confirmed before consultation
    if (appointment.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Consultation can only be created for confirmed appointments. Current appointment status is: ${appointment.status}`,
      });
    }

    // 6. Rule 5: One appointment can have only one consultation
    const existingConsultation = await Consultation.findOne({ appointmentId });
    if (existingConsultation) {
      return res.status(400).json({
        success: false,
        message: 'A consultation has already been recorded for this appointment',
      });
    }

    // 7. Process prescription items if present
    let formattedPrescriptions = [];
    if (Array.isArray(prescriptions)) {
      for (const item of prescriptions) {
        if (!item.medicineName || !item.dosage || !item.frequency || !item.duration) {
          return res.status(400).json({
            success: false,
            message: 'Each prescription must include medicineName, dosage, frequency, and duration',
          });
        }
        formattedPrescriptions.push({
          medicineName: item.medicineName.trim(),
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          instructions: item.instructions ? item.instructions.trim() : '',
        });
      }
    }

    // 8. Create consultation document
    const consultation = await Consultation.create({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: req.user._id,
      diagnosis: diagnosis.trim(),
      clinicalNotes: clinicalNotes ? clinicalNotes.trim() : '',
      prescriptions: formattedPrescriptions,
      recommendations: Array.isArray(recommendations)
        ? recommendations.map((r) => String(r).trim()).filter(Boolean)
        : [],
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      completedAt: new Date(),
    });

    // 9. Rule 4: Automatically update appointment status to completed
    appointment.status = 'completed';
    await appointment.save();

    // 10. Populate response details
    const populatedConsultation = await populateConsultationDetails(
      Consultation.findById(consultation._id)
    );

    return res.status(201).json({
      success: true,
      message: 'Consultation created successfully',
      data: populatedConsultation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in user's consultations (Patient sees own, Doctor sees own created)
 * @route   GET /api/consultations/my
 * @access  Private
 */
const getMyConsultations = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user.role === 'patient') {
      filter.patientId = req.user._id;
    } else if (req.user.role === 'doctor') {
      filter.doctorId = req.user._id;
    } else if (req.user.role === 'admin') {
      filter = {};
    } else {
      filter.patientId = req.user._id;
    }

    const consultations = await populateConsultationDetails(
      Consultation.find(filter).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single consultation by ID
 * @route   GET /api/consultations/:consultationId
 * @access  Private (Patient can view own, Doctor can view assigned patients', Admin can view all)
 */
const getConsultationById = async (req, res, next) => {
  try {
    const { consultationId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(consultationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid consultation ID format',
      });
    }

    const consultation = await populateConsultationDetails(
      Consultation.findById(consultationId)
    );

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Access control checks
    if (req.user.role === 'patient') {
      // Rule 6: Patients can only view their own consultations
      if (consultation.patientId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own consultations',
        });
      }
    } else if (req.user.role === 'doctor') {
      // Rule 7: Doctors can view consultation history only for their own patients
      if (consultation.doctorId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Doctors can view consultation history only for their own patients',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: consultation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient's consultation history (Doctor only, for their own patients)
 * @route   GET /api/doctor/patients/:patientId/history
 * @access  Private / Doctor
 */
const getPatientConsultationHistoryForDoctor = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // 1. Validate patientId ObjectId format
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

    // 3. Rule 7: Doctors can view consultation history only for their own patients
    // Check if there is an appointment or existing consultation linking this doctor and patient
    const hasAppointment = await Appointment.exists({
      doctorId: req.user._id,
      patientId: patientId,
    });
    const hasConsultation = await Consultation.exists({
      doctorId: req.user._id,
      patientId: patientId,
    });

    if (!hasAppointment && !hasConsultation) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Doctors can view consultation history only for their own patients',
      });
    }

    // 4. Fetch patient consultation history
    const consultations = await populateConsultationDetails(
      Consultation.find({ patientId }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: consultations.length,
      data: consultations,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createConsultation,
  getMyConsultations,
  getConsultationById,
  getPatientConsultationHistoryForDoctor,
};
