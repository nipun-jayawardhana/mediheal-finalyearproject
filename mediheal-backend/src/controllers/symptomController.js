const mongoose = require('mongoose');
const SymptomCheck = require('../models/SymptomCheck');
const symptomService = require('../services/symptomService');
const openBioLLMService = require('../services/openBioLLMService');
const geminiConversationService = require('../services/geminiConversationService');
const geminiTranslationService = require('../services/geminiTranslationService');
const clinicalCaseService = require('../services/clinicalCaseService');

/**
 * @desc    Analyze symptoms and recommend specialist
 * @route   POST /api/symptoms/analyze
 * @access  Private (Patient only)
 */
const analyzeSymptoms = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const patientId = req.user._id;
    const {
      symptoms,
      duration,
      severity,
      conversation = [],
      positiveSymptoms: bodyPos,
      negativeFindings: bodyNeg,
      context: bodyCtx,
      analysisRequestId,
      language = 'en',
    } = req.body;
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
            positiveSymptoms: existingCheck.positiveSymptoms || existingCheck.symptoms,
            negativeFindings: existingCheck.negativeFindings || [],
            context: existingCheck.context || [],
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

    // Decompose natural text into concise phrases
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

    // Validation: optional severity field
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
    let translatedDuration = '';

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
        if (translated.duration) {
          translatedDuration = translated.duration;
        }
      }
    }

    // Secondary duration check on raw inputs if inputDuration was not provided
    const parsedTextDuration = inputDuration || translatedDuration || clinicalCaseService.extractDurationFromText(symptoms.join(' ')) || clinicalCaseService.extractDurationFromText(sanitizedSymptoms.join(' '));

    // ASSEMBLE ONE CANONICAL CLINICAL CASE BEFORE OPENBIOLLM
    const clinicalCase = clinicalCaseService.buildCanonicalClinicalCase({
      symptoms: canonicalConcepts,
      conversation: Array.isArray(conversation) ? conversation : [],
      duration: parsedTextDuration,
      severity: inputSeverity,
      positiveSymptoms: bodyPos,
      negativeFindings: bodyNeg,
      context: bodyCtx,
    });

    const normalizedInputSymptoms = symptomService.normalizeSymptoms([
      ...clinicalCase.positiveSymptoms,
      ...clinicalCase.context,
    ]);

    // Emergency Safety Layer Check
    const isEmergency = symptomService.isEmergencySymptom([
      ...symptoms,
      ...sanitizedSymptoms,
      ...canonicalConcepts,
      ...clinicalCase.positiveSymptoms,
      ...clinicalCase.context,
    ]);

    // LOG EXACT CLINICAL CASE BEFORE OPENBIOLLM INFERENCE
    console.log(`[CLINICAL CASE][${reqId}] (isEmergency: ${isEmergency})`);
    console.log('Positive symptoms:');
    console.log(clinicalCase.positiveSymptoms.join(' |\n') || 'none');
    console.log('\nNegative findings:');
    console.log(clinicalCase.negativeFindings.join(' |\n') || 'none');
    console.log('\nDuration:');
    console.log(clinicalCase.duration || 'unspecified');
    console.log('\nSeverity:');
    console.log(clinicalCase.severity || 'not explicitly rated');
    console.log('\nAdditional details:');
    console.log((clinicalCase.additionalDetails && clinicalCase.additionalDetails.length > 0) ? clinicalCase.additionalDetails.join(' |\n') : 'none');

    // Attempt OpenBioLLM Inference using Complete Canonical Case
    try {
      const aiResult = await openBioLLMService.analyzeSymptomsWithOpenBioLLM(
        clinicalCase,
        reqId
      );

      // Calculate base controlled MediHeal risk level
      let computedRisk = 'low';
      if (clinicalCase.severity === 'severe') computedRisk = 'medium';
      else if (clinicalCase.severity === 'moderate') computedRisk = 'low';

      finalAnalysis = {
        symptoms: clinicalCase.positiveSymptoms,
        positiveSymptoms: clinicalCase.positiveSymptoms,
        negativeFindings: clinicalCase.negativeFindings,
        context: clinicalCase.context,
        additionalDetails: clinicalCase.additionalDetails || [],
        duration: clinicalCase.duration,
        severity: clinicalCase.severity,
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
      const fallbackResult = symptomService.analyzeSymptoms(clinicalCase);
      finalAnalysis = {
        ...fallbackResult,
        analysisSource: isEmergency ? 'rule-based-emergency' : 'rule-based-fallback',
        modelName: '',
      };
    }

    // 4. SAFETY OVERRIDE MUST WIN: Deterministic emergency classification overrides model risk
    if (isEmergency) {
      finalAnalysis.riskLevel = 'high';
      finalAnalysis.emergencyRecommended = true;
      if (!Array.isArray(finalAnalysis.guidance)) {
        finalAnalysis.guidance = [symptomService.MEDICAL_DISCLAIMER];
      }
      if (!finalAnalysis.guidance.some(g => g.toLowerCase().includes('immediate') || g.toLowerCase().includes('emergency'))) {
        finalAnalysis.guidance.unshift('Seek immediate professional medical assistance.');
      }
    }

    // Save canonical record to database
    const symptomCheck = await SymptomCheck.create({
      patientId,
      symptoms: finalAnalysis.positiveSymptoms && finalAnalysis.positiveSymptoms.length > 0 ? finalAnalysis.positiveSymptoms : finalAnalysis.symptoms,
      positiveSymptoms: clinicalCase.positiveSymptoms,
      negativeFindings: clinicalCase.negativeFindings,
      context: clinicalCase.context,
      additionalDetails: clinicalCase.additionalDetails || [],
      conversation: Array.isArray(conversation) ? conversation : [],
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

    // 3. Generate next follow-up question or structured summary via Gemini
    let result = await geminiConversationService.generateFollowUp(
      canonicalSymptoms,
      conversation,
      questionCount
    );

    if (!result) {
      result = {
        status: 'complete',
        summary: {
          symptoms: symptomService.normalizeSymptoms(canonicalSymptoms),
          duration: 'unspecified',
          severity: null,
          additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
        },
      };
    }

    // Attach non-blocking emergency metadata to result if high-risk triggers detected
    if (isEmergency) {
      result.isEmergency = true;
      result.emergencyFlag = true;
      result.emergencyWarning = targetLang === 'si'
        ? 'අධික අවදානම් රෝග ලක්ෂණ හඳුනාගෙන ඇත! වහාම වෛද්‍ය උපදෙස් ලබා ගන්න.'
        : targetLang === 'ta'
        ? 'அதிக ஆபத்து அறிகுறிகள் கண்டறியப்பட்டுள்ளன! உடனடியாக மருத்துவ உதவியை நாடுங்கள்.'
        : 'High risk symptoms detected. Immediate medical attention is recommended.';
    }

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
