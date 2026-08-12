const mongoose = require('mongoose');
const SymptomCheck = require('../models/SymptomCheck');
const symptomService = require('../services/symptomService');

/**
 * @desc    Analyze symptoms and recommend specialist
 * @route   POST /api/symptoms/analyze
 * @access  Private (Patient only)
 */
const analyzeSymptoms = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const { symptoms, duration, severity } = req.body;

    // 1. Validation: symptoms array presence and type
    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({
        success: false,
        message: 'Symptoms must be provided as a non-empty array of strings',
      });
    }

    // 2. Validation: empty symptoms array
    if (symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one symptom',
      });
    }

    // 3. Validation: excessive input (limit symptoms array size)
    if (symptoms.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 symptoms allowed per analysis request',
      });
    }

    // 4. Validation: check individual symptom strings
    for (const sym of symptoms) {
      if (typeof sym !== 'string' || sym.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Symptom items cannot be blank or non-string values',
        });
      }
      if (sym.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Each symptom string must not exceed 100 characters',
        });
      }
    }

    // 5. Validation: optional severity field
    const validSeverities = ['mild', 'moderate', 'severe'];
    let inputSeverity = severity ? String(severity).toLowerCase().trim() : 'mild';
    if (severity && !validSeverities.includes(inputSeverity)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid severity value. Allowed values: mild, moderate, severe',
      });
    }

    const inputDuration = typeof duration === 'string' ? duration.trim() : '';

    // 6. Perform symptom analysis via service
    const analysisResult = symptomService.analyzeSymptoms(
      symptoms,
      inputDuration,
      inputSeverity
    );

    // 7. Save record to database using patientId from req.user._id
    const symptomCheck = await SymptomCheck.create({
      patientId,
      symptoms: analysisResult.symptoms,
      duration: analysisResult.duration,
      severity: analysisResult.severity,
      possibleCondition: analysisResult.possibleCondition,
      riskLevel: analysisResult.riskLevel,
      recommendedSpecialist: analysisResult.recommendedSpecialist,
      guidance: analysisResult.guidance,
      matchedSymptoms: analysisResult.matchedSymptoms,
      emergencyRecommended: analysisResult.emergencyRecommended,
      disclaimer: analysisResult.disclaimer,
    });

    return res.status(201).json({
      success: true,
      message: 'Symptom analysis completed successfully',
      analysis: {
        symptomCheckId: symptomCheck._id,
        symptoms: symptomCheck.symptoms,
        possibleCondition: symptomCheck.possibleCondition,
        riskLevel: symptomCheck.riskLevel,
        recommendedSpecialist: symptomCheck.recommendedSpecialist,
        guidance: symptomCheck.guidance,
        matchedSymptoms: symptomCheck.matchedSymptoms,
        emergencyRecommended: symptomCheck.emergencyRecommended,
        disclaimer: symptomCheck.disclaimer,
        createdAt: symptomCheck.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient's symptom check history
 * @route   GET /api/symptoms/history
 * @access  Private (Patient only)
 */
const getSymptomHistory = async (req, res, next) => {
  try {
    const patientId = req.user._id;

    const history = await SymptomCheck.find({ patientId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single symptom check by ID
 * @route   GET /api/symptoms/:symptomCheckId
 * @access  Private (Patient only)
 */
const getSymptomCheckById = async (req, res, next) => {
  try {
    const { symptomCheckId } = req.params;

    // Validate ObjectId before query
    if (!mongoose.Types.ObjectId.isValid(symptomCheckId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symptom check ID format',
      });
    }

    const symptomCheck = await SymptomCheck.findById(symptomCheckId);

    if (!symptomCheck) {
      return res.status(404).json({
        success: false,
        message: 'Symptom check record not found',
      });
    }

    // Ownership check: patient can access only their own history
    if (symptomCheck.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this symptom check record',
      });
    }

    return res.status(200).json({
      success: true,
      data: symptomCheck,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeSymptoms,
  getSymptomHistory,
  getSymptomCheckById,
};
