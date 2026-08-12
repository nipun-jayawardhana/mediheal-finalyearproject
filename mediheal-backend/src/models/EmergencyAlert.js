const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID reference is required'],
    },
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
    message: {
      type: String,
      required: [true, 'Emergency message is required'],
      trim: true,
      maxlength: [500, 'Emergency message cannot exceed 500 characters'],
    },
    emergencyContactName: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    caregiverIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: {
        values: ['active', 'resolved', 'cancelled'],
        message: '{VALUE} is not a valid emergency alert status. Allowed: active, resolved, cancelled',
      },
      default: 'active',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
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

// Optimize database queries for emergency alert lookups
emergencyAlertSchema.index({ patientId: 1, status: 1 });
emergencyAlertSchema.index({ caregiverIds: 1, status: 1 });

const EmergencyAlert = mongoose.model('EmergencyAlert', emergencyAlertSchema);

module.exports = EmergencyAlert;
