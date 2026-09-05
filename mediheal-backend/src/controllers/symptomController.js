const mongoose = require('mongoose');
const SymptomCheck = require('../models/SymptomCheck');
const symptomService = require('../services/symptomService');
const med42Service = require('../services/med42Service');
const geminiConversationService = require('../services/geminiConversationService');
const geminiTranslationService = require('../services/geminiTranslationService');
const geminiMedicalFallbackService = require('../services/geminiMedicalFallbackService');
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
        console.log(`${tag} Persisted SymptomCheck: ${existingCheck._id}`);
        console.log(`${tag} Response record ID: ${existingCheck._id}`);
        console.log(`${tag} Idempotency hit: Returning existing SymptomCheck record ${existingCheck._id} in ${elapsed}ms`);
        return res.status(200).json({
          success: true,
          message: 'Symptom analysis completed successfully (cached result)',
          analysis: {
            _id: existingCheck._id,
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
    let translatedNegatives = [];

    if (targetLang !== 'en' || sanitizedSymptoms.some((s) => /[^\x00-\x7F]/.test(s))) {
      const transStart = Date.now();
      const translated = await geminiTranslationService.translateInputToCanonicalEnglish(
        sanitizedSymptoms.join(', '),
        targetLang
      );
      const transElapsed = Date.now() - transStart;
      console.log(`[TRANSLATION][${reqId}] Input translation completed in ${transElapsed}ms`);

      if (translated) {
        if (translated.isFallback) {
          console.log(`[CANONICAL PRESERVATION] Translation failed\nPrevious canonical case preserved: YES`);
        }
        detectedInputLang = translated.detectedLanguage || targetLang;
        if (Array.isArray(translated.symptomConcepts) && translated.symptomConcepts.length > 0) {
          canonicalConcepts = translated.symptomConcepts;
        }
        if (Array.isArray(translated.negativeFindings) && translated.negativeFindings.length > 0) {
          translatedNegatives = translated.negativeFindings;
        }
        if (translated.duration) {
          translatedDuration = translated.duration;
        }
      }
    }

    // Secondary duration check on raw inputs if inputDuration was not provided
    const parsedTextDuration = inputDuration || translatedDuration || clinicalCaseService.extractDurationFromText(symptoms.join(' ')) || clinicalCaseService.extractDurationFromText(sanitizedSymptoms.join(' '));

    // ASSEMBLE & RECONCILE ONE CANONICAL CLINICAL CASE BEFORE MED42
    let clinicalCase = clinicalCaseService.buildCanonicalClinicalCase({
      symptoms: canonicalConcepts,
      conversation: Array.isArray(conversation) ? conversation : [],
      duration: parsedTextDuration,
      severity: inputSeverity,
      positiveSymptoms: bodyPos,
      negativeFindings: (Array.isArray(bodyNeg) && bodyNeg.length > 0) ? bodyNeg : translatedNegatives,
      context: bodyCtx,
    });

    clinicalCase = clinicalCaseService.reconcilePositiveAndNegativeEvidence(clinicalCase);
    clinicalCaseService.assertCanonicalCaseIntegrity(clinicalCase);

    // DEVELOPMENT INTEGRITY ASSERTION (SECTION 15)
    const conflicts = [];
    for (const pos of clinicalCase.positiveSymptoms) {
      const posClean = clinicalCaseService.cleanConceptKey(pos).toLowerCase();
      for (const neg of clinicalCase.negativeFindings) {
        const negClean = String(neg || '').toLowerCase().trim();
        const coreNeg = negClean.replace(/^(?:no|not|denies|without)\s+/, '').trim();
        if (posClean === coreNeg || negClean.includes(posClean)) {
          conflicts.push({ positive: pos, negative: neg });
        }
      }
    }

    console.log(`[EVIDENCE CHECK][${reqId}]\nPositive:\n${JSON.stringify(clinicalCase.positiveSymptoms, null, 2)}\nNegative:\n${JSON.stringify(clinicalCase.negativeFindings, null, 2)}\nConflicts:\n${JSON.stringify(conflicts, null, 2)}`);

    if (conflicts.length > 0) {
      console.error(`[CLINICAL SAFETY] Positive/negative contradiction detected`);
      clinicalCase = clinicalCaseService.reconcilePositiveAndNegativeEvidence(clinicalCase);
      clinicalCaseService.assertCanonicalCaseIntegrity(clinicalCase);
    }

    const normalizedInputSymptoms = symptomService.normalizeSymptoms([
      ...clinicalCase.positiveSymptoms,
      ...clinicalCase.context,
    ]);

    // Emergency Safety Layer Check on Reconciled Clinical Case ONLY
    const isEmergency = symptomService.isEmergencySymptom(clinicalCase);

    console.log(`[SYMPTOM PIPELINE][${reqId}] Initial input received`);

    // LOG EXACT CLINICAL CASE BEFORE MED42 INFERENCE
    console.log(`[CANONICAL CASE][${reqId}][MED42]\n${JSON.stringify(clinicalCase, null, 2)}`);

    // Automatic equality check in development if summary canonical case passed in request body
    if (Array.isArray(bodyPos) && bodyPos.length > 0) {
      const summaryPosSet = new Set(bodyPos.map(s => String(s).toLowerCase().trim()));
      const med42PosSet = new Set(clinicalCase.positiveSymptoms.map(s => String(s).toLowerCase().trim()));
      let mismatch = summaryPosSet.size !== med42PosSet.size;
      if (!mismatch) {
        for (const s of summaryPosSet) {
          if (!med42PosSet.has(s)) { mismatch = true; break; }
        }
      }
      if (mismatch) {
        console.error(`[CASE INTEGRITY][${reqId}] SUMMARY/MED42 MISMATCH`);
      }
    }

    const GLOBAL_ANALYSIS_DEADLINE_MS = 32000;
    const deadlineAt = startTime + GLOBAL_ANALYSIS_DEADLINE_MS;
    const MINIMUM_GEMINI_BUDGET_MS = 5000;

    let finalAnalysis = null;

    // Attempt Primary Med42 Inference using Complete Canonical Case
    try {
      const aiResult = await med42Service.analyzeSymptomsWithMed42(
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
        analysisSource: 'med42',
        modelName: aiResult.modelName,
      };

      console.log(`[AI FAILOVER][${reqId}] Secondary skipped (primary Med42 succeeded)`);
      console.log(`[SYMPTOM API][${reqId}] Final analysis source: med42`);
    } catch (aiError) {
      console.warn(`${tag} Med42 primary inference failed (${aiError.message})`);

      const remainingBudgetMs = deadlineAt - Date.now();
      let secondarySuccess = false;

      // Attempt Secondary Gemini AI Analysis if remaining time budget is sufficient
      if (remainingBudgetMs >= MINIMUM_GEMINI_BUDGET_MS) {
        try {
          const geminiBudgetMs = Math.min(remainingBudgetMs - 3000, 8000);
          console.log(`[AI FAILOVER][${reqId}] Secondary invoked (reason: primary Med42 failed: ${aiError.message})`);
          console.log(`${tag} Attempting secondary Gemini failover (Remaining budget: ${remainingBudgetMs}ms, Secondary ceiling: ${geminiBudgetMs}ms)`);

          const secondaryResult = await geminiMedicalFallbackService.analyzeSymptomsWithGeminiSecondary(
            clinicalCase,
            reqId,
            geminiBudgetMs
          );

          let computedRisk = 'low';
          if (clinicalCase.severity === 'severe') computedRisk = 'medium';

          finalAnalysis = {
            symptoms: clinicalCase.positiveSymptoms,
            positiveSymptoms: clinicalCase.positiveSymptoms,
            negativeFindings: clinicalCase.negativeFindings,
            context: clinicalCase.context,
            additionalDetails: clinicalCase.additionalDetails || [],
            duration: clinicalCase.duration,
            severity: clinicalCase.severity,
            possibleCondition: secondaryResult.topCondition,
            possibleConditions: secondaryResult.possibleConditions,
            riskLevel: computedRisk,
            recommendedSpecialist: secondaryResult.recommendedSpecialist,
            guidance: secondaryResult.guidance,
            matchedSymptoms: normalizedInputSymptoms,
            emergencyRecommended: false,
            disclaimer: symptomService.MEDICAL_DISCLAIMER,
            analysisSource: 'gemini-secondary',
            modelName: secondaryResult.modelName,
          };
          secondarySuccess = true;
          console.log(`[SYMPTOM API][${reqId}] Final analysis source: gemini-secondary`);
        } catch (secondaryError) {
          console.warn(`${tag} Secondary Gemini failover unavailable (${secondaryError.message})`);
          console.log(`[AI FAILOVER][${reqId}] Secondary skipped (reason: secondary Gemini failed: ${secondaryError.message})`);
        }
      } else {
        console.warn(`${tag} Insufficient budget for secondary AI failover (${remainingBudgetMs}ms remaining < ${MINIMUM_GEMINI_BUDGET_MS}ms minimum)`);
        console.log(`[AI FAILOVER][${reqId}] Secondary skipped (reason: insufficient time budget: ${remainingBudgetMs}ms)`);
      }

      // Final Rule-Based Fallback if both primary and secondary AI fail or budget was insufficient
      if (!secondarySuccess) {
        console.log(`${tag} Using rule-based fallback`);
        const fallbackResult = symptomService.analyzeSymptoms(clinicalCase);
        finalAnalysis = {
          ...fallbackResult,
          analysisSource: isEmergency ? 'rule-based-emergency' : 'rule-based-fallback',
          modelName: '',
        };
        console.log(`[SYMPTOM API][${reqId}] Final analysis source: ${finalAnalysis.analysisSource}`);
      }
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

    console.log(`${tag} Persisted SymptomCheck: ${symptomCheck._id}`);
    console.log(`${tag} Response record ID: ${symptomCheck._id}`);

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
        _id: symptomCheck._id,
        symptomCheckId: symptomCheck._id,
        symptoms: symptomCheck.symptoms,
        positiveSymptoms: symptomCheck.positiveSymptoms,
        negativeFindings: symptomCheck.negativeFindings,
        context: symptomCheck.context,
        possibleCondition: symptomCheck.possibleCondition,
        possibleConditions: symptomCheck.possibleConditions,
        displayPossibleCondition: translatedOutput.displayPossibleCondition || symptomCheck.possibleCondition,
        displayPossibleConditions: translatedOutput.displayPossibleConditions || symptomCheck.possibleConditions,
        displayPositiveSymptoms: translatedOutput.displayPositiveSymptoms || symptomCheck.positiveSymptoms,
        displayContext: translatedOutput.displayContext || symptomCheck.context,
        analysisSource: symptomCheck.analysisSource,
        modelName: symptomCheck.modelName,
        riskLevel: symptomCheck.riskLevel,
        recommendedSpecialist: symptomCheck.recommendedSpecialist,
        displayRecommendedSpecialist: translatedOutput.displayRecommendedSpecialist || symptomCheck.recommendedSpecialist,
        guidance: symptomCheck.guidance,
        displayGuidance: translatedOutput.displayGuidance || symptomCheck.guidance,
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
    const history = await SymptomCheck.find({ patientId })
      .sort({ createdAt: -1 })
      .limit(20);

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
 * @route   GET /api/symptoms/:id
 * @access  Private (Patient only)
 */
const getSymptomCheckById = async (req, res, next) => {
  try {
    const rawParam = req.params.symptomCheckId || req.params.id;
    const symptomCheckId = typeof rawParam === 'string' ? rawParam.trim() : '';

    console.log('[SYMPTOM GET] req.params:', req.params);
    console.log('[SYMPTOM GET] resolved ID:', symptomCheckId || 'MISSING');

    if (!symptomCheckId) {
      console.warn('[SYMPTOM GET] Rejecting request: symptomCheckId parameter is empty');
      return res.status(400).json({
        success: false,
        message: 'Symptom check ID is required',
      });
    }

    const symptomCheck = await SymptomCheck.findById(symptomCheckId);

    if (!symptomCheck) {
      console.warn(`[SYMPTOM GET] Record not found for ID ${symptomCheckId}`);
      return res.status(404).json({
        success: false,
        message: 'Symptom check record not found',
      });
    }

    console.log(`[SYMPTOM GET] Record found: ${symptomCheck._id}`);

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
      responseData.displayPossibleCondition = translatedOutput.displayPossibleCondition || symptomCheck.possibleCondition;
      responseData.displayPossibleConditions = translatedOutput.displayPossibleConditions || symptomCheck.possibleConditions;
      responseData.displayRecommendedSpecialist = translatedOutput.displayRecommendedSpecialist || symptomCheck.recommendedSpecialist;
      responseData.displayPositiveSymptoms = translatedOutput.displayPositiveSymptoms || symptomCheck.positiveSymptoms;
      responseData.displayContext = translatedOutput.displayContext || symptomCheck.context;
      responseData.displayGuidance = translatedOutput.displayGuidance || symptomCheck.guidance;
      responseData.displayDisclaimer = translatedOutput.displayDisclaimer || symptomCheck.disclaimer;
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

    const reqId = `req-followup-${Math.random().toString(36).substring(2, 6)}`;
    if (Array.isArray(conversation) && conversation.length > 0) {
      conversation.forEach((c, idx) => {
        console.log(`[GEMINI FOLLOWUP][${reqId}] Question ${idx + 1}: ${c.question || ''}\nAnswer ${idx + 1}: ${c.answer || ''}`);
        console.log(`[FOLLOWUP ANSWER][${reqId}]\nQuestion: ${c.question || ''}\nAnswer: ${c.answer || ''}`);
      });
    }

    // 0. Input Translation for Follow-Up if input is non-English
    let canonicalSymptoms = [...symptoms];
    let translatedNegatives = [];
    let translatedDuration = '';

    if (targetLang !== 'en' || symptoms.some((s) => /[^\x00-\x7F]/.test(s))) {
      const inputTrans = await geminiTranslationService.translateInputToCanonicalEnglish(
        symptoms.join(', '),
        targetLang
      );
      if (inputTrans) {
        if (inputTrans.isFallback) {
          console.log(`[CANONICAL PRESERVATION]\nTranslation failed\nPrevious canonical case preserved: YES`);
        }
        if (Array.isArray(inputTrans.symptomConcepts) && inputTrans.symptomConcepts.length > 0) {
          canonicalSymptoms = inputTrans.symptomConcepts;
        }
        if (Array.isArray(inputTrans.negativeFindings) && inputTrans.negativeFindings.length > 0) {
          translatedNegatives = inputTrans.negativeFindings;
        }
        if (inputTrans.duration) {
          translatedDuration = inputTrans.duration;
        }
      }
    }

    // 0b. Multilingual Conversation Normalization
    // Maintain { originalQuestion, originalAnswer, canonicalQuestion, canonicalAnswer, language }
    const normalizedConversation = [];
    for (const turn of (Array.isArray(conversation) ? conversation : [])) {
      const origQ = turn.originalQuestion || turn.question || '';
      const origA = turn.originalAnswer || turn.answer || '';
      let canQ = turn.canonicalQuestion || origQ;
      let canA = turn.canonicalAnswer || origA;

      if (/[^\x00-\x7F]/.test(canQ)) {
        canQ = geminiTranslationService.normalizeQuestionTextToEnglish
          ? geminiTranslationService.normalizeQuestionTextToEnglish(canQ)
          : canQ;
      }

      if (/[^\x00-\x7F]/.test(canA)) {
        canA = clinicalCaseService.normalizeFollowUpAnswer
          ? clinicalCaseService.normalizeFollowUpAnswer(canA)
          : canA;
      }

      console.log(`[MULTILINGUAL FOLLOWUP NORMALIZATION]\nLanguage: ${targetLang}\nOriginal question: "${origQ}"\nCanonical question: "${canQ}"\nOriginal answer: "${origA}"\nCanonical answer: "${canA}"`);

      normalizedConversation.push({
        ...turn,
        originalQuestion: origQ,
        originalAnswer: origA,
        canonicalQuestion: canQ,
        canonicalAnswer: canA,
        clinicalConcept: turn.clinicalConcept || '',
        question: canQ,
        answer: canA,
        language: targetLang,
      });
    }

    // Read incoming canonicalCase state from body if supplied by client
    const incomingCase = req.body?.canonicalCase || {};
    const incomingPositives = Array.isArray(req.body?.positiveSymptoms)
      ? req.body.positiveSymptoms
      : (Array.isArray(incomingCase.positiveSymptoms) ? incomingCase.positiveSymptoms : (Array.isArray(incomingCase.symptoms) ? incomingCase.symptoms : []));
    const incomingNegatives = Array.isArray(req.body?.negativeFindings)
      ? req.body.negativeFindings
      : (Array.isArray(incomingCase.negativeFindings) ? incomingCase.negativeFindings : []);
    const incomingContext = Array.isArray(req.body?.context)
      ? req.body.context
      : (Array.isArray(incomingCase.context) ? incomingCase.context : []);
    const incomingDuration = req.body?.duration || incomingCase.duration || '';
    const incomingSeverity = req.body?.severity || incomingCase.severity || null;

    // 1. Build & Reconcile active canonical case for context logging & turn merging
    const activeCase = clinicalCaseService.buildCanonicalClinicalCase({
      symptoms: canonicalSymptoms,
      conversation: normalizedConversation,
      positiveSymptoms: incomingPositives,
      negativeFindings: Array.from(new Set([...translatedNegatives, ...incomingNegatives])),
      context: incomingContext,
      duration: translatedDuration || incomingDuration,
      severity: incomingSeverity,
    });

    console.log(`[FOLLOWUP CONTEXT][${reqId}]\nCurrent canonical case:\n${JSON.stringify(activeCase, null, 2)}`);

    // 2. Deterministic Emergency Safety Check on Reconciled Canonical Case ONLY
    const isEmergency = symptomService.isEmergencySymptom(activeCase);

    // 4. Generate next follow-up question or structured summary via Gemini
    console.log(`[FOLLOWUP FLOW][${reqId}] Initial case extracted`);
    console.log(`[FOLLOWUP FLOW][${reqId}] Generating question ${Number(questionCount) + 1}`);
    console.log(`[FOLLOWUP FLOW][${reqId}] Gemini request started`);

    let result = await geminiConversationService.generateFollowUp(
      activeCase.positiveSymptoms.length > 0 ? activeCase.positiveSymptoms : canonicalSymptoms,
      normalizedConversation,
      questionCount
    );

    console.log(`[FOLLOWUP FLOW][${reqId}] Gemini response received`);

    if (!result) {
      result = {
        status: 'complete',
        summary: {
          symptoms: symptomService.normalizeSymptoms(canonicalSymptoms),
          duration: 'unspecified',
          severity: null,
          additionalContext: normalizedConversation.map((c) => `${c.question}: ${c.answer}`),
        },
      };
    }

    if (result.status === 'ask' && result.question) {
      console.log(`[FOLLOWUP FLOW][${reqId}] Question accepted: "${result.question}"`);
      console.log(`[FOLLOWUP FLOW][${reqId}] Waiting for patient answer`);
    } else if (result.status === 'complete') {
      const summaryReason = questionCount >= 3 ? 'max follow-up count reached (3)' : 'sufficient context gathered or model completed';
      console.log(`[FOLLOWUP FLOW][${reqId}] Moving to summary — reason: ${summaryReason}`);

      const summaryCanonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
        symptoms: canonicalSymptoms,
        conversation: normalizedConversation,
        duration: (activeCase.duration && activeCase.duration !== 'unspecified') ? activeCase.duration : (result.summary?.duration || ''),
        severity: result.summary?.severity || activeCase.severity,
        positiveSymptoms: result.summary?.positiveSymptoms || result.summary?.symptoms || activeCase.positiveSymptoms,
        negativeFindings: [...(result.summary?.negativeFindings || []), ...(activeCase.negativeFindings || [])],
        context: [...(result.summary?.context || []), ...(activeCase.context || [])],
        additionalDetails: [...(result.summary?.additionalDetails || []), ...(activeCase.additionalDetails || [])],
      });

      result.summary = {
        ...result.summary,
        symptoms: summaryCanonicalCase.positiveSymptoms,
        positiveSymptoms: summaryCanonicalCase.positiveSymptoms,
        negativeFindings: summaryCanonicalCase.negativeFindings,
        context: summaryCanonicalCase.context,
        duration: summaryCanonicalCase.duration,
        severity: summaryCanonicalCase.severity,
        additionalDetails: summaryCanonicalCase.additionalDetails || [],
      };

      console.log(`[FOLLOWUP MERGE][${reqId}]\nAdded positives: ${JSON.stringify(summaryCanonicalCase.positiveSymptoms)}\nAdded negatives: ${JSON.stringify(summaryCanonicalCase.negativeFindings)}\nAdded context: ${JSON.stringify(summaryCanonicalCase.context)}\nAdded details: ${JSON.stringify(summaryCanonicalCase.additionalDetails)}`);
      console.log(`[CANONICAL CASE][${reqId}][SUMMARY]\n${JSON.stringify(summaryCanonicalCase, null, 2)}`);
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
    if (result && result.status === 'ask' && result.question) {
      let canonicalEngQ = result.canonicalQuestion || result.question;
      let conceptInfo = clinicalCaseService.extractPrimaryClinicalConcept(canonicalEngQ, activeCase);
      let clinicalConcept = conceptInfo.primaryConcept || '';

      // Safety Invariant (Step 36G.2): If a question is Yes/No style but clinicalConcept is still empty,
      // fallback to deterministic single-concept question to prevent unanswerable Yes/No evidence turn.
      if (!clinicalConcept && (
        /^(?:have\s+you|do\s+you|did\s+you|are\s+you|is\s+there|has\s+there|can\s+you|any\b)/i.test(canonicalEngQ) ||
        (Array.isArray(result.quickOptions) && result.quickOptions.includes('Yes') && result.quickOptions.includes('No'))
      )) {
        console.warn(`⚠️ [FOLLOWUP SEMANTICS] Question "${canonicalEngQ}" is Yes/No style but clinicalConcept is empty. Invoking validated fallback.`);
        const fallbackResult = geminiConversationService.getValidatedDeterministicFallback(
          activeCase.positiveSymptoms,
          req.body.conversation || [],
          (req.body.conversation || []).length,
          activeCase
        );
        if (fallbackResult && fallbackResult.status === 'ask' && fallbackResult.question) {
          result.question = fallbackResult.question;
          canonicalEngQ = fallbackResult.question;
          result.quickOptions = fallbackResult.quickOptions || ['Yes', 'No'];
          conceptInfo = clinicalCaseService.extractPrimaryClinicalConcept(fallbackResult.question, activeCase);
          clinicalConcept = conceptInfo.primaryConcept || '';
        }
      }

      result.canonicalQuestion = canonicalEngQ;
      result.clinicalConcept = clinicalConcept;

      if (targetLang !== 'en') {
        const qTrans = await geminiTranslationService.translateFollowUpQuestion(
          canonicalEngQ,
          result.quickOptions || [],
          targetLang
        );
        result.displayQuestion = qTrans.translatedQuestion;
        result.question = qTrans.translatedQuestion;
        if (qTrans.translatedQuickOptions) {
          result.quickOptions = qTrans.translatedQuickOptions;
        }
      } else {
        result.displayQuestion = canonicalEngQ;
      }

      console.log(`[FOLLOWUP STORED SEMANTICS]\nDisplay question: "${result.displayQuestion}"\nCanonical question: "${result.canonicalQuestion}"\nClinical concept: "${result.clinicalConcept}"`);
    }

    // Attach active canonical case state
    result.canonicalCase = {
      symptoms: activeCase.positiveSymptoms,
      positiveSymptoms: activeCase.positiveSymptoms,
      negativeFindings: activeCase.negativeFindings,
      context: activeCase.context,
      duration: activeCase.duration,
      severity: activeCase.severity,
      additionalDetails: activeCase.additionalDetails || [],
    };

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
