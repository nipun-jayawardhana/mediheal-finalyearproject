const mongoose = require('mongoose');
const MedicationSchedule = require('../models/MedicationSchedule');
const Prescription = require('../models/Prescription');
const {
  formatDateKey,
  generateSchedulesForPrescription,
} = require('../services/medicationScheduleService');
const { checkMissedMedications } = require('../services/medicationReminderService');
const { markReminderReadOnDoseTaken } = require('../services/medicationNotificationService');

/**
 * @desc    Get today's medication schedule for logged-in patient
 * @route   GET /api/medication-schedules/my
 * @access  Private / Patient
 */
const getMyTodayMedicationSchedules = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    // Self-healing: Ensure any active prescriptions without schedules get them generated
    try {
      const activePrescriptions = await Prescription.find({
        patientId,
        status: 'active',
      });

      for (const presc of activePrescriptions) {
        const scheduleCount = await MedicationSchedule.countDocuments({
          prescriptionId: presc._id,
        });
        if (scheduleCount === 0) {
          await generateSchedulesForPrescription(presc);
        }
      }
    } catch (syncErr) {
      console.warn('Prescription-schedule sync warning:', syncErr);
    }

    // Run automatic missed medication detection for this patient
    try {
      await checkMissedMedications(patientId);
    } catch (missedErr) {
      console.warn('Missed medication check warning:', missedErr);
    }

    // Determine target date string (client date or server local date)
    const targetDateStr = req.query.date ? String(req.query.date).trim() : formatDateKey(new Date());

    // Find all schedules for this patient
    const schedules = await MedicationSchedule.find({ patientId }).lean();

    const todayTasks = [];

    for (const schedule of schedules) {
      if (!Array.isArray(schedule.adherenceRecords)) continue;

      const matchingRecords = schedule.adherenceRecords.filter(
        (rec) => rec.scheduledDateStr === targetDateStr
      );

      for (const rec of matchingRecords) {
        todayTasks.push({
          _id: rec._id,
          scheduleId: schedule._id,
          prescriptionId: schedule.prescriptionId,
          doctorId: schedule.doctorId,
          medicineName: schedule.medicineName,
          dosage: schedule.dosage,
          frequency: schedule.frequency,
          duration: schedule.duration,
          instructions: schedule.instructions || '',
          scheduledTime: rec.scheduledTime,
          status: rec.status, // 'PENDING' | 'TAKEN' | 'MISSED'
          takenAt: rec.takenAt,
          dayNumber: rec.dayNumber,
          scheduledDate: rec.scheduledDateStr,
        });
      }
    }

    // Sort chronologically by scheduledTime (e.g. "08:00", "14:00", "20:00")
    todayTasks.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    return res.status(200).json({
      success: true,
      count: todayTasks.length,
      data: todayTasks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a scheduled medicine dose as taken
 * @route   POST /api/medication-schedules/:id/taken
 * @access  Private / Patient
 */
const markScheduleDoseTaken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patientId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule or task ID format',
      });
    }

    // Case 1: :id is the adherenceRecord subdocument _id
    let schedule = await MedicationSchedule.findOne({
      'adherenceRecords._id': id,
      patientId,
    });

    let targetRecord = null;

    if (schedule) {
      targetRecord = schedule.adherenceRecords.id(id);
    } else {
      // Case 2: :id is the parent MedicationSchedule _id
      schedule = await MedicationSchedule.findOne({
        _id: id,
        patientId,
      });

      if (schedule && Array.isArray(schedule.adherenceRecords)) {
        const todayStr = req.body.scheduledDate || formatDateKey(new Date());
        const timeFilter = req.body.scheduledTime ? String(req.body.scheduledTime).trim() : null;

        if (timeFilter) {
          targetRecord = schedule.adherenceRecords.find(
            (r) => r.scheduledDateStr === todayStr && r.scheduledTime === timeFilter
          );
        }

        if (!targetRecord) {
          // Find first pending record for today
          targetRecord = schedule.adherenceRecords.find(
            (r) => r.scheduledDateStr === todayStr && r.status === 'PENDING'
          );
        }

        if (!targetRecord) {
          // Find earliest pending record overall
          targetRecord = schedule.adherenceRecords.find((r) => r.status === 'PENDING');
        }
      }
    }

    if (!schedule || !targetRecord) {
      return res.status(404).json({
        success: false,
        message: 'Medication schedule dose not found or access denied',
      });
    }

    // Check if already taken
    if (targetRecord.status === 'TAKEN') {
      return res.status(400).json({
        success: false,
        message: 'This medication dose has already been marked as taken',
        data: targetRecord,
      });
    }

    // Update status to TAKEN with current timestamp
    targetRecord.status = 'TAKEN';
    targetRecord.takenAt = new Date();

    await schedule.save();

    // Auto-mark any active reminder for this dose as read
    await markReminderReadOnDoseTaken(schedule._id, targetRecord._id);

    return res.status(200).json({
      success: true,
      message: 'Medication dose marked as taken successfully',
      data: {
        _id: targetRecord._id,
        scheduleId: schedule._id,
        medicineName: schedule.medicineName,
        dosage: schedule.dosage,
        scheduledTime: targetRecord.scheduledTime,
        status: targetRecord.status,
        takenAt: targetRecord.takenAt,
        scheduledDate: targetRecord.scheduledDateStr,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get medication adherence history for logged-in patient
 * @route   GET /api/medication-schedules/history
 * @access  Private / Patient
 */
const getMedicationHistory = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    const schedules = await MedicationSchedule.find({ patientId })
      .populate('doctorId', 'fullName email')
      .lean();

    const historyItems = [];
    let totalScheduled = 0;
    let totalTaken = 0;

    for (const schedule of schedules) {
      if (!Array.isArray(schedule.adherenceRecords)) continue;

      for (const rec of schedule.adherenceRecords) {
        totalScheduled += 1;
        if (rec.status === 'TAKEN') {
          totalTaken += 1;
        }

        // Include in history log
        historyItems.push({
          _id: rec._id,
          scheduleId: schedule._id,
          medicineName: schedule.medicineName,
          dosage: schedule.dosage,
          scheduledDate: rec.scheduledDateStr,
          scheduledTime: rec.scheduledTime,
          dayNumber: rec.dayNumber,
          status: rec.status,
          takenAt: rec.takenAt,
          doctorName: schedule.doctorId?.fullName || 'Specialist',
          instructions: schedule.instructions || '',
        });
      }
    }

    // Sort history items descending by takenAt (if taken) or scheduledDate + scheduledTime
    historyItems.sort((a, b) => {
      const timeA = a.takenAt ? new Date(a.takenAt).getTime() : new Date(`${a.scheduledDate}T${a.scheduledTime}`).getTime();
      const timeB = b.takenAt ? new Date(b.takenAt).getTime() : new Date(`${b.scheduledDate}T${b.scheduledTime}`).getTime();
      return timeB - timeA;
    });

    const adherencePercentage =
      totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;

    return res.status(200).json({
      success: true,
      count: historyItems.length,
      stats: {
        totalScheduled,
        totalTaken,
        adherencePercentage,
      },
      data: historyItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get missed medications for logged-in patient
 * @route   GET /api/medication-schedules/missed
 * @access  Private / Patient
 */
const getPatientMissedMedications = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    // Trigger detection
    try {
      await checkMissedMedications(patientId);
    } catch (missedErr) {
      console.warn('Missed medication check warning:', missedErr);
    }

    // Query schedules containing MISSED records
    const schedules = await MedicationSchedule.find({
      patientId,
      'adherenceRecords.status': 'MISSED',
    }).lean();

    const missedItems = [];

    for (const schedule of schedules) {
      if (!Array.isArray(schedule.adherenceRecords)) continue;

      for (const rec of schedule.adherenceRecords) {
        if (rec.status === 'MISSED') {
          missedItems.push({
            _id: rec._id,
            scheduleId: schedule._id,
            medicineName: schedule.medicineName,
            dosage: schedule.dosage,
            scheduledTime: rec.scheduledTime,
            status: 'MISSED',
            scheduledDate: rec.scheduledDateStr,
            instructions: schedule.instructions || '',
          });
        }
      }
    }

    // Sort by scheduledDate desc, scheduledTime desc
    missedItems.sort((a, b) => {
      const dateCmp = b.scheduledDate.localeCompare(a.scheduledDate);
      if (dateCmp !== 0) return dateCmp;
      return b.scheduledTime.localeCompare(a.scheduledTime);
    });

    return res.status(200).json({
      success: true,
      count: missedItems.length,
      data: missedItems,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyTodayMedicationSchedules,
  markScheduleDoseTaken,
  getMedicationHistory,
  getPatientMissedMedications,
};
