const mongoose = require('mongoose');
const SymptomCheck = require('../models/SymptomCheck');
const symptomService = require('../services/symptomService');
const openBioLLMService = require('../services/openBioLLMService');
const geminiConversationService = require('../services/geminiConversationService');
const geminiTranslationService = require('../services/geminiTranslationService');

/**
 * @desc    Analyze symptoms and recommend specialist
 * @route   POST /api/symptoms/analyze
 * @access  Private (Patient only)
 */
const analyzeSymptoms = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const patientId = req.user._id;
    const { symptoms, duration, severity, analysisRequestId, language = 'en' } = req.body;
    const targetLang = language === 'Sinhala' ? 'si' : language === 'Tamil' ? 'ta' : (language || 'en');
    const reqId = typeof analysisRequestId === 'string' && analysisRequestId.trim() ? analysisRequestId.trim() : `req-${Math.random().toString(36).substring(2, 8)}`;
    const tag = `[SYMPTOM API][${reqId}]`;

    console.log(`${tag} Request received`);

    // 0. Idempotency Check: Avoid duplicate processing if client retried with same request ID
    if (typeof analysisRequestId === 'string' && analysisRequestId.trim()) {
      const existingCheck = await SymptomCheck.findOne({
        patientId,
        analysisRequestId: analysisRequestId.trim(),
      });

      if (existingCheck) {
        const elapsed = Date.now() - startTime;
        console.log(`${tag} Idempotency hit: Returning existing SymptomCheck record ${existingCheck._id} in ${elapsed}ms`);
        return res.status(200).json({
          success: true,
          message: 'Symptom analysis completed successfully (cached result)',
          analysis: {
            symptomCheckId: existingCheck._id,
            symptoms: existingCheck.symptoms,
            possibleCondition: existingCheck.possibleCondition,
            possibleConditions: existingCheck.possibleConditions,
            analysisSource: existingCheck.analysisSource,
            modelName: existingCheck.modelName,
            riskLevel: existingCheck.riskLevel,
            recommendedSpecialist: existingCheck.recommendedSpecialist,
            guidance: existingCheck.guidance,
            matchedSymptoms: existingCheck.matchedSymptoms,
            emergencyRecommended: existingCheck.emergencyRecommended,
            disclaimer: existingCheck.disclaimer,
            createdAt: existingCheck.createdAt,
          },
        });
      }
    }

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

    // 3.5 Defense-in-Depth: Decompose natural-language symptom text >100 chars into concise concept phrases
    let sanitizedSymptoms = [];
    for (const sym of symptoms) {
      if (typeof sym !== 'string') continue;
      const clean = sym.trim();
      if (!clean) continue;

      if (clean.length <= 100) {
        if (!sanitizedSymptoms.includes(clean)) sanitizedSymptoms.push(clean);
      } else {
        const clauses = clean
          .split(/[,;\.]|\s+(?:and|with|spreading to|as well as|feeling like|like a feeling)\s+/i)
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        for (const clause of clauses) {
          const concise = clause.length > 100 ? clause.substring(0, 97) + '...' : clause;
          if (!sanitizedSymptoms.includes(concise)) {
            sanitizedSymptoms.push(concise);
          }
        }
      }
    }

    if (sanitizedSymptoms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one valid symptom string',
      });
    }

    if (sanitizedSymptoms.length > 20) {
      sanitizedSymptoms = sanitizedSymptoms.slice(0, 20);
    }

    // 4. Validation: check individual symptom strings
    for (const sym of sanitizedSymptoms) {
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

    // Multilingual Input Translation: Convert Sinhala/Tamil/raw symptoms into Canonical English
    let canonicalConcepts = [...sanitizedSymptoms];
    let detectedInputLang = targetLang;

    if (targetLang !== 'en' || sanitizedSymptoms.some((s) => /[^\x00-\x7F]/.test(s))) {
      const transStart = Date.now();
      const translated = await geminiTranslationService.translateInputToCanonicalEnglish(
        sanitizedSymptoms.join(', '),
        targetLang
      );
      const transElapsed = Date.now() - transStart;
      console.log(`[TRANSLATION][${reqId}] Input translation completed in ${transElapsed}ms`);

      if (translated && translated.englishText) {
        detectedInputLang = translated.detectedLanguage || targetLang;
        if (Array.isArray(translated.symptomConcepts) && translated.symptomConcepts.length > 0) {
          canonicalConcepts = translated.symptomConcepts;
        }
      }
    }

    const normalizedInputSymptoms = symptomService.normalizeSymptoms(canonicalConcepts);

    // 6. Emergency Safety Layer Check (Evaluates raw input, canonical concepts, and normalized concepts)
    const isEmergency = symptomService.isEmergencySymptom([
      ...symptoms,
      ...sanitizedSymptoms,
      ...canonicalConcepts,
      ...normalizedInputSymptoms,
    ]);

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
      // Non-emergency: Attempt OpenBioLLM Inference using Canonical English ONLY
      try {
        const aiResult = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
          normalizedInputSymptoms,
          inputDuration,
          inputSeverity,
          reqId
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
        console.warn(`${tag} OpenBioLLM inference failed (${aiError.message})`);
        console.log(`${tag} Using rule-based fallback`);
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

    // 7. Save canonical English record to database
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
      analysisRequestId: typeof analysisRequestId === 'string' ? analysisRequestId.trim() : '',
      inputLanguage: detectedInputLang,
      displayLanguage: targetLang,
    });

    // 8. Output Translation: Translate patient-facing analysis result fields if targetLang != 'en'
    const outTransStart = Date.now();
    const translatedOutput = await geminiTranslationService.translateAnalysisResult(
      finalAnalysis,
      targetLang
    );
    const outTransElapsed = Date.now() - outTransStart;
    console.log(`[TRANSLATION][${reqId}] Result translation completed in ${outTransElapsed}ms`);

    const elapsed = Date.now() - startTime;
    console.log(`${tag} Response sent in ${elapsed}ms (Lang: ${targetLang})`);

    return res.status(201).json({
      success: true,
      message: 'Symptom analysis completed successfully',
      analysis: {
        symptomCheckId: symptomCheck._id,
        symptoms: symptomCheck.symptoms,
        possibleCondition: translatedOutput.displayPossibleCondition || symptomCheck.possibleCondition,
        possibleConditions: translatedOutput.displayPossibleConditions || symptomCheck.possibleConditions,
        analysisSource: symptomCheck.analysisSource,
        modelName: symptomCheck.modelName,
        riskLevel: symptomCheck.riskLevel,
        recommendedSpecialist: symptomCheck.recommendedSpecialist,
        displayRecommendedSpecialist: translatedOutput.displayRecommendedSpecialist || symptomCheck.recommendedSpecialist,
        guidance: translatedOutput.displayGuidance || symptomCheck.guidance,
        matchedSymptoms: symptomCheck.matchedSymptoms,
        emergencyRecommended: symptomCheck.emergencyRecommended,
        disclaimer: translatedOutput.displayDisclaimer || symptomCheck.disclaimer,
        emergencyWarning: translatedOutput.displayEmergencyWarning || '',
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

    const targetLang = req.query.language === 'Sinhala' ? 'si' : req.query.language === 'Tamil' ? 'ta' : (req.query.language || 'en');
    let responseData = symptomCheck.toObject();

    if (targetLang !== 'en') {
      const translatedOutput = await geminiTranslationService.translateAnalysisResult(symptomCheck, targetLang);
      responseData.possibleCondition = translatedOutput.displayPossibleCondition || symptomCheck.possibleCondition;
      responseData.possibleConditions = translatedOutput.displayPossibleConditions || symptomCheck.possibleConditions;
      responseData.displayRecommendedSpecialist = translatedOutput.displayRecommendedSpecialist || symptomCheck.recommendedSpecialist;
      responseData.guidance = translatedOutput.displayGuidance || symptomCheck.guidance;
      responseData.disclaimer = translatedOutput.displayDisclaimer || symptomCheck.disclaimer;
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get next conversational follow-up question or structured summary
 * @route   POST /api/symptoms/follow-up
 * @access  Private (Patient only)
 */
const handleFollowUp = async (req, res, next) => {
  try {
    const { symptoms, conversation = [], questionCount = 0, language = 'en' } = req.body;
    const targetLang = language === 'Sinhala' ? 'si' : language === 'Tamil' ? 'ta' : (language || 'en');

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Symptoms must be provided as a non-empty array of strings',
      });
    }

    // 0. Input Translation for Follow-Up if input is non-English
    let canonicalSymptoms = [...symptoms];
    if (targetLang !== 'en' || symptoms.some((s) => /[^\x00-\x7F]/.test(s))) {
      const inputTrans = await geminiTranslationService.translateInputToCanonicalEnglish(
        symptoms.join(', '),
        targetLang
      );
      if (inputTrans && inputTrans.symptomConcepts && inputTrans.symptomConcepts.length > 0) {
        canonicalSymptoms = inputTrans.symptomConcepts;
      }
    }

    // 1. Gather all text from initial symptoms and conversation Q&As for emergency evaluation
    const allInputStrings = [...symptoms, ...canonicalSymptoms];
    if (Array.isArray(conversation)) {
      conversation.forEach((c) => {
        if (c.question) allInputStrings.push(c.question);
        if (c.answer) allInputStrings.push(c.answer);
      });
    }

    const normalizedAll = symptomService.normalizeSymptoms(allInputStrings);

    // 2. Deterministic Emergency Safety Check on ALL cumulative conversation context
    const isEmergency = symptomService.isEmergencySymptom(normalizedAll);

    if (isEmergency) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'emergency',
          isEmergency: true,
          summary: {
            symptoms: symptomService.normalizeSymptoms(canonicalSymptoms),
            duration: 'acute',
            severity: 'severe',
            additionalContext: ['Emergency red flag symptoms detected during follow-up conversation.'],
          },
          emergencyWarning: targetLang === 'si'
            ? 'අධික අවදානම් රෝග ලක්ෂණ හඳුනාගෙන ඇත! වහාම වෛද්‍ය උපදෙස් ලබා ගන්න.'
            : targetLang === 'ta'
            ? 'அதிக ஆபத்து அறிகுறிகள் கண்டறியப்பட்டுள்ளன! உடனடியாக மருத்துவ உதவியை நாடுங்கள்.'
            : 'High risk symptoms detected. Immediate medical attention is recommended.',
        },
      });
    }

    // 3. Non-emergency: Generate next follow-up question or structured summary via Gemini
    const result = await geminiConversationService.generateFollowUp(
      canonicalSymptoms,
      conversation,
      questionCount
    );

    // 4. Translate question and quick options into patient target language if non-English
    if (result && result.status === 'ask' && result.question && targetLang !== 'en') {
      const qTrans = await geminiTranslationService.translateFollowUpQuestion(
        result.question,
        result.quickOptions || [],
        targetLang
      );
      result.question = qTrans.translatedQuestion;
      if (qTrans.translatedQuickOptions) {
        result.quickOptions = qTrans.translatedQuickOptions;
      }
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeSymptoms,
  getSymptomHistory,
  getSymptomCheckById,
  handleFollowUp,
};
