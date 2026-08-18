const mongoose = require('mongoose');
const SymptomCheck = require('../models/SymptomCheck');
const symptomService = require('../services/symptomService');
const openBioLLMService = require('../services/openBioLLMService');

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
    const normalizedInputSymptoms = symptomService.normalizeSymptoms(symptoms);

    // 6. Emergency Safety Layer Check (Deterministic Emergency Rules)
    const isEmergency = symptomService.isEmergencySymptom(normalizedInputSymptoms);

    let finalAnalysis = null;

    if (isEmergency) {
      // Deterministic Emergency Triggered: DO NOT call LLM. Force high risk emergency.
      const ruleResult = symptomService.analyzeSymptoms(
        normalizedInputSymptoms,
        inputDuration,
        inputSeverity
      );
      finalAnalysis = {
        ...ruleResult,
        analysisSource: 'rule-based-emergency',
        modelName: '',
      };
    } else {
      // Non-emergency: Attempt OpenBioLLM Inference
      try {
        const aiResult = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
          normalizedInputSymptoms,
          inputDuration,
          inputSeverity
        );

        // Calculate controlled MediHeal risk level (LLM confidence is not clinical risk)
        let computedRisk = 'low';
        if (inputSeverity === 'severe') computedRisk = 'medium';
        else if (inputSeverity === 'moderate') computedRisk = 'low';

        finalAnalysis = {
          symptoms: normalizedInputSymptoms,
          duration: inputDuration,
          severity: inputSeverity,
          possibleCondition: aiResult.topCondition,
          possibleConditions: aiResult.possibleConditions,
          riskLevel: computedRisk,
          recommendedSpecialist: aiResult.recommendedSpecialist,
          guidance: aiResult.guidance,
          matchedSymptoms: normalizedInputSymptoms,
          emergencyRecommended: false,
          disclaimer: symptomService.MEDICAL_DISCLAIMER,
          analysisSource: 'openbiollm',
          modelName: aiResult.modelName,
        };
      } catch (aiError) {
        // Log AI error server-side silently, fallback to safe rule-based engine
        console.warn('OpenBioLLM inference failed, invoking rule-based fallback:', aiError.message);
        const fallbackResult = symptomService.analyzeSymptoms(
          normalizedInputSymptoms,
          inputDuration,
          inputSeverity
        );
        finalAnalysis = {
          ...fallbackResult,
          analysisSource: 'rule-based-fallback',
          modelName: '',
        };
      }
    }

    // 7. Save record to database
    const symptomCheck = await SymptomCheck.create({
      patientId,
      symptoms: finalAnalysis.symptoms,
      duration: finalAnalysis.duration,
      severity: finalAnalysis.severity,
      possibleCondition: finalAnalysis.possibleCondition,
      possibleConditions: finalAnalysis.possibleConditions,
      analysisSource: finalAnalysis.analysisSource,
      modelName: finalAnalysis.modelName,
      riskLevel: finalAnalysis.riskLevel,
      recommendedSpecialist: finalAnalysis.recommendedSpecialist,
      guidance: finalAnalysis.guidance,
      matchedSymptoms: finalAnalysis.matchedSymptoms,
      emergencyRecommended: finalAnalysis.emergencyRecommended,
      disclaimer: finalAnalysis.disclaimer,
    });

    return res.status(201).json({
      success: true,
      message: 'Symptom analysis completed successfully',
      analysis: {
        symptomCheckId: symptomCheck._id,
        symptoms: symptomCheck.symptoms,
        possibleCondition: symptomCheck.possibleCondition,
        possibleConditions: symptomCheck.possibleConditions,
        analysisSource: symptomCheck.analysisSource,
        modelName: symptomCheck.modelName,
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
