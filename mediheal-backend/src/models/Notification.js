const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['MEDICATION_REMINDER', 'MISSED_MEDICATION', 'MEDICATION_TAKEN'],
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
      default: 'MEDICATION_REMINDER',
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    relatedMedicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicationSchedule',
      default: null,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicationSchedule',
      default: null,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    medicineName: {
      type: String,
      trim: true,
      default: '',
    },
    dosage: {
      type: String,
      trim: true,
      default: '',
    },
    scheduledTime: {
      type: String,
      trim: true,
      default: '',
    },
    scheduledDate: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['UNREAD', 'READ'],
        message: '{VALUE} is not a valid status. Allowed: UNREAD, READ',
      },
      default: 'UNREAD',
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, scheduleId: 1, recordId: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
