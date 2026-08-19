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
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const currentCount = Number(questionCount) || conversation.length || 0;

  // Hard limit: Max 3 questions
  if (currentCount >= 3) {
    return extractStructuredSummary(symptoms, conversation);
  }

  // Log conversation begin
  console.log('[GEMINI CONVERSATION]');
  console.log(`Model: ${configuredModel}`);

  if (!apiKey) {
    console.warn('⚠️ [GEMINI SERVICE] GEMINI_API_KEY not configured. Using deterministic fallback.');
    return getDeterministicFallback(symptoms, conversation, currentCount);
  }

  const symptomsText = Array.isArray(symptoms) ? symptoms.join(', ') : String(symptoms);
  const formattedHistory = conversation
    .map((item, idx) => `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`)
    .join('\n\n');

  const systemPrompt = `You are MediHeal's conversational symptom assistant for elderly patients.
Your task is to ask 1 short, polite follow-up question (1 sentence max) to clarify symptoms, OR output a complete summary when enough context is gathered or 3 questions have been reached.

Respond strictly with a single JSON object matching one of these two schemas:

Schema 1 (When asking a follow-up question):
{
  "status": "ask",
  "question": "How long have you had the headache?",
  "field": "duration",
  "quickOptions": ["Today", "1-3 days", "More than 3 days"]
}

Schema 2 (When conversation is complete or 3 questions reached):
{
  "status": "complete",
  "summary": {
    "symptoms": ["headache", "vomiting"],
    "duration": "2 days",
    "severity": "moderate",
    "additionalContext": ["sensitivity to light"]
  }
}

Do NOT prescribe medications, claim a medical diagnosis, or provide markdown explanations outside the JSON.`;

  const userPrompt = `Initial Symptom: ${symptomsText}

Conversation History so far:
${formattedHistory || 'None'}

Current Question Count: ${currentCount} / 3

Output JSON:`;

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
      temperature: 0.1,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
    },
  };

  const endpointUrl = `${GEMINI_API_URL}/${configuredModel}:generateContent?key=${apiKey}`;
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

    if (response.status === 429) {
      console.warn('[GEMINI SERVICE] Daily/rate quota unavailable.');
      console.warn('[GEMINI SERVICE] Using deterministic conversational fallback.');
      return getDeterministicFallback(symptoms, conversation, currentCount);
    }

    if (response.status === 503) {
      console.warn(`[GEMINI SERVICE] Model ${configuredModel} returned HTTP 503 capacity spike. Retrying once...`);
      await new Promise((r) => setTimeout(r, 1500));
      const retryRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        const retryContent = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (retryContent) {
          const parsedRetry = parseJSONFromText(retryContent);
          if (parsedRetry && typeof parsedRetry === 'object') {
            console.log('[GEMINI CONVERSATION]');
            console.log('Follow-up generated successfully');
            if (parsedRetry.status === 'ask' && parsedRetry.question) {
              return {
                status: 'ask',
                question: parsedRetry.question.trim().substring(0, 150),
                field: parsedRetry.field || 'follow_up',
                quickOptions: Array.isArray(parsedRetry.quickOptions)
                  ? parsedRetry.quickOptions.filter((o) => typeof o === 'string' && o.length < 30).slice(0, 4)
                  : undefined,
              };
            }
            if (parsedRetry.status === 'complete' && parsedRetry.summary) {
              return validateAndFormatSummary(parsedRetry.summary, symptoms, conversation);
            }
          }
        }
      }
      console.warn(`⚠️ [GEMINI SERVICE] Retry for ${configuredModel} failed. Using deterministic fallback.`);
      return getDeterministicFallback(symptoms, conversation, currentCount);
    }

    if (!response.ok) {
      console.warn(`⚠️ [GEMINI SERVICE] HTTP ${response.status} from ${configuredModel}. Using deterministic fallback.`);
      return getDeterministicFallback(symptoms, conversation, currentCount);
    }

    const data = await response.json();
    const candidateContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateContent) {
      console.warn(`⚠️ [GEMINI SERVICE] Model ${configuredModel} returned empty text. Using deterministic fallback.`);
      return getDeterministicFallback(symptoms, conversation, currentCount);
    }

    const parsed = parseJSONFromText(candidateContent);
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`⚠️ [GEMINI SERVICE] Model ${configuredModel} did not return valid JSON object. Using deterministic fallback.`);
      return getDeterministicFallback(symptoms, conversation, currentCount);
    }

    // Output Contract Validation
    if (parsed.status === 'ask') {
      if (!parsed.question || typeof parsed.question !== 'string') {
        console.warn(`⚠️ [GEMINI SERVICE] Invalid question in response. Using deterministic fallback.`);
        return getDeterministicFallback(symptoms, conversation, currentCount);
      }

      let cleanQuestion = parsed.question.trim();
      if (cleanQuestion.length > 150) {
        cleanQuestion = cleanQuestion.substring(0, 147) + '...';
      }

      console.log('[GEMINI CONVERSATION]');
      console.log('Follow-up generated successfully');

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
      console.log('[GEMINI CONVERSATION]');
      console.log('Follow-up generated successfully');
      return validateAndFormatSummary(parsed.summary, symptoms, conversation);
    }

    if (currentCount >= 3) {
      return extractStructuredSummary(symptoms, conversation);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`⚠️ [GEMINI SERVICE] Model ${configuredModel} failed/error: ${err.message}. Using deterministic fallback.`);
  }

  // Fallback if Gemini failed
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
