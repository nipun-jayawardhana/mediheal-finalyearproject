const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
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
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    timeSlot: {
      type: String,
      required: [true, 'Time slot is required'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
        message: '{VALUE} is not a valid status. Allowed: pending, confirmed, completed, cancelled, rescheduled',
      },
      default: 'pending',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    rescheduleHistory: [
      {
        oldDate: { type: Date, required: true },
        oldTime: { type: String, required: true },
        newDate: { type: Date, required: true },
        newTime: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
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

// Index to optimize duplicate booking lookups
appointmentSchema.index({ doctorId: 1, appointmentDate: 1, timeSlot: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
