const mongoose = require('mongoose');

const caregiverLinkSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver ID is required'],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'removed'],
        message: '{VALUE} is not a valid status. Allowed: active, removed',
      },
      default: 'active',
    },
    linkedAt: {
      type: Date,
      default: Date.now,
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

// Index to optimize lookup by caregiver and patient
caregiverLinkSchema.index({ caregiverId: 1, patientId: 1 });

const CaregiverLink = mongoose.model('CaregiverLink', caregiverLinkSchema);

module.exports = CaregiverLink;
