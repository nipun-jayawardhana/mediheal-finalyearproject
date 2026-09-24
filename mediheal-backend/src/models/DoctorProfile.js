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
    weeklyAvailability: [
      {
        dayOfWeek: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        startTime: {
          type: String,
          default: '09:00',
        },
        endTime: {
          type: String,
          default: '17:00',
        },
        enabled: {
          type: Boolean,
          default: true,
        },
        slotDuration: {
          type: Number,
          enum: [15, 20, 30, 45, 60],
          default: 30,
        },
      },
    ],
    defaultSlotDuration: {
      type: Number,
      enum: [15, 20, 30, 45, 60],
      default: 30,
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
