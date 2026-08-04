const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      unique: true,
    },
    slmcNumber: {
      type: String,
      required: [true, 'SLMC registration number is required'],
      unique: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: [true, 'Medical specialization is required'],
      trim: true,
    },
    hospital: {
      type: String,
      required: [true, 'Hospital / clinic affiliation is required'],
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
      min: [0, 'Years of experience cannot be negative'],
    },
    consultationFee: {
      type: Number,
      default: 0,
      min: [0, 'Consultation fee cannot be negative'],
    },
    languages: {
      type: [String],
      default: ['English'],
    },
    availableDays: {
      type: [String],
      default: [],
    },
    availableTimeSlots: {
      type: [String],
      default: [],
    },
    biography: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    isAvailable: {
      type: Boolean,
      default: true,
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

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);

module.exports = DoctorProfile;
