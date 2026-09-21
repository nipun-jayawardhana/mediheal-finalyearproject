const mongoose = require('mongoose');

const adherenceRecordSchema = new mongoose.Schema(
  {
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    scheduledDateStr: {
      type: String,
      required: [true, 'Scheduled date string (YYYY-MM-DD) is required'],
      trim: true,
    },
    dayNumber: {
      type: Number,
      default: 1,
    },
    scheduledTime: {
      type: String,
      required: [true, 'Scheduled time is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'TAKEN', 'MISSED'],
        message: '{VALUE} is not a valid status. Allowed: PENDING, TAKEN, MISSED',
      },
      default: 'PENDING',
    },
    takenAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

const medicationScheduleSchema = new mongoose.Schema(
  {
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      required: [true, 'Prescription ID is required'],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor ID is required'],
    },
    medicineName: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required'],
      trim: true,
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      trim: true,
    },
    scheduledTimes: {
      type: [String],
      required: [true, 'Scheduled times are required'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one scheduled time is required',
      },
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    instructions: {
      type: String,
      trim: true,
      default: '',
    },
    adherenceRecords: {
      type: [adherenceRecordSchema],
      default: [],
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

medicationScheduleSchema.index({ patientId: 1, 'adherenceRecords.scheduledDateStr': 1 });
medicationScheduleSchema.index({ prescriptionId: 1, medicineName: 1 });

const MedicationSchedule = mongoose.model('MedicationSchedule', medicationScheduleSchema);

module.exports = MedicationSchedule;
