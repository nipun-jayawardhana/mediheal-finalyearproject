const MedicationSchedule = require('../models/MedicationSchedule');
const {
  formatDateKey,
  checkMissedMedications,
} = require('./medicationReminderService');

/**
 * Valid supported date range filters
 */
const VALID_RANGES = ['7d', '30d', '90d', 'all'];

/**
 * Calculate start cutoff date string for the given range filter
 * @param {string} range - '7d' | '30d' | '90d' | 'all'
 * @param {Date} referenceDate - default now
 * @returns {string|null} 'YYYY-MM-DD' or null if 'all'
 */
const getStartDateCutoff = (range, referenceDate = new Date()) => {
  const d = new Date(referenceDate);
  // Reset hours to start of day for clean date-only comparisons
  d.setHours(0, 0, 0, 0);

  switch (range) {
    case '7d':
      d.setDate(d.getDate() - 7);
      return formatDateKey(d);
    case '30d':
      d.setDate(d.getDate() - 30);
      return formatDateKey(d);
    case '90d':
      d.setDate(d.getDate() - 90);
      return formatDateKey(d);
    case 'all':
    default:
      return null;
  }
};

/**
 * Calculate comprehensive medication adherence analytics for a patient.
 * Real adherence data is evaluated dynamically on-request from MedicationSchedule.adherenceRecords.
 *
 * @param {string} patientId - MongoDB ObjectId of patient
 * @param {string} range - '7d' | '30d' | '90d' | 'all' (default: '30d')
 * @returns {Promise<Object>} Adherence analytics result payload
 */
const calculateAdherenceAnalytics = async (patientId, range = '30d') => {
  // Normalize and validate range
  const normalizedRange = VALID_RANGES.includes(range) ? range : '30d';

  // 1. Ensure any pending doses that passed their grace period are updated to MISSED
  await checkMissedMedications(patientId);

  // 2. Determine start date cutoff string
  const startDateCutoffStr = getStartDateCutoff(normalizedRange);

  // 3. Query all medication schedules for this patient
  const schedules = await MedicationSchedule.find({ patientId }).lean();

  let totalTaken = 0;
  let totalMissed = 0;
  let totalPending = 0;

  const dailyMap = {};
  const missedTimeMap = {};
  const medications = [];

  for (const schedule of schedules) {
    let schedTaken = 0;
    let schedMissed = 0;
    let schedPending = 0;

    if (Array.isArray(schedule.adherenceRecords)) {
      for (const rec of schedule.adherenceRecords) {
        // Apply date range filter (records strictly older than cutoff are excluded)
        if (startDateCutoffStr && rec.scheduledDateStr < startDateCutoffStr) {
          continue;
        }

        if (rec.status === 'TAKEN') {
          totalTaken++;
          schedTaken++;
        } else if (rec.status === 'MISSED') {
          totalMissed++;
          schedMissed++;

          // Aggregate missed dose times (e.g. "08:00", "14:00")
          const timeKey = rec.scheduledTime || '00:00';
          missedTimeMap[timeKey] = (missedTimeMap[timeKey] || 0) + 1;
        } else if (rec.status === 'PENDING') {
          totalPending++;
          schedPending++;
        }

        // Daily trend tracking for evaluated and active records
        const dateKey = rec.scheduledDateStr;
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { taken: 0, missed: 0 };
        }
        if (rec.status === 'TAKEN') {
          dailyMap[dateKey].taken++;
        } else if (rec.status === 'MISSED') {
          dailyMap[dateKey].missed++;
        }
      }
    }

    const totalEvaluated = schedTaken + schedMissed;
    const schedAdherence =
      totalEvaluated > 0
        ? Math.round((schedTaken / totalEvaluated) * 100)
        : null;

    medications.push({
      scheduleId: schedule._id,
      prescriptionId: schedule.prescriptionId,
      medicineName: schedule.medicineName,
      dosage: schedule.dosage,
      taken: schedTaken,
      missed: schedMissed,
      pending: schedPending,
      totalEvaluated,
      adherencePercentage: schedAdherence,
    });
  }

  // Core formula: adherencePercentage = totalTaken / (totalTaken + totalMissed) * 100
  // Future PENDING doses are strictly excluded from the denominator
  const totalScheduledEvaluated = totalTaken + totalMissed;
  const hasEnoughData = totalScheduledEvaluated > 0;
  const adherencePercentage = hasEnoughData
    ? Math.round((totalTaken / totalScheduledEvaluated) * 100)
    : null;

  // Compile daily trends sorted chronologically
  const dailyTrend = Object.keys(dailyMap)
    .sort()
    .map((date) => {
      const dayData = dailyMap[date];
      const dayEvaluated = dayData.taken + dayData.missed;
      return {
        date,
        taken: dayData.taken,
        missed: dayData.missed,
        percentage:
          dayEvaluated > 0
            ? Math.round((dayData.taken / dayEvaluated) * 100)
            : null,
      };
    });

  // Compile missed times sorted chronologically by HH:mm
  const missedByTime = Object.keys(missedTimeMap)
    .sort()
    .map((time) => ({
      time,
      missedCount: missedTimeMap[time],
    }));

  return {
    success: true,
    range: normalizedRange,
    summary: {
      totalScheduledEvaluated,
      totalTaken,
      totalMissed,
      totalPending,
      adherencePercentage,
      hasEnoughData,
    },
    dailyTrend,
    medications,
    missedByTime,
  };
};

module.exports = {
  VALID_RANGES,
  getStartDateCutoff,
  calculateAdherenceAnalytics,
};
