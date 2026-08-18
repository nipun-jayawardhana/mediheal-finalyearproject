/**
 * Gemini Conversation Service
 * Specialized conversational orchestration for MediHeal Symptom Checker.
 * Responsibilities:
 * - Generate ONE short, elderly-friendly follow-up question to clarify symptoms
 * - Determine when sufficient context exists or max questions (3) reached
 * - Extract structured symptom context (symptoms, duration, severity, additionalContext)
 * - Enforce privacy (NO user PII sent to Gemini)
 * - Provide deterministic fallback if Gemini service is unavailable
 * 
 * Note: Gemini NEVER provides medical diagnosis, prescription, or final specialist recommendations.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Helper to parse and extract JSON object from raw response text
 */
const parseJSONFromText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Continue
  }

  // 2. Markdown code block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      // Continue
    }
  }

  // 3. First '{' to last '}'
  const startIdx = rawText.indexOf('{');
  const endIdx = rawText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(rawText.substring(startIdx, endIdx + 1));
    } catch (e) {
      // Continue
    }
  }

  return null;
};

/**
 * Deterministic fallback strategy when Gemini API is unavailable or returns invalid data
 */
const getDeterministicFallback = (symptoms, conversation = [], questionCount = 0) => {
  const currentCount = Number(questionCount) || conversation.length || 0;

  // Max 3 questions reached -> complete
  if (currentCount >= 3) {
    return {
      status: 'complete',
      summary: {
        symptoms: Array.isArray(symptoms) && symptoms.length > 0 ? symptoms : ['unspecified symptom'],
        duration: 'unspecified',
        severity: 'moderate',
        additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
      },
    };
  }

  // Check which basic fields might be missing from conversation answers
  const combinedAnswers = conversation.map((c) => (c.answer || '').toLowerCase()).join(' ');
  const hasDuration = combinedAnswers.includes('day') || combinedAnswers.includes('hour') || combinedAnswers.includes('week') || combinedAnswers.includes('month') || combinedAnswers.includes('today') || combinedAnswers.includes('yesterday');
  const hasSeverity = combinedAnswers.includes('mild') || combinedAnswers.includes('moderate') || combinedAnswers.includes('severe');

  if (!hasDuration && currentCount === 0) {
    return {
      status: 'ask',
      question: 'How long have you had these symptoms?',
      field: 'duration',
      quickOptions: ['Today', '1-3 days', 'More than 3 days'],
    };
  }

  if (!hasSeverity && currentCount < 2) {
    return {
      status: 'ask',
      question: 'How severe is your discomfort: mild, moderate, or severe?',
      field: 'severity',
      quickOptions: ['Mild', 'Moderate', 'Severe'],
    };
  }

  if (currentCount < 3) {
    return {
      status: 'ask',
      question: 'Are you experiencing any other symptoms like dizziness, nausea, or fever?',
      field: 'associated_symptoms',
      quickOptions: ['Yes', 'No'],
    };
  }

  // Default to complete
  return {
    status: 'complete',
    summary: {
      symptoms: Array.isArray(symptoms) && symptoms.length > 0 ? symptoms : ['unspecified symptom'],
      duration: 'unspecified',
      severity: 'moderate',
      additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
    },
  };
};

/**
 * Generate next follow-up question or complete symptom summary via Gemini REST API
 * PRIVACY GUARANTEE: Only sends symptoms array, conversation Q&A history, and question count. NO PII.
 */
const generateFollowUp = async (symptoms = [], conversation = [], questionCount = 0) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const currentCount = Number(questionCount) || conversation.length || 0;

  // Hard limit: Max 3 questions
  if (currentCount >= 3) {
    // Return structured summary extraction directly
    return extractStructuredSummary(symptoms, conversation);
  }

  if (!apiKey) {
    console.warn('⚠️ [GEMINI SERVICE] GEMINI_API_KEY not configured. Using deterministic fallback.');
    return getDeterministicFallback(symptoms, conversation, currentCount);
  }

  const symptomsText = Array.isArray(symptoms) ? symptoms.join(', ') : String(symptoms);
  const formattedHistory = conversation
    .map((item, idx) => `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`)
    .join('\n\n');

  const systemPrompt = `You are MediHeal's conversational symptom assistant for elderly patients.
Your sole job is to ask simple, polite, concise follow-up questions (ONE sentence max) to clarify a patient's symptoms before medical assessment, OR output a structured summary when enough context is gathered or 3 questions have been reached.

CRITICAL RULES:
1. Return ONLY valid JSON format. No conversational text outside JSON.
2. Question count so far: ${currentCount} out of maximum 3 allowed follow-up questions.
3. If currentCount is 3 OR if you already have enough symptom context (duration, severity, associated symptoms), return status = "complete".
4. If status = "ask":
   - "question": ONE short, gentle sentence tailored to elderly users (e.g. "How long have you had the headache?", "Is the pain mild, moderate, or severe?").
   - "field": "duration", "severity", "location", or "associated_symptoms".
   - "quickOptions": Optional array of 2-3 short answer chips (e.g. ["Mild", "Moderate", "Severe"] or ["Today", "1-3 days", "More than 3 days"] or ["Yes", "No"]).
5. If status = "complete":
   - "summary": Object containing:
     - "symptoms": Array of all identified symptom names (strings).
     - "duration": Estimated duration string (e.g. "2 days", "since yesterday", "unspecified").
     - "severity": "mild", "moderate", or "severe".
     - "additionalContext": Array of relevant context strings extracted from conversation.
6. Do NOT provide medical diagnosis, treatment recommendations, prescriptions, or specialist advice. Your ONLY role is symptom clarification and summary.`;

  const userPrompt = `Initial Symptom: ${symptomsText}

Conversation History so far:
${formattedHistory || 'None (This is the start of follow-up questioning)'}

Question Count So Far: ${currentCount} / 3

JSON Output:`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 350,
      responseMimeType: 'application/json',
    },
  };

  const modelsToTry = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    const endpointUrl = `${GEMINI_API_URL}/${modelName}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API ${modelName} returned HTTP ${response.status}: ${errText.substring(0, 150)}`);
      }

      const data = await response.json();
      const candidateContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateContent) {
        throw new Error(`Gemini API ${modelName} returned empty text.`);
      }

      const parsed = parseJSONFromText(candidateContent);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Gemini API ${modelName} did not return valid JSON object.`);
      }

      // Output Contract Validation
      if (parsed.status === 'ask') {
        if (!parsed.question || typeof parsed.question !== 'string') {
          throw new Error('Gemini ask response missing valid question string');
        }

        // Clean & truncate question length (max 1 concise sentence for elderly users)
        let cleanQuestion = parsed.question.trim();
        if (cleanQuestion.length > 150) {
          cleanQuestion = cleanQuestion.substring(0, 147) + '...';
        }

        return {
          status: 'ask',
          question: cleanQuestion,
          field: parsed.field || 'follow_up',
          quickOptions: Array.isArray(parsed.quickOptions)
            ? parsed.quickOptions.filter((o) => typeof o === 'string' && o.length < 30).slice(0, 4)
            : undefined,
        };
      }

      if (parsed.status === 'complete' && parsed.summary) {
        return validateAndFormatSummary(parsed.summary, symptoms, conversation);
      }

      // If status is unrecognized, force summary or ask
      if (currentCount >= 3) {
        return extractStructuredSummary(symptoms, conversation);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`[GEMINI SERVICE] Model ${modelName} failed/error:`, err.message);
    }
  }

  // Fallback if all Gemini models failed
  console.warn('⚠️ [GEMINI SERVICE] All Gemini API attempts failed. Using deterministic fallback.');
  return getDeterministicFallback(symptoms, conversation, currentCount);
};

/**
 * Validate and sanitize summary output from Gemini
 */
const validateAndFormatSummary = (rawSummary, initialSymptoms, conversation) => {
  const validSeverities = ['mild', 'moderate', 'severe'];

  let symptomsList = Array.isArray(rawSummary.symptoms) && rawSummary.symptoms.length > 0
    ? rawSummary.symptoms.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
    : initialSymptoms;

  if (symptomsList.length === 0) {
    symptomsList = initialSymptoms.length > 0 ? initialSymptoms : ['unspecified symptom'];
  }

  let severity = typeof rawSummary.severity === 'string' ? rawSummary.severity.toLowerCase().trim() : 'moderate';
  if (!validSeverities.includes(severity)) {
    severity = 'moderate';
  }

  let duration = typeof rawSummary.duration === 'string' ? rawSummary.duration.trim() : 'unspecified';
  if (!duration) duration = 'unspecified';

  let additionalContext = Array.isArray(rawSummary.additionalContext)
    ? rawSummary.additionalContext.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
    : [];

  return {
    status: 'complete',
    summary: {
      symptoms: Array.from(new Set(symptomsList)),
      duration,
      severity,
      additionalContext,
    },
  };
};

/**
 * Fallback structured summary extraction if max questions reached or Gemini fails
 */
const extractStructuredSummary = async (symptoms, conversation) => {
  try {
    const fallback = getDeterministicFallback(symptoms, conversation, 3);
    return fallback;
  } catch (e) {
    return {
      status: 'complete',
      summary: {
        symptoms: symptoms.length > 0 ? symptoms : ['unspecified symptom'],
        duration: 'unspecified',
        severity: 'moderate',
        additionalContext: [],
      },
    };
  }
};

module.exports = {
  generateFollowUp,
  getDeterministicFallback,
  validateAndFormatSummary,
};
