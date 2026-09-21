const mongoose = require('mongoose');
const CaregiverLink = require('../models/CaregiverLink');
const MedicationSchedule = require('../models/MedicationSchedule');
const {
  formatDateKey,
  checkMissedMedications,
} = require('../services/medicationReminderService');

/**
 * Format HH:MM 24h to 12h AM/PM string (e.g. "10:00" -> "10:00 AM")
 */
const formatTimeAmPm = (time24) => {
  if (!time24 || typeof time24 !== 'string') return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};

/**
 * @desc    Get missed medications for all patients linked to the caregiver
 * @route   GET /api/caregiver/medications/missed
 * @access  Private / Caregiver
 */
const getCaregiverMissedMedications = async (req, res, next) => {
  try {
    const caregiverId = req.user._id;

    // 1. Fetch all active patient links for this caregiver
    const activeLinks = await CaregiverLink.find({
      caregiverId,
      status: 'active',
    }).populate('patientId', 'fullName email phoneNumber');

    if (!activeLinks || activeLinks.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const patientMap = {};
    const patientIds = [];

    activeLinks.forEach((link) => {
      if (link.patientId && link.patientId._id) {
        const pIdStr = link.patientId._id.toString();
        patientIds.push(link.patientId._id);
        patientMap[pIdStr] = {
          _id: link.patientId._id,
          fullName: link.patientId.fullName || 'Patient',
          phoneNumber: link.patientId.phoneNumber || '',
          email: link.patientId.email || '',
        };
      }
    });

    // 2. Trigger automatic missed medication detection for all linked patients
    for (const pId of patientIds) {
      await checkMissedMedications(pId);
    }

    // 3. Find schedules for linked patients containing MISSED adherence records
    const schedules = await MedicationSchedule.find({
      patientId: { $in: patientIds },
      'adherenceRecords.status': 'MISSED',
    }).lean();

    const missedList = [];

    for (const schedule of schedules) {
      const pInfo = patientMap[schedule.patientId?.toString()] || {
        fullName: 'Patient',
        phoneNumber: '',
        email: '',
      };

      if (!Array.isArray(schedule.adherenceRecords)) continue;

      for (const rec of schedule.adherenceRecords) {
        if (rec.status === 'MISSED') {
          missedList.push({
            patientId: schedule.patientId,
            patientName: pInfo.fullName,
            patientPhone: pInfo.phoneNumber,
            patientEmail: pInfo.email,
            medicine: schedule.medicineName,
            dosage: schedule.dosage,
            time: formatTimeAmPm(rec.scheduledTime),
            scheduledTime24: rec.scheduledTime,
            scheduledDate: rec.scheduledDateStr,
            status: 'MISSED',
            scheduleId: schedule._id,
            recordId: rec._id,
            instructions: schedule.instructions || '',
          });
        }
      }
    }

    // Sort by scheduledDate descending, then scheduledTime24 descending
    missedList.sort((a, b) => {
      const dateCompare = b.scheduledDate.localeCompare(a.scheduledDate);
      if (dateCompare !== 0) return dateCompare;
      return b.scheduledTime24.localeCompare(a.scheduledTime24);
    });

    return res.status(200).json({
      success: true,
      count: missedList.length,
      data: missedList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get today's prescribed medication status for a specific linked patient
 * @route   GET /api/caregiver/medications/patient/:patientId/today
 * @access  Private / Caregiver
 */
const getCaregiverPatientTodayMedications = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const caregiverId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    // Verify active link
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

    // Update missed statuses
    await checkMissedMedications(patientId);

    const targetDateStr = req.query.date ? String(req.query.date).trim() : formatDateKey(new Date());

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
          medicineName: schedule.medicineName,
          dosage: schedule.dosage,
          scheduledTime: rec.scheduledTime,
          scheduledTimeFormatted: formatTimeAmPm(rec.scheduledTime),
          status: rec.status, // 'PENDING' | 'TAKEN' | 'MISSED'
          takenAt: rec.takenAt,
          instructions: schedule.instructions || '',
        });
      }
    }

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

module.exports = {
  getCaregiverMissedMedications,
  getCaregiverPatientTodayMedications,
};
