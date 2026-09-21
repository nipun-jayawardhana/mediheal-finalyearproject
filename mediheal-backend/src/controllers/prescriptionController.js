const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const Consultation = require('../models/Consultation');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const { generateSchedulesForPrescription } = require('../services/medicationScheduleService');

/**
 * Helper to populate doctor details and attach specialization & hospital
 */
const formatPrescriptionsWithDoctorInfo = async (prescriptions) => {
  if (!prescriptions || prescriptions.length === 0) return [];

  // Extract all unique doctor user IDs
  const doctorUserIds = [
    ...new Set(
      prescriptions
        .map((p) => {
          const docId = p.doctorId?._id || p.doctorId;
          return docId ? docId.toString() : null;
        })
        .filter(Boolean)
    ),
  ];

  // Fetch DoctorProfile for each doctor
  const doctorProfiles = await DoctorProfile.find({
    userId: { $in: doctorUserIds },
  }).lean();

  const profileMap = {};
  doctorProfiles.forEach((prof) => {
    profileMap[prof.userId.toString()] = {
      specialization: prof.specialization,
      hospital: prof.hospital,
      slmcNumber: prof.slmcNumber,
    };
  });

  return prescriptions.map((p) => {
    const docObj = p.toObject ? p.toObject() : { ...p };
    const docUserId = docObj.doctorId?._id
      ? docObj.doctorId._id.toString()
      : docObj.doctorId
      ? docObj.doctorId.toString()
      : null;

    if (docUserId && profileMap[docUserId]) {
      docObj.doctorDetails = {
        fullName: docObj.doctorId?.fullName || 'Specialist',
        email: docObj.doctorId?.email || '',
        phoneNumber: docObj.doctorId?.phoneNumber || '',
        specialization: profileMap[docUserId].specialization,
        hospital: profileMap[docUserId].hospital,
        slmcNumber: profileMap[docUserId].slmcNumber,
      };
    } else if (docObj.doctorId && typeof docObj.doctorId === 'object') {
      docObj.doctorDetails = {
        fullName: docObj.doctorId.fullName || 'Specialist',
        email: docObj.doctorId.email || '',
        phoneNumber: docObj.doctorId.phoneNumber || '',
        specialization: 'Medical Specialist',
        hospital: 'Hospital Affiliated',
      };
    }

    return docObj;
  });
};

/**
 * @desc    Create a new prescription (Doctor only)
 * @route   POST /api/prescriptions
 * @access  Private / Doctor
 */
const createPrescription = async (req, res, next) => {
  try {
    const {
      patientId,
      appointmentId,
      consultationId,
      diagnosis,
      clinicalNotes,
      medications,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    const patientUser = await User.findById(patientId);
    if (!patientUser || patientUser.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Target patient user not found',
      });
    }

    if (!Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Medications must be a non-empty list of prescribed items',
      });
    }

    const validatedMedications = [];
    for (const item of medications) {
      if (!item.medicineName || !item.dosage || !item.frequency || !item.duration) {
        return res.status(400).json({
          success: false,
          message: 'Each medication must include medicineName, dosage, frequency, and duration',
        });
      }
      validatedMedications.push({
        medicineName: String(item.medicineName).trim(),
        dosage: String(item.dosage).trim(),
        frequency: String(item.frequency).trim(),
        duration: String(item.duration).trim(),
        instructions: item.instructions ? String(item.instructions).trim() : '',
      });
    }

    const prescription = await Prescription.create({
      patientId,
      doctorId: req.user._id,
      appointmentId: appointmentId && mongoose.Types.ObjectId.isValid(appointmentId) ? appointmentId : null,
      consultationId: consultationId && mongoose.Types.ObjectId.isValid(consultationId) ? consultationId : null,
      diagnosis: diagnosis ? String(diagnosis).trim() : '',
      clinicalNotes: clinicalNotes ? String(clinicalNotes).trim() : '',
      medications: validatedMedications,
      status: 'active',
    });

    // Automatically generate day-by-day medication schedules for the patient
    try {
      await generateSchedulesForPrescription(prescription);
    } catch (schedErr) {
      console.warn('Auto-schedule generation warning:', schedErr);
    }

    const populated = await Prescription.findById(prescription._id)
      .populate('doctorId', 'fullName email phoneNumber')
      .populate('patientId', 'fullName email phoneNumber');

    const formatted = (await formatPrescriptionsWithDoctorInfo([populated]))[0];

    return res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all prescriptions for the logged-in patient (Patient only)
 * @route   GET /api/prescriptions/my
 * @access  Private / Patient
 */
const getMyPrescriptions = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    // 1. Fetch from Prescription collection
    let prescriptions = await Prescription.find({ patientId })
      .populate('doctorId', 'fullName email phoneNumber')
      .populate('appointmentId', 'appointmentDate timeSlot status')
      .sort({ createdAt: -1 });

    // 2. Backward compatibility: if patient has older consultations with prescriptions
    // that don't have a standalone Prescription doc yet, sync them automatically
    const consultationsWithMeds = await Consultation.find({
      patientId,
      'prescriptions.0': { $exists: true },
    }).populate('doctorId', 'fullName email phoneNumber');

    for (const cons of consultationsWithMeds) {
      const alreadyHas = prescriptions.some(
        (p) => p.consultationId && p.consultationId.toString() === cons._id.toString()
      );

      if (!alreadyHas && cons.prescriptions && cons.prescriptions.length > 0) {
        try {
          const synced = await Prescription.create({
            patientId: cons.patientId,
            doctorId: cons.doctorId._id || cons.doctorId,
            appointmentId: cons.appointmentId,
            consultationId: cons._id,
            diagnosis: cons.diagnosis || 'Clinical Consultation',
            clinicalNotes: cons.clinicalNotes || '',
            medications: cons.prescriptions.map((m) => ({
              medicineName: m.medicineName,
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration,
              instructions: m.instructions || '',
            })),
            status: 'active',
            createdAt: cons.createdAt || cons.completedAt || new Date(),
          });

          const populatedSynced = await Prescription.findById(synced._id)
            .populate('doctorId', 'fullName email phoneNumber')
            .populate('appointmentId', 'appointmentDate timeSlot status');

          prescriptions.push(populatedSynced);
        } catch (syncErr) {
          console.warn('Prescription sync warning:', syncErr);
        }
      }
    }

    // Sort by createdAt descending
    prescriptions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 3. Attach doctor details (hospital, specialization)
    const formatted = await formatPrescriptionsWithDoctorInfo(prescriptions);

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single prescription by ID
 * @route   GET /api/prescriptions/:prescriptionId
 * @access  Private (Patient, Doctor, Admin)
 */
const getPrescriptionById = async (req, res, next) => {
  try {
    const { prescriptionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid prescription ID format',
      });
    }

    const prescription = await Prescription.findById(prescriptionId)
      .populate('doctorId', 'fullName email phoneNumber')
      .populate('patientId', 'fullName email phoneNumber')
      .populate('appointmentId', 'appointmentDate timeSlot status');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found',
      });
    }

    // Access control
    if (req.user.role === 'patient') {
      if (prescription.patientId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own prescriptions',
        });
      }
    } else if (req.user.role === 'doctor') {
      if (prescription.doctorId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Doctors can only view prescriptions they issued',
        });
      }
    }

    const formatted = (await formatPrescriptionsWithDoctorInfo([prescription]))[0];

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPrescription,
  getMyPrescriptions,
  getPrescriptionById,
};
