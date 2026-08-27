/**
 * Gemini Translation Service
 * Backend translation mediation for MediHeal Multilingual Symptom Checker.
 * Model: gemini-flash-lite-latest
 * Responsibilities:
 * - Translate raw patient symptoms (Sinhala/Tamil -> Canonical English)
 * - Extract symptom concepts without adding unstated symptoms
 * - Translate follow-up questions to target language (si/ta)
 * - Batch-translate analysis results to target language (si/ta) in a single request
 * - Preserves system identifiers, Mongo IDs, and internal specialist names
 * - Quota (429) & timeout protection returning safe fallbacks
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Helper to parse and extract JSON object from raw response text
 */
const parseJSONFromText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Continue
  }

  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      // Continue
    }
  }

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
 * Executes a structured JSON request to Gemini REST API with timeout & quota protection
 */
const callGeminiJSONApi = async (systemPrompt, userPrompt, timeoutMs = 8000) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

  if (!apiKey) {
    console.warn('⚠️ [GEMINI TRANSLATION] GEMINI_API_KEY not configured. Skipping LLM translation.');
    return null;
  }

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
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn('⚠️ [GEMINI TRANSLATION] Daily/Rate Quota 429 hit. Using canonical fallback.');
      return null;
    }

    if (!response.ok) {
      console.warn(`⚠️ [GEMINI TRANSLATION] HTTP ${response.status} from model ${configuredModel}`);
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    return parseJSONFromText(candidateText);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`⚠️ [GEMINI TRANSLATION] Error/Timeout (${timeoutMs}ms): ${err.message}`);
    return null;
  }
};

/**
 * Translates raw patient input into canonical English symptom text and concise symptom concept phrases.
 * Language supported: 'en' | 'si' | 'ta'
 */
const translateInputToCanonicalEnglish = async (rawInput, sourceLanguage = 'en') => {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      detectedLanguage: sourceLanguage || 'en',
      englishText: '',
      symptomConcepts: [],
    };
  }

  const cleanInput = rawInput.trim();
  if (!cleanInput) {
    return {
      detectedLanguage: sourceLanguage || 'en',
      englishText: '',
      symptomConcepts: [],
    };
  }

  // If already English or sourceLanguage specified as 'en' with ASCII text
  const isPlainAsciiEnglish = /^[a-zA-Z0-9\s,.?!'\-]+$/.test(cleanInput);
  if (sourceLanguage === 'en' && isPlainAsciiEnglish) {
    return {
      detectedLanguage: 'en',
      englishText: cleanInput,
      symptomConcepts: [cleanInput.toLowerCase()],
    };
  }

  const systemPrompt = `You are MediHeal's medical language translation mediator.
Your task is to translate patient symptom descriptions from Sinhala (si), Tamil (ta), or mixed language into clean, accurate canonical English medical phrasing.

STRICT SAFETY RULES:
- Do NOT invent, assume, or add medical symptoms that were not explicitly mentioned by the patient.
- PRESERVE ALL PATIENT-REPORTED SYMPTOMS: Long sentences may contain multiple symptoms (e.g. "painful sore throat", "fever", "headache", "fatigue", "difficulty swallowing", "swollen neck glands", "white patches at back of throat"). All mentioned positive symptoms MUST be preserved.
- PRESERVE EXACT ANATOMICAL LOCATIONS & QUALIFIERS: (e.g. "lower right abdomen", "swollen neck glands", "white patches at back of throat", "difficulty swallowing", "painful sore throat").
- PRESERVE DURATION: Extract explicit duration stated in input (e.g. "3 days", "12 hours", "today") into the "duration" field.
- Extract up to 10 distinct, concise symptom concept phrases (<= 80 chars each) in "symptomConcepts".

Respond strictly with JSON:
{
  "detectedLanguage": "si",
  "englishText": "Over the past three days I had a painful sore throat with fever, headache, fatigue, and difficulty swallowing. I have noticed swollen neck glands and white patches at the back of my throat.",
  "symptomConcepts": ["painful sore throat", "fever", "headache", "fatigue", "difficulty swallowing", "swollen neck glands", "white patches at back of throat"],
  "duration": "3 days"
}`;

  const userPrompt = `Source Language Hint: ${sourceLanguage}
Patient Raw Input Text: "${cleanInput}"

Output JSON:`;

  const parsed = await callGeminiJSONApi(systemPrompt, userPrompt, 6000);

  if (parsed && parsed.englishText) {
    let concepts = Array.isArray(parsed.symptomConcepts)
      ? parsed.symptomConcepts.filter((c) => typeof c === 'string' && c.trim().length > 0)
      : [];
    
    if (concepts.length === 0 && parsed.englishText) {
      concepts = [parsed.englishText.toLowerCase()];
    }

    return {
      detectedLanguage: parsed.detectedLanguage || sourceLanguage || 'si',
      englishText: parsed.englishText.trim(),
      symptomConcepts: concepts,
      duration: typeof parsed.duration === 'string' ? parsed.duration.trim() : '',
    };
  }

  // Fallback if translation API fails or times out
  return {
    detectedLanguage: sourceLanguage || 'en',
    englishText: cleanInput,
    symptomConcepts: [cleanInput.toLowerCase()],
    duration: '',
  };
};

/**
 * Translates a conversational follow-up question and optional quick options into target language.
 */
const translateFollowUpQuestion = async (questionText, quickOptions = [], targetLanguage = 'en') => {
  if (targetLanguage === 'en' || !targetLanguage || !questionText) {
    return {
      translatedQuestion: questionText,
      translatedQuickOptions: quickOptions,
    };
  }

  const systemPrompt = `You are MediHeal's healthcare translation assistant for elderly patients in Sri Lanka.
Translate the following follow-up question and quick option button labels into polite, clear, natural ${targetLanguage === 'si' ? 'Sinhala' : targetLanguage === 'ta' ? 'Tamil' : targetLanguage}.

STRICT RULES:
- Keep the sentence short, simple, and friendly for senior citizens.
- Preserve key options (e.g., "Today" -> "අද", "1-3 days" -> "දින 1-3ක්").
- Return strictly JSON.

Respond with JSON:
{
  "translatedQuestion": "...",
  "translatedQuickOptions": ["...", "..."]
}`;

  const userPrompt = `Target Language Code: ${targetLanguage}
Question: "${questionText}"
Quick Options: ${JSON.stringify(quickOptions)}

Output JSON:`;

  const parsed = await callGeminiJSONApi(systemPrompt, userPrompt, 5000);

  if (parsed && parsed.translatedQuestion) {
    return {
      translatedQuestion: parsed.translatedQuestion.trim(),
      translatedQuickOptions: Array.isArray(parsed.translatedQuickOptions)
        ? parsed.translatedQuickOptions
        : quickOptions,
    };
  }

  return {
    translatedQuestion: questionText,
    translatedQuickOptions: quickOptions,
  };
};

/**
 * Batch translates OpenBioLLM / rule-based patient-facing analysis results into target language in ONE API call.
 */
const translateAnalysisResult = async (analysisResult, targetLanguage = 'en') => {
  if (targetLanguage === 'en' || !targetLanguage || !analysisResult) {
    return {
      displayPossibleConditions: analysisResult.possibleConditions || [],
      displayPossibleCondition: analysisResult.possibleCondition || '',
      displayPositiveSymptoms: analysisResult.positiveSymptoms || [],
      displayContext: analysisResult.context || [],
      displayGuidance: analysisResult.guidance || [],
      displayRecommendedSpecialist: analysisResult.recommendedSpecialist || '',
      displayDisclaimer: analysisResult.disclaimer || '',
      displayEmergencyWarning: analysisResult.emergencyRecommended
        ? 'High risk symptoms detected! Please seek immediate professional medical assistance.'
        : '',
    };
  }

  const langName = targetLanguage === 'si' ? 'Sinhala' : targetLanguage === 'ta' ? 'Tamil' : targetLanguage;

  const systemPrompt = `You are MediHeal's medical translation mediator for elderly Sri Lankan patients.
Translate the provided medical analysis result object into clear, comforting, easy-to-understand ${langName}.

STRICT RULES:
- "displayPossibleConditions": Array of objects. Translate each condition name strictly into ${langName} ONLY. DO NOT append English names or parenthetical text in parentheses (e.g. return "මුත්රා මාර්ග ආසාදනය", NOT "මුත්රා මාර්ග ආසාදනය (Urinary Tract Infection)"). Retain original "confidence" string unchanged ("high", "medium", "low").
- "displayPossibleCondition": Top condition translated in ${langName} ONLY (no English in parentheses).
- "displayPositiveSymptoms": Array of translated positive symptom names in ${langName}.
- "displayContext": Array of translated context/trigger strings in ${langName}.
- "displayGuidance": Array of translated self-care guidance steps in ${langName}.
- "displayRecommendedSpecialist": Translated specialist display label strictly in ${langName} ONLY (e.g. return "හෘද රෝග විශේෂඥ", NOT "හෘද රෝග විශේෂඥ (Cardiologist)").
- "displayDisclaimer": Translated standard medical disclaimer.
- Do NOT alter any JSON keys.
- Do NOT invent or modify medical advice.

Respond strictly with JSON:
{
  "displayPossibleConditions": [
    { "condition": "...", "confidence": "high" }
  ],
  "displayPossibleCondition": "...",
  "displayPositiveSymptoms": ["...", "..."],
  "displayContext": ["...", "..."],
  "displayGuidance": ["...", "..."],
  "displayRecommendedSpecialist": "...",
  "displayDisclaimer": "...",
  "displayEmergencyWarning": "..."
}`;

  const inputPayload = {
    possibleConditions: analysisResult.possibleConditions || [],
    possibleCondition: analysisResult.possibleCondition || '',
    positiveSymptoms: analysisResult.positiveSymptoms || [],
    context: analysisResult.context || [],
    guidance: analysisResult.guidance || [],
    recommendedSpecialist: analysisResult.recommendedSpecialist || '',
    disclaimer: analysisResult.disclaimer || '',
    emergencyRecommended: Boolean(analysisResult.emergencyRecommended),
  };

  const userPrompt = `Target Language: ${langName} (${targetLanguage})
Input Canonical English Analysis Data:
${JSON.stringify(inputPayload, null, 2)}

Output JSON:`;

  const parsed = await callGeminiJSONApi(systemPrompt, userPrompt, 7000);

  if (parsed && (parsed.displayPossibleCondition || (parsed.displayPossibleConditions && parsed.displayPossibleConditions.length > 0))) {
    return {
      displayPossibleConditions: Array.isArray(parsed.displayPossibleConditions)
        ? parsed.displayPossibleConditions
        : analysisResult.possibleConditions,
      displayPossibleCondition: parsed.displayPossibleCondition || analysisResult.possibleCondition,
      displayPositiveSymptoms: Array.isArray(parsed.displayPositiveSymptoms) && parsed.displayPositiveSymptoms.length > 0
        ? parsed.displayPositiveSymptoms
        : (analysisResult.positiveSymptoms || []),
      displayContext: Array.isArray(parsed.displayContext) && parsed.displayContext.length > 0
        ? parsed.displayContext
        : (analysisResult.context || []),
      displayGuidance: Array.isArray(parsed.displayGuidance) && parsed.displayGuidance.length > 0
        ? parsed.displayGuidance
        : (analysisResult.guidance || []),
      displayRecommendedSpecialist: parsed.displayRecommendedSpecialist || analysisResult.recommendedSpecialist,
      displayDisclaimer: parsed.displayDisclaimer || analysisResult.disclaimer,
      displayEmergencyWarning: parsed.displayEmergencyWarning || (analysisResult.emergencyRecommended ? 'High risk symptoms detected! Please seek immediate medical assistance.' : ''),
    };
  }

  // Fallback to canonical English on translation failure
  return {
    displayPossibleConditions: analysisResult.possibleConditions || [],
    displayPossibleCondition: analysisResult.possibleCondition || '',
    displayPositiveSymptoms: analysisResult.positiveSymptoms || [],
    displayContext: analysisResult.context || [],
    displayGuidance: analysisResult.guidance || [],
    displayRecommendedSpecialist: analysisResult.recommendedSpecialist || '',
    displayDisclaimer: analysisResult.disclaimer || '',
    displayEmergencyWarning: analysisResult.emergencyRecommended
      ? 'High risk symptoms detected! Please seek immediate medical assistance.'
      : '',
  };
};

module.exports = {
  translateInputToCanonicalEnglish,
  translateFollowUpQuestion,
  translateAnalysisResult,
};
