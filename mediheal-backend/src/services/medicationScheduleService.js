const MedicationSchedule = require('../models/MedicationSchedule');

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
 * Parse human/medical frequency string into daily scheduled times (24h format)
 */
const parseFrequencyToTimes = (frequencyStr) => {
  if (!frequencyStr || typeof frequencyStr !== 'string') {
    return ['08:00', '20:00'];
  }

  const clean = frequencyStr.toLowerCase().trim();

  // 4 times daily / QID
  if (
    clean.includes('4 time') ||
    clean.includes('four time') ||
    clean.includes('qid') ||
    clean.includes('every 6 hour')
  ) {
    return ['08:00', '12:00', '16:00', '20:00'];
  }

  // 3 times daily / TID / TDS
  if (
    clean.includes('3 time') ||
    clean.includes('three time') ||
    clean.includes('tid') ||
    clean.includes('tds') ||
    clean.includes('every 8 hour')
  ) {
    return ['08:00', '14:00', '20:00'];
  }

  // 2 times daily / BD / BID
  if (
    clean.includes('2 time') ||
    clean.includes('two time') ||
    clean.includes('twice') ||
    clean.includes('bd') ||
    clean.includes('bid') ||
    clean.includes('every 12 hour')
  ) {
    return ['08:00', '20:00'];
  }

  // Once daily / OD
  if (
    clean.includes('once') ||
    clean.includes('1 time') ||
    clean.includes('one time') ||
    clean.includes('od') ||
    clean.includes('every day') ||
    clean.includes('daily')
  ) {
    return ['08:00'];
  }

  // Night only / HS / bedtime
  if (clean.includes('night') || clean.includes('bedtime') || clean.includes('hs')) {
    return ['21:00'];
  }

  // Fallback: check any digit in string
  const digitMatch = clean.match(/(\d+)\s*(?:times?|x)/);
  if (digitMatch) {
    const times = parseInt(digitMatch[1], 10);
    if (times === 1) return ['08:00'];
    if (times === 2) return ['08:00', '20:00'];
    if (times === 3) return ['08:00', '14:00', '20:00'];
    if (times >= 4) return ['08:00', '12:00', '16:00', '20:00'];
  }

  return ['08:00', '20:00'];
};

/**
 * Parse human duration string into integer day count
 */
const parseDurationToDays = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') {
    return 5;
  }

  const clean = durationStr.toLowerCase().trim();

  // Look for number + unit
  const match = clean.match(/(\d+)\s*(day|week|month)?/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2] ? match[2].toLowerCase() : 'day';

    if (unit.startsWith('week')) {
      return Math.min(Math.max(num * 7, 1), 90);
    }
    if (unit.startsWith('month')) {
      return Math.min(Math.max(num * 30, 1), 90);
    }
    return Math.min(Math.max(num, 1), 90);
  }

  // Common phrase check
  if (clean.includes('one week') || clean.includes('1 week')) return 7;
  if (clean.includes('two week') || clean.includes('2 week')) return 14;
  if (clean.includes('one month') || clean.includes('1 month')) return 30;

  return 5;
};

/**
 * Generate MedicationSchedule documents from a Prescription document
 */
const generateSchedulesForPrescription = async (prescription) => {
  if (!prescription || !prescription.medications || !Array.isArray(prescription.medications)) {
    return [];
  }

  const createdSchedules = [];
  const baseDate = prescription.createdAt ? new Date(prescription.createdAt) : new Date();

  for (const med of prescription.medications) {
    if (!med.medicineName) continue;

    // Avoid duplicate schedule for the same prescription & medicine
    const existing = await MedicationSchedule.findOne({
      prescriptionId: prescription._id,
      medicineName: med.medicineName.trim(),
    });

    if (existing) {
      createdSchedules.push(existing);
      continue;
    }

    const scheduledTimes = parseFrequencyToTimes(med.frequency);
    const durationDays = parseDurationToDays(med.duration);

    // Compute start and end dates
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (durationDays - 1));
    endDate.setHours(23, 59, 59, 999);

    // Generate day-by-day adherence records across duration
    const adherenceRecords = [];
    for (let d = 0; d < durationDays; d++) {
      const recordDate = new Date(startDate);
      recordDate.setDate(startDate.getDate() + d);
      const scheduledDateStr = formatDateKey(recordDate);

      for (const timeStr of scheduledTimes) {
        adherenceRecords.push({
          scheduledDate: recordDate,
          scheduledDateStr,
          dayNumber: d + 1,
          scheduledTime: timeStr,
          status: 'PENDING',
          takenAt: null,
        });
      }
    }

    const schedule = await MedicationSchedule.create({
      prescriptionId: prescription._id,
      patientId: prescription.patientId?._id || prescription.patientId,
      doctorId: prescription.doctorId?._id || prescription.doctorId,
      medicineName: med.medicineName.trim(),
      dosage: med.dosage.trim(),
      frequency: med.frequency.trim(),
      scheduledTimes,
      duration: med.duration.trim(),
      startDate,
      endDate,
      instructions: med.instructions ? med.instructions.trim() : '',
      adherenceRecords,
    });

    createdSchedules.push(schedule);
  }

  return createdSchedules;
};

module.exports = {
  formatDateKey,
  parseFrequencyToTimes,
  parseDurationToDays,
  generateSchedulesForPrescription,
};
