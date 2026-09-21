const MedicationSchedule = require('../models/MedicationSchedule');

const DEFAULT_GRACE_PERIOD_MINUTES = 60;

/**
 * Format a Date object to YYYY-MM-DD string
 */
const formatDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if a scheduled dose is past its grace period threshold.
 * @param {string} scheduledDateStr - 'YYYY-MM-DD'
 * @param {string} scheduledTime - 'HH:MM' (24-hour)
 * @param {number} gracePeriodMinutes - default 60
 * @param {Date} referenceNow - optional reference date
 * @returns {boolean}
 */
const isDoseMissed = (
  scheduledDateStr,
  scheduledTime,
  gracePeriodMinutes = DEFAULT_GRACE_PERIOD_MINUTES,
  referenceNow = new Date()
) => {
  if (!scheduledDateStr || !scheduledTime) return false;

  const [targetYear, targetMonth, targetDay] = scheduledDateStr.split('-').map(Number);
  const [schedHours, schedMinutes] = scheduledTime.split(':').map(Number);

  if (
    isNaN(targetYear) ||
    isNaN(targetMonth) ||
    isNaN(targetDay) ||
    isNaN(schedHours) ||
    isNaN(schedMinutes)
  ) {
    return false;
  }

  // Scheduled date & time
  const scheduledDateTime = new Date(
    targetYear,
    targetMonth - 1,
    targetDay,
    schedHours,
    schedMinutes,
    0,
    0
  );

  // Threshold time = scheduled time + grace period (e.g. 60 min)
  const thresholdDateTime = new Date(
    scheduledDateTime.getTime() + gracePeriodMinutes * 60 * 1000
  );

  return referenceNow.getTime() > thresholdDateTime.getTime();
};

/**
 * Check and update missed medication status for a patient or all active schedules
 * Runs safely multiple times; idempotent.
 *
 * @param {string|null} patientId - Optional target patient ID
 * @param {number} gracePeriodMinutes - Optional grace period in minutes (default 60)
 * @param {Date} referenceNow - Optional reference time for testing
 * @returns {Promise<Array>} List of newly detected or active missed dose items
 */
const checkMissedMedications = async (
  patientId = null,
  gracePeriodMinutes = DEFAULT_GRACE_PERIOD_MINUTES,
  referenceNow = new Date()
) => {
  const filter = {};
  if (patientId) {
    filter.patientId = patientId;
  }
  filter['adherenceRecords.status'] = 'PENDING';

  const schedules = await MedicationSchedule.find(filter);
  const updatedMissed = [];

  for (const schedule of schedules) {
    let hasModifications = false;

    if (!Array.isArray(schedule.adherenceRecords)) continue;

    for (const record of schedule.adherenceRecords) {
      if (record.status === 'PENDING') {
        if (
          isDoseMissed(
            record.scheduledDateStr,
            record.scheduledTime,
            gracePeriodMinutes,
            referenceNow
          )
        ) {
          record.status = 'MISSED';
          hasModifications = true;

          updatedMissed.push({
            scheduleId: schedule._id,
            recordId: record._id,
            patientId: schedule.patientId,
            medicineName: schedule.medicineName,
            dosage: schedule.dosage,
            scheduledTime: record.scheduledTime,
            scheduledDate: record.scheduledDateStr,
            instructions: schedule.instructions || '',
            status: 'MISSED',
          });
        }
      }
    }

    if (hasModifications) {
      await schedule.save();
    }
  }

  return updatedMissed;
};

module.exports = {
  DEFAULT_GRACE_PERIOD_MINUTES,
  formatDateKey,
  isDoseMissed,
  checkMissedMedications,
};
