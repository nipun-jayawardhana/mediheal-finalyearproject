const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const MedicationLog = require('../models/MedicationLog');
const CaregiverLink = require('../models/CaregiverLink');

/**
 * @desc    Add a new medication for a patient (Caregiver only, active link required)
 * @route   POST /api/medications
 * @access  Private / Caregiver
 */
const addMedication = async (req, res, next) => {
  try {
    const {
      patientId,
      medicineName,
      dosage,
      frequency,
      timeSlots,
      startDate,
      endDate,
      instructions,
    } = req.body;

    // 1. Basic validation for required fields
    if (
      !patientId ||
      !medicineName ||
      !dosage ||
      !frequency ||
      !timeSlots ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide all required fields: patientId, medicineName, dosage, frequency, timeSlots, startDate, endDate',
      });
    }

    // 2. Validate patientId ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // 3. Rule 1: Only a caregiver with an active link to the patient can add medication
    const activeLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only a caregiver with an active link to the patient can add medication',
      });
    }

    // 4. Validate timeSlots array
    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'timeSlots must be a non-empty array of time strings (e.g. ["08:00", "20:00"])',
      });
    }

    // 5. Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate or endDate format',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate cannot be after endDate',
      });
    }

    // 6. Create Medication
    const medication = await Medication.create({
      patientId,
      addedBy: req.user._id,
      medicineName: medicineName.trim(),
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      timeSlots: timeSlots.map((ts) => String(ts).trim()).filter(Boolean),
      startDate: start,
      endDate: end,
      instructions: instructions ? instructions.trim() : '',
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Medication added successfully',
      data: medication,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all medications for a linked patient (Caregiver only)
 * @route   GET /api/medications/patient/:patientId
 * @access  Private / Caregiver
 */
const getPatientMedicationsCaregiver = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // Rule 3: Caregivers can view medication only for patients linked to them
    const activeLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Caregivers can view medication only for patients linked to them',
      });
    }

    const medications = await Medication.find({ patientId })
      .populate('addedBy', 'fullName email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: medications.length,
      data: medications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update medication details (Caregiver only, active link required)
 * @route   PUT /api/medications/:medicationId
 * @access  Private / Caregiver
 */
const updateMedication = async (req, res, next) => {
  try {
    const { medicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(medicationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication ID format',
      });
    }

    const medication = await Medication.findById(medicationId);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Rule 4: Only linked caregivers may update medication
    const activeLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId: medication.patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only linked caregivers may update medication',
      });
    }

    const {
      medicineName,
      dosage,
      frequency,
      timeSlots,
      startDate,
      endDate,
      instructions,
      isActive,
    } = req.body;

    if (medicineName) medication.medicineName = medicineName.trim();
    if (dosage) medication.dosage = dosage.trim();
    if (frequency) medication.frequency = frequency.trim();
    if (Array.isArray(timeSlots) && timeSlots.length > 0) {
      medication.timeSlots = timeSlots.map((ts) => String(ts).trim()).filter(Boolean);
    }
    if (startDate) medication.startDate = new Date(startDate);
    if (endDate) medication.endDate = new Date(endDate);
    if (instructions !== undefined) medication.instructions = instructions.trim();
    if (isActive !== undefined) medication.isActive = Boolean(isActive);

    await medication.save();

    return res.status(200).json({
      success: true,
      message: 'Medication updated successfully',
      data: medication,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate medication (soft delete) (Caregiver only, active link required)
 * @route   DELETE /api/medications/:medicationId
 * @access  Private / Caregiver
 */
const deactivateMedication = async (req, res, next) => {
  try {
    const { medicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(medicationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication ID format',
      });
    }

    const medication = await Medication.findById(medicationId);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Rule 4: Only linked caregivers may deactivate medication
    const activeLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId: medication.patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only linked caregivers may deactivate medication',
      });
    }

    // Rule 5: Do not permanently delete medication. Set isActive to false.
    medication.isActive = false;
    await medication.save();

    return res.status(200).json({
      success: true,
      message: 'Medication deactivated successfully',
      data: medication,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get medication logs for a linked patient (Caregiver only)
 * @route   GET /api/medications/patient/:patientId/logs
 * @access  Private / Caregiver
 */
const getPatientMedicationLogsCaregiver = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // Rule 3: Caregivers can view medication logs only for patients linked to them
    const activeLink = await CaregiverLink.findOne({
      caregiverId: req.user._id,
      patientId,
      status: 'active',
    });

    if (!activeLink) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Caregivers can view medication logs only for patients linked to them',
      });
    }

    const logs = await MedicationLog.find({ patientId })
      .populate('medicationId', 'medicineName dosage frequency timeSlots')
      .sort({ scheduledDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in patient's active medications (Patient only)
 * @route   GET /api/medications/my
 * @access  Private / Patient
 */
const getMyMedications = async (req, res, next) => {
  try {
    // Rule 2: Patients can view only their own active medications
    const medications = await Medication.find({
      patientId: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: medications.length,
      data: medications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a medication dose as taken (Patient only)
 * @route   POST /api/medications/:medicationId/taken
 * @access  Private / Patient
 */
const markDoseTaken = async (req, res, next) => {
  try {
    const { medicationId } = req.params;
    const { scheduledDate, scheduledTime } = req.body;

    // Validate required fields
    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both scheduledDate and scheduledTime',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(medicationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication ID format',
      });
    }

    const medication = await Medication.findById(medicationId);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // 1. Rule 6: Validate that the medication belongs to the logged-in patient
    if (medication.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. A patient can mark only their own medication dose as taken',
      });
    }

    // 2. Validate that the medication is active
    if (!medication.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark dose taken. Medication is currently inactive',
      });
    }

    // 3. Rule 9: Validate that the date is within the medication period (startDate to endDate)
    const inputDate = new Date(scheduledDate);
    if (isNaN(inputDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduledDate format',
      });
    }

    const targetDate = new Date(inputDate);
    targetDate.setHours(0, 0, 0, 0);

    const medStart = new Date(medication.startDate);
    medStart.setHours(0, 0, 0, 0);

    const medEnd = new Date(medication.endDate);
    medEnd.setHours(23, 59, 59, 999);

    if (targetDate < medStart || targetDate > medEnd) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date is outside the active medication period (startDate to endDate)',
      });
    }

    // 4. Rule 8: Validate that scheduledTime exists in timeSlots
    const cleanTime = scheduledTime.trim();
    if (!medication.timeSlots.includes(cleanTime)) {
      return res.status(400).json({
        success: false,
        message: `Scheduled time '${cleanTime}' does not match any allowed time slots for this medication: ${medication.timeSlots.join(', ')}`,
      });
    }

    // 5. Find or create MedicationLog for that medication, date and time
    let log = await MedicationLog.findOne({
      medicationId,
      scheduledDate: targetDate,
      scheduledTime: cleanTime,
    });

    // 6. Rule 7: If already taken, return clear error
    if (log && log.status === 'taken') {
      return res.status(400).json({
        success: false,
        message: 'This medication dose has already been marked as taken',
      });
    }

    // 7. Set status to taken and takenAt to current time
    if (!log) {
      log = await MedicationLog.create({
        medicationId,
        patientId: req.user._id,
        scheduledDate: targetDate,
        scheduledTime: cleanTime,
        status: 'taken',
        takenAt: new Date(),
      });
    } else {
      log.status = 'taken';
      log.takenAt = new Date();
      await log.save();
    }

    const populatedLog = await MedicationLog.findById(log._id).populate(
      'medicationId',
      'medicineName dosage frequency timeSlots'
    );

    return res.status(200).json({
      success: true,
      message: 'Medication dose marked as taken successfully',
      data: populatedLog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in patient's medication logs (Patient only)
 * @route   GET /api/medications/my/logs
 * @access  Private / Patient
 */
const getMyMedicationLogs = async (req, res, next) => {
  try {
    // Rule 2: Patients view only their own logs
    const logs = await MedicationLog.find({ patientId: req.user._id })
      .populate('medicationId', 'medicineName dosage frequency timeSlots')
      .sort({ scheduledDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addMedication,
  getPatientMedicationsCaregiver,
  updateMedication,
  deactivateMedication,
  getPatientMedicationLogsCaregiver,
  getMyMedications,
  markDoseTaken,
  getMyMedicationLogs,
};
