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

const DEFAULT_TIMES = ['08:00', '20:00'];

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Standard dose times for N doses per day
 */
const timesForDailyCount = (count) => {
  if (count <= 1) return ['08:00'];
  if (count === 2) return ['08:00', '20:00'];
  if (count === 3) return ['08:00', '14:00', '20:00'];
  if (count === 4) return ['08:00', '12:00', '16:00', '20:00'];
  // 5+ doses: spread evenly across waking hours (06:00 - 22:00), rounded to 30 minutes
  const step = (16 * 60) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const mins = Math.round((6 * 60 + i * step) / 30) * 30;
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  });
};

/**
 * Parse a human/medical frequency string into a dosing plan.
 * Returns { times: ['HH:MM', ...], intervalDays, asNeeded }.
 *
 * Order matters: specific patterns (counts, hourly intervals, 1-0-1 notation) are
 * checked before generic words like "daily", so "3x Daily" yields three doses.
 */
const parseFrequency = (frequencyStr) => {
  if (!frequencyStr || typeof frequencyStr !== 'string') {
    return { times: DEFAULT_TIMES, intervalDays: 1, asNeeded: false };
  }

  const clean = frequencyStr.toLowerCase().replace(/\s+/g, ' ').trim();
  const has = (re) => re.test(clean);

  // As needed (PRN / SOS): no fixed schedule, so no reminders or missed-dose tracking
  if (has(/\b(prn|sos)\b|as needed|as required|when needed|if needed|when required/)) {
    return { times: [], intervalDays: 1, asNeeded: true };
  }

  // Day interval: alternate days / every N days / weekly
  let intervalDays = 1;
  const everyNDays = clean.match(/every (\d+) days?/);
  if (has(/every other day|alternate days?|\beod\b/)) intervalDays = 2;
  else if (everyNDays) intervalDays = Math.max(1, parseInt(everyNDays[1], 10));
  else if (has(/weekly|once a week|every week|per week/)) intervalDays = 7;

  // Morning-noon-night notation, e.g. "1-0-1" or "1-1-1-1"
  const dashMatch = clean.match(/\b([01])\s*-\s*([01])\s*-\s*([01])(?:\s*-\s*([01]))?\b/);
  if (dashMatch) {
    const slots = dashMatch[4] !== undefined
      ? ['08:00', '13:00', '18:00', '21:00']
      : ['08:00', '14:00', '20:00'];
    const flags = dashMatch.slice(1, slots.length + 1);
    const times = slots.filter((_, i) => flags[i] === '1');
    if (times.length > 0) return { times, intervalDays, asNeeded: false };
  }

  // Every N hours
  const everyNHours = clean.match(/every (\d+) ?(?:hours?|hrs?|h)\b/);
  if (everyNHours) {
    const hours = parseInt(everyNHours[1], 10);
    if (hours >= 24) {
      return { times: ['08:00'], intervalDays: Math.max(1, Math.round(hours / 24)), asNeeded: false };
    }
    if (hours >= 6) {
      // every 6/8/12 hours -> standard 4/3/2 doses a day
      return { times: timesForDailyCount(Math.floor(24 / hours)), intervalDays, asNeeded: false };
    }
    if (hours >= 1) {
      // Short intervals: keep doses within waking hours (06:00 - 22:00)
      const times = [];
      for (let h = 6; h <= 22; h += hours) times.push(`${pad2(h)}:00`);
      return { times, intervalDays, asNeeded: false };
    }
  }

  // Explicit daily count
  let count = null;
  const numericCount = clean.match(/\b(\d+) ?(?:x|times?)\b/) || clean.match(/\bx ?(\d+)\b/);
  if (numericCount) count = parseInt(numericCount[1], 10);
  else if (has(/\bfour times\b|\bqid\b|\bqds\b/)) count = 4;
  else if (has(/\bthrice\b|\bthree times\b|\btid\b|\btds\b/)) count = 3;
  else if (has(/\btwice\b|\btwo times\b|\bbd\b|\bbid\b/)) count = 2;
  else if (has(/\bonce\b|\bone time\b|\bod\b|\bdaily\b|every day|\bmane\b|\bnocte\b|\bhs\b/)) count = 1;

  // Single dose: honour the time of day if one is mentioned
  if (count === null || count === 1) {
    if (has(/night|bedtime|\bhs\b|\bnocte\b/)) return { times: ['21:00'], intervalDays, asNeeded: false };
    if (has(/evening/)) return { times: ['18:00'], intervalDays, asNeeded: false };
    if (has(/afternoon|\bnoon\b|lunch/)) return { times: ['13:00'], intervalDays, asNeeded: false };
    if (has(/morning|\bmane\b|breakfast/)) return { times: ['08:00'], intervalDays, asNeeded: false };
  }

  if (count !== null && count >= 1) {
    return { times: timesForDailyCount(Math.min(count, 12)), intervalDays, asNeeded: false };
  }

  // Weekly / alternate-day without an explicit count: one dose on each dosing day
  if (intervalDays > 1) {
    return { times: ['08:00'], intervalDays, asNeeded: false };
  }

  return { times: DEFAULT_TIMES, intervalDays: 1, asNeeded: false };
};

/**
 * Parse human/medical frequency string into daily scheduled times (24h format)
 */
const parseFrequencyToTimes = (frequencyStr) => parseFrequency(frequencyStr).times;

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

    const { times: scheduledTimes, intervalDays, asNeeded } = parseFrequency(med.frequency);
    // As-needed medicines stay visible on the prescription but get no timed doses
    if (asNeeded || scheduledTimes.length === 0) continue;

    const durationDays = parseDurationToDays(med.duration);

    // Compute start and end dates
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (durationDays - 1));
    endDate.setHours(23, 59, 59, 999);

    // Generate day-by-day adherence records across duration
    const adherenceRecords = [];
    // Interval courses (alternate day / weekly): if today's slots already passed, start tomorrow
    // instead of waiting a full interval for the first dose.
    let firstDay = 0;
    if (intervalDays > 1) {
      const lastSlot = scheduledTimes[scheduledTimes.length - 1].split(':').map(Number);
      const lastSlotToday = new Date(startDate);
      lastSlotToday.setHours(lastSlot[0], lastSlot[1], 0, 0);
      if (lastSlotToday < baseDate) firstDay = 1;
    }

    for (let d = firstDay; d < durationDays; d += intervalDays) {
      const recordDate = new Date(startDate);
      recordDate.setDate(startDate.getDate() + d);
      const scheduledDateStr = formatDateKey(recordDate);

      for (const timeStr of scheduledTimes) {
        // Skip dose slots that had already passed when the prescription was written,
        // otherwise they are immediately flagged as MISSED.
        const [h, m] = timeStr.split(':').map(Number);
        const slotDateTime = new Date(recordDate);
        slotDateTime.setHours(h, m, 0, 0);
        if (slotDateTime < baseDate) continue;

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
  parseFrequency,
  parseFrequencyToTimes,
  parseDurationToDays,
  generateSchedulesForPrescription,
};
