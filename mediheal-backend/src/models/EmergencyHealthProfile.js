const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: '',
    },
    relationship: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const emergencyHealthProfileSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      unique: true,
      index: true,
    },
    bloodGroup: {
      type: String,
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
        message: '{VALUE} is not a valid blood group. Allowed: A+, A-, B+, B-, AB+, AB-, O+, O-, Unknown',
      },
      default: 'Unknown',
    },
    allergies: {
      type: [String],
      default: [],
    },
    hasNoKnownAllergies: {
      type: Boolean,
      default: false,
    },
    chronicConditions: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({ name: '', relationship: '', phone: '' }),
    },
    emergencyNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Emergency notes cannot exceed 1000 characters'],
      default: '',
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

const EmergencyHealthProfile = mongoose.model('EmergencyHealthProfile', emergencyHealthProfileSchema);

module.exports = EmergencyHealthProfile;
