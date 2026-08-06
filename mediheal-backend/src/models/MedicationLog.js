const mongoose = require('mongoose');

const medicationLogSchema = new mongoose.Schema(
  {
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: [true, 'Medication ID is required'],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    scheduledTime: {
      type: String,
      required: [true, 'Scheduled time is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'taken', 'missed'],
        message: '{VALUE} is not a valid status. Allowed: pending, taken, missed',
      },
      default: 'pending',
    },
    takenAt: {
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

// Compound index to ensure uniqueness per medication, scheduled date, and scheduled time
medicationLogSchema.index(
  { medicationId: 1, scheduledDate: 1, scheduledTime: 1 },
  { unique: true }
);

const MedicationLog = mongoose.model('MedicationLog', medicationLogSchema);

module.exports = MedicationLog;
