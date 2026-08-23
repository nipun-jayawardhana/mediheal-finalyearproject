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
 * Helper to parse duration from conversation Q&A answers
 */
const parseDurationFromAnswers = (conversation = []) => {
  const text = conversation.map((c) => (c.answer || '').toLowerCase().trim()).join(' ');
  if (!text) return 'unspecified';

  if (text.includes('today')) return 'today';
  if (text.includes('yesterday') || text.includes('since yesterday')) return '1 day';

  const daysMatch = text.match(/(\d+|one|two|three|four|five|six|seven)\s*days?/i);
  if (daysMatch) {
    const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7' };
    const num = wordToNum[daysMatch[1].toLowerCase()] || daysMatch[1];
    return `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
  }

  const weeksMatch = text.match(/(\d+|one|two|three|four|a)\s*weeks?/i);
  if (weeksMatch) {
    const wordToNum = { a: '1', one: '1', two: '2', three: '3', four: '4' };
    const num = wordToNum[weeksMatch[1].toLowerCase()] || weeksMatch[1];
    return `${num} ${Number(num) === 1 ? 'week' : 'weeks'}`;
  }

  const monthsMatch = text.match(/(\d+|one|two|three|a)\s*months?/i);
  if (monthsMatch) {
    const wordToNum = { a: '1', one: '1', two: '2', three: '3' };
    const num = wordToNum[monthsMatch[1].toLowerCase()] || monthsMatch[1];
    return `${num} ${Number(num) === 1 ? 'month' : 'months'}`;
  }

  if (text.includes('1-3 days')) return '1-3 days';
  if (text.includes('more than 3 days')) return '>3 days';

  return 'unspecified';
};

/**
 * Helper to parse severity from conversation Q&A answers
 */
const parseSeverityFromAnswers = (conversation = []) => {
  const text = conversation.map((c) => (c.answer || '').toLowerCase().trim()).join(' ');
  if (text.includes('severe')) return 'severe';
  if (text.includes('moderate')) return 'moderate';
  if (text.includes('mild')) return 'mild';
  return 'moderate';
};

const BARE_BODY_PARTS = new Set([
  'knee', 'knees', 'ankle', 'ankles', 'hip', 'hips', 'right hip', 'left hip',
  'leg', 'legs', 'foot', 'feet', 'both feet', 'arm', 'arms', 'hand', 'hands',
  'back', 'lower back', 'upper back', 'shoulder', 'shoulders', 'elbow', 'elbows',
  'wrist', 'wrists', 'neck', 'chest', 'stomach', 'abdomen', 'thigh', 'thighs',
  'toe', 'toes', 'finger', 'fingers', 'head', 'body'
]);

const SYMPTOM_MODIFIERS = [
  'pain', 'ache', 'aching', 'stiffness', 'stiff', 'swelling', 'swollen',
  'instability', 'unstable', 'loose', 'numbness', 'numb', 'tingling',
  'tightness', 'tight', 'weakness', 'weak', 'soreness', 'sore', 'cramps',
  'cramping', 'rash', 'burning', 'spasm', 'spasms'
];

/**
 * Checks if a concept string is a bare body part lacking any symptom context
 */
const isBareBodyPart = (str) => {
  if (!str || typeof str !== 'string') return false;
  const clean = str.toLowerCase().trim().replace(/^(?:a|an|the|my|both|left|right)\s+/i, '').trim();
  if (BARE_BODY_PARTS.has(clean) || BARE_BODY_PARTS.has(str.toLowerCase().trim())) {
    const lower = str.toLowerCase();
    return !SYMPTOM_MODIFIERS.some((mod) => lower.includes(mod));
  }
  return false;
};

/**
 * Helper to decompose natural-language symptom text into concise, semantically preserved symptom concepts
 */
const extractSymptomConcepts = (symptoms = [], conversation = []) => {
  const concepts = [];

  const addConcept = (str) => {
    if (!str || typeof str !== 'string') return;
    let clean = str
      .toLowerCase()
      .trim()
      .replace(/^[•\-\*\s]+/, '')
      .replace(/^(?:a|an|the|my|and)\s+/i, '')
      .trim();

    if (
      clean.length >= 3 &&
      clean.length <= 100 &&
      !['and', 'the', 'a', 'my', 'with', 'like'].includes(clean) &&
      !isBareBodyPart(clean) &&
      !concepts.some((c) => c.toLowerCase() === clean)
    ) {
      concepts.push(clean);
    }
  };

  const parseSentenceText = (text) => {
    if (!text || typeof text !== 'string') return;
    // Strip duration phrases like "for 3 days", "for three days"
    let cleanText = text.replace(/\bfor\s+(?:\d+|one|two|three|four|five|six|seven|a|several)\s+(?:days?|weeks?|months?)\b/gi, '').trim();

    // Clause 1: Handle Radiation / Spreading Relationships
    const radiationMatch = cleanText.match(/(.*?\bpain\b.*?)\s+(?:spreading|radiating|extending|spreads)\s+(?:from\s+.*?\s+)?(?:to|into)\s+(.*)/i);
    if (radiationMatch) {
      const primaryPart = radiationMatch[1].trim();
      const targetPart = radiationMatch[2].split(/[,;]|\s+and\s+/i)[0].trim();
      
      const cleanPrimary = primaryPart.replace(/^(?:sharp\s+)?pain\s+in\s+the\s+/i, '').replace(/^(?:a\s+)?/i, '').trim();
      const cleanTarget = targetPart.replace(/^(?:the|my|a)\s+/i, '').trim();

      if (primaryPart.toLowerCase().includes('sharp')) {
        addConcept(`sharp ${cleanPrimary} pain`);
      } else {
        addConcept(`${cleanPrimary} pain`);
      }
      addConcept(`pain radiating to ${cleanTarget}`);

      const remaining = cleanText.substring(cleanText.indexOf(targetPart) + targetPart.length);
      cleanText = remaining.replace(/^[,;\s\.\-]+/, '').trim();
    }

    // Clause 2: Handle Shared Predicate across multiple body parts (e.g. "knee and ankle feel unstable")
    const sharedPredicateMatch = cleanText.match(/(?:my\s+)?([a-z\s]+?)\s+and\s+([a-z\s]+?)\s+(?:are|feel|feeling)\s+(?:loose\s+or\s+)?(unstable|weak|stiff|painful|numb|sore)/i);
    if (sharedPredicateMatch) {
      const part1 = sharedPredicateMatch[1].replace(/^(?:a|an|the|my)\s+/i, '').trim();
      const part2 = sharedPredicateMatch[2].replace(/^(?:a|an|the|my)\s+/i, '').trim();
      const pred = sharedPredicateMatch[3].trim();
      const predNoun = pred === 'unstable' ? 'instability' : pred === 'stiff' ? 'stiffness' : pred === 'weak' ? 'weakness' : pred;

      addConcept(`${part1} ${predNoun}`);
      addConcept(`${part2} ${predNoun}`);

      cleanText = cleanText.replace(sharedPredicateMatch[0], '').trim();
    }

    // Clause 3: Handle Shared Symptom in multiple body parts (e.g. "pain in my knee and ankle")
    const sharedSymptomMatch = cleanText.match(/(pain|numbness|tingling|stiffness|swelling|ache|cramps)\s+in\s+(?:my\s+|both\s+)?([a-z\s]+?)\s+and\s+([a-z\s]+)/i);
    if (sharedSymptomMatch) {
      const sym = sharedSymptomMatch[1].trim();
      const part1 = sharedSymptomMatch[2].replace(/^(?:my|both|the)\s+/i, '').trim();
      const part2 = sharedSymptomMatch[3].replace(/^(?:my|both|the)\s+/i, '').trim();

      addConcept(`${part1} ${sym}`);
      addConcept(`${part2} ${sym}`);

      cleanText = cleanText.replace(sharedSymptomMatch[0], '').trim();
    }

    // Clause 4: Handle Multiple Symptoms in a single body location (e.g. "numbness and tingling in both feet")
    const multiSymptomMatch = cleanText.match(/(numbness|tingling|pain|stiffness|swelling|burning)\s+and\s+(numbness|tingling|pain|stiffness|swelling|burning)\s+in\s+(?:both\s+|my\s+|the\s+)?([a-z\s]+)/i);
    if (multiSymptomMatch) {
      const sym1 = multiSymptomMatch[1].trim();
      const sym2 = multiSymptomMatch[2].trim();
      const loc = multiSymptomMatch[3].trim();

      addConcept(`${sym1} in ${loc}`);
      addConcept(`${sym2} in ${loc}`);

      cleanText = cleanText.replace(multiSymptomMatch[0], '').trim();
    }

    // Clause 5: General Clause Split for remaining independent phrases
    if (cleanText) {
      const clauses = cleanText
        .split(/[,;\.]|\s+(?:and|with|as well as)\s+/i)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      for (const clause of clauses) {
        if (isBareBodyPart(clause)) {
          if (cleanText.toLowerCase().includes('pain')) addConcept(`${clause} pain`);
          else if (cleanText.toLowerCase().includes('unstable') || cleanText.toLowerCase().includes('loose')) addConcept(`${clause} instability`);
          else if (cleanText.toLowerCase().includes('numb')) addConcept(`${clause} numbness`);
        } else {
          addConcept(clause);
        }
      }
    }
  };

  const rawInputs = Array.isArray(symptoms) ? symptoms : [String(symptoms)];
  for (const item of rawInputs) {
    parseSentenceText(item);
  }

  // Inspect associated symptoms from conversation Q&A
  conversation.forEach((turn) => {
    if (turn.field === 'associated_symptoms' && turn.answer && !['no', 'none', 'nothing'].includes(turn.answer.toLowerCase().trim())) {
      const parts = turn.answer.split(/[,;]/).map((p) => p.trim());
      parts.forEach(addConcept);
    }
  });

  const filtered = concepts.filter((c) => !isBareBodyPart(c));
  return filtered.slice(0, 10);
};

/**
 * Deterministic fallback strategy when Gemini API is unavailable or returns invalid data
 */
const getDeterministicFallback = (symptoms, conversation = [], questionCount = 0) => {
  const currentCount = Number(questionCount) || conversation.length || 0;
  const extractedDuration = parseDurationFromAnswers(conversation);
  const extractedSeverity = parseSeverityFromAnswers(conversation);
  const extractedConcepts = extractSymptomConcepts(symptoms, conversation);

  // Max 3 questions reached -> complete
  if (currentCount >= 3) {
    return {
      status: 'complete',
      summary: {
        symptoms: extractedConcepts.length > 0 ? extractedConcepts : ['unspecified symptom'],
        duration: extractedDuration,
        severity: extractedSeverity,
        additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
      },
    };
  }

  // Check which basic fields might be missing from conversation answers
  const hasDuration = extractedDuration !== 'unspecified';
  const hasSeverity = conversation.some((c) => ['mild', 'moderate', 'severe'].includes((c.answer || '').toLowerCase().trim()));

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
      symptoms: extractedConcepts.length > 0 ? extractedConcepts : ['unspecified symptom'],
      duration: extractedDuration,
      severity: extractedSeverity,
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
  "question": "How long have you had these symptoms?",
  "field": "duration",
  "quickOptions": ["Today", "1-3 days", "More than 3 days"]
}

Schema 2 (When conversation is complete or 3 questions reached):
{
  "status": "complete",
  "summary": {
    "symptoms": ["lower back pain", "pain spreading to right hip", "tight thigh muscles", "knee instability", "ankle instability"],
    "duration": "today",
    "severity": "moderate",
    "additionalContext": []
  }
}

Strict Rules for Schema 2 (Summary):
- "symptoms" MUST be an array of concise individual symptom concept phrases (max 10 items, <= 100 characters each). Do NOT return a long natural-language paragraph as a single symptom.
- "duration" MUST be extracted accurately from the user's answers (e.g. "today", "1 day", "3 days", "1 week").
- "severity" MUST be one of: "mild", "moderate", or "severe".
- Do NOT prescribe medications, claim a medical diagnosis, or provide markdown explanations outside the JSON.`;

  const userPrompt = `Initial Symptom Description: ${symptomsText}

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

  let rawSymptomsList = Array.isArray(rawSummary.symptoms) && rawSummary.symptoms.length > 0
    ? rawSummary.symptoms
    : initialSymptoms;

  let symptomsList = extractSymptomConcepts(rawSymptomsList, conversation);
  if (symptomsList.length === 0) {
    symptomsList = extractSymptomConcepts(initialSymptoms, conversation);
  }
  if (symptomsList.length === 0) {
    symptomsList = ['unspecified symptom'];
  }

  let severity = typeof rawSummary.severity === 'string' ? rawSummary.severity.toLowerCase().trim() : '';
  if (!validSeverities.includes(severity)) {
    severity = parseSeverityFromAnswers(conversation);
  }

  let duration = typeof rawSummary.duration === 'string' ? rawSummary.duration.trim() : '';
  if (!duration || duration === 'unspecified') {
    duration = parseDurationFromAnswers(conversation);
  }

  let additionalContext = Array.isArray(rawSummary.additionalContext)
    ? rawSummary.additionalContext.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
    : [];

  return {
    status: 'complete',
    summary: {
      symptoms: symptomsList,
      duration: duration || 'unspecified',
      severity: severity || 'moderate',
      additionalContext,
    },
  };
};

/**
 * Fallback structured summary extraction if max questions reached or Gemini fails
 */
const extractStructuredSummary = async (symptoms, conversation) => {
  return getDeterministicFallback(symptoms, conversation, 3);
};

module.exports = {
  generateFollowUp,
  getDeterministicFallback,
  validateAndFormatSummary,
  parseDurationFromAnswers,
  parseSeverityFromAnswers,
  extractSymptomConcepts,
};
