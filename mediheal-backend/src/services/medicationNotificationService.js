const MedicationSchedule = require('../models/MedicationSchedule');
const Notification = require('../models/Notification');

const REMINDER_ADVANCE_MINUTES = 15;

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
 * Check if the current time is within or past the reminder trigger window
 * (i.e., scheduled time minus 15 minutes)
 *
 * @param {string} scheduledDateStr - 'YYYY-MM-DD'
 * @param {string} scheduledTime - 'HH:MM' (24-hr)
 * @param {number} advanceMinutes - default 15
 * @param {Date} referenceNow - optional reference time
 * @returns {boolean}
 */
const isReminderDue = (
  scheduledDateStr,
  scheduledTime,
  advanceMinutes = REMINDER_ADVANCE_MINUTES,
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

  // Trigger time = scheduled time minus advance minutes (e.g. 15 min before)
  const triggerDateTime = new Date(
    scheduledDateTime.getTime() - advanceMinutes * 60 * 1000
  );

  return referenceNow.getTime() >= triggerDateTime.getTime();
};

/**
 * Generate medication reminders for a patient for today's doses.
 * Evaluates pending doses whose reminder window (15 mins prior) has arrived.
 * Idempotent: Only creates once per dose record.
 *
 * @param {string} userId - Patient User ID
 * @param {Date} referenceNow - Optional reference time for testing
 * @returns {Promise<Array>} List of newly created notifications
 */
const generateMedicationReminders = async (userId, referenceNow = new Date()) => {
  if (!userId) return [];

  const todayStr = formatDateKey(referenceNow);

  // Find active medication schedules for the patient that have adherence records for today
  const schedules = await MedicationSchedule.find({
    patientId: userId,
    'adherenceRecords.scheduledDateStr': todayStr,
  });

  const createdNotifications = [];

  for (const schedule of schedules) {
    if (!Array.isArray(schedule.adherenceRecords)) continue;

    for (const record of schedule.adherenceRecords) {
      if (record.scheduledDateStr !== todayStr) continue;

      // 1. Pending doses: check if 15-minute advance reminder window has opened
      if (record.status === 'PENDING') {
        if (isReminderDue(record.scheduledDateStr, record.scheduledTime, REMINDER_ADVANCE_MINUTES, referenceNow)) {
          // Check if notification already exists (prevent duplicate)
          const existing = await Notification.findOne({
            userId,
            type: 'MEDICATION_REMINDER',
            scheduleId: schedule._id,
            recordId: record._id,
          });

          if (!existing) {
            const newNotif = await Notification.create({
              userId,
              type: 'MEDICATION_REMINDER',
              title: 'Medication Reminder',
              message: `Time to take ${schedule.medicineName} (${schedule.dosage})`,
              relatedMedicationId: schedule._id,
              scheduleId: schedule._id,
              recordId: record._id,
              medicineName: schedule.medicineName,
              dosage: schedule.dosage,
              scheduledTime: record.scheduledTime,
              scheduledDate: record.scheduledDateStr,
              status: 'UNREAD',
            });
            createdNotifications.push(newNotif);
          }
        }
      }

      // 2. Missed doses: notify if not already notified
      if (record.status === 'MISSED') {
        const existingMissed = await Notification.findOne({
          userId,
          type: 'MISSED_MEDICATION',
          scheduleId: schedule._id,
          recordId: record._id,
        });

        if (!existingMissed) {
          const newNotif = await Notification.create({
            userId,
            type: 'MISSED_MEDICATION',
            title: 'Missed Medication',
            message: `You missed your scheduled dose of ${schedule.medicineName} (${schedule.dosage})`,
            relatedMedicationId: schedule._id,
            scheduleId: schedule._id,
            recordId: record._id,
            medicineName: schedule.medicineName,
            dosage: schedule.dosage,
            scheduledTime: record.scheduledTime,
            scheduledDate: record.scheduledDateStr,
            status: 'UNREAD',
          });
          createdNotifications.push(newNotif);
        }
      }
    }
  }

  return createdNotifications;
};

/**
 * Automatically mark medication reminder notifications as read when a patient marks the dose as taken
 *
 * @param {string} scheduleId
 * @param {string} recordId
 */
const markReminderReadOnDoseTaken = async (scheduleId, recordId) => {
  if (!scheduleId || !recordId) return;

  try {
    await Notification.updateMany(
      {
        scheduleId,
        recordId,
        status: 'UNREAD',
      },
      {
        $set: {
          status: 'READ',
          readAt: new Date(),
        },
      }
    );
  } catch (err) {
    console.error('Error auto-marking reminder read on dose taken:', err);
  }
};

module.exports = {
  REMINDER_ADVANCE_MINUTES,
  formatDateKey,
  isReminderDue,
  generateMedicationReminders,
  markReminderReadOnDoseTaken,
};
