const mongoose = require('mongoose');

const symptomCheckSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID reference is required'],
    },
    symptoms: {
      type: [String],
      required: [true, 'Symptoms array is required'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one symptom must be provided',
      },
    },
    positiveSymptoms: {
      type: [String],
      default: [],
    },
    negativeFindings: {
      type: [String],
      default: [],
    },
    context: {
      type: [String],
      default: [],
    },
    additionalDetails: {
      type: [String],
      default: [],
    },
    conversation: [
      {
        question: { type: String, trim: true },
        answer: { type: String, trim: true },
      },
    ],
    duration: {
      type: String,
      trim: true,
      default: '',
    },
    severity: {
      type: String,
      enum: {
        values: ['mild', 'moderate', 'severe', null, ''],
        message: '{VALUE} is not a valid severity option. Allowed: mild, moderate, severe',
      },
      default: null,
    },
    possibleCondition: {
      type: String,
      required: [true, 'Possible condition is required'],
      trim: true,
    },
    possibleConditions: [
      {
        condition: { type: String, trim: true },
        confidence: { type: String, trim: true, default: 'medium' },
      },
    ],
    analysisSource: {
      type: String,
      enum: ['openbiollm', 'rule-based-fallback', 'rule-based-emergency'],
      default: 'rule-based-fallback',
    },
    modelName: {
      type: String,
      trim: true,
      default: '',
    },
    riskLevel: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: '{VALUE} is not a valid risk level. Allowed: low, medium, high',
      },
      required: [true, 'Risk level is required'],
    },
    recommendedSpecialist: {
      type: String,
      required: [true, 'Recommended specialist is required'],
      trim: true,
    },
    guidance: {
      type: [String],
      required: [true, 'Guidance array is required'],
    },
    matchedSymptoms: {
      type: [String],
      default: [],
    },
    emergencyRecommended: {
      type: Boolean,
      default: false,
    },
    disclaimer: {
      type: String,
      required: [true, 'Disclaimer is required'],
      trim: true,
    },
    analysisRequestId: {
      type: String,
      trim: true,
      default: '',
    },
    inputLanguage: {
      type: String,
      trim: true,
      default: 'en',
    },
    displayLanguage: {
      type: String,
      trim: true,
      default: 'en',
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

const SymptomCheck = mongoose.model('SymptomCheck', symptomCheckSchema);

module.exports = SymptomCheck;
