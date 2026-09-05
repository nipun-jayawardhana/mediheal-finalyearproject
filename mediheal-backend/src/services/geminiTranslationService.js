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
const clinicalCaseService = require('./clinicalCaseService');

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
- CRITICAL NEGATION SAFETY RULE:
  Explicitly negated symptoms (e.g. "මම සිහි නැති වෙලා නැහැ, පපුවේ වේදනාවකුත් නැහැ" -> "I have not fainted, and I do not have chest pain") MUST be placed into "negativeFindings" (e.g. ["no fainting", "no chest pain"]).
  Negated or denied symptoms must NEVER, under any circumstance, be placed into "positiveSymptoms" or "symptomConcepts".
- PRESERVE ALL AFFIRMED POSITIVE SYMPTOMS: Extract positive/affirmed symptoms into "positiveSymptoms" and "symptomConcepts".
- PRESERVE EXACT ANATOMICAL LOCATIONS & QUALIFIERS: (e.g. "light-headedness on standing", "lower right abdomen", "swollen neck glands").
- PRESERVE DURATION: Extract explicit duration into the "duration" field (e.g. "several days", "3 days", "today").

Respond strictly with JSON:
{
  "detectedLanguage": "si",
  "englishText": "Whenever I stand up I feel light-headed, my heart sometimes beats faster than usual, and I feel weak and tired. I have not fainted and I do not have chest pain.",
  "positiveSymptoms": ["light-headedness on standing", "palpitations", "weakness", "fatigue"],
  "negativeFindings": ["no fainting", "no chest pain"],
  "symptomConcepts": ["light-headedness on standing", "palpitations", "weakness", "fatigue"],
  "duration": ""
}`;

  const userPrompt = `Source Language Hint: ${sourceLanguage}
Patient Raw Input Text: "${cleanInput}"

Output JSON:`;

  const parsed = await callGeminiJSONApi(systemPrompt, userPrompt, 6000);

  if (parsed && parsed.englishText) {
    let concepts = Array.isArray(parsed.symptomConcepts)
      ? parsed.symptomConcepts.filter((c) => typeof c === 'string' && c.trim().length > 0)
      : (Array.isArray(parsed.positiveSymptoms) ? parsed.positiveSymptoms : []);
    
    let pos = Array.isArray(parsed.positiveSymptoms)
      ? parsed.positiveSymptoms.filter((c) => typeof c === 'string' && c.trim().length > 0)
      : concepts;

    let neg = Array.isArray(parsed.negativeFindings)
      ? parsed.negativeFindings.filter((c) => typeof c === 'string' && c.trim().length > 0)
      : [];

    // Also run local deterministic negation extractor on cleanInput to guarantee no Sinhala negations were missed
    const localInitial = clinicalCaseService.extractInitialSymptomsAndContext(cleanInput);
    localInitial.negativeFindings.forEach((n) => {
      if (!neg.includes(n)) neg.push(n);
    });

    // Guard: Remove any negated concept from positive concepts
    pos = pos.filter((p) => {
      const pLow = p.toLowerCase();
      return !neg.some((n) => {
        const nLow = n.toLowerCase();
        if (pLow.includes('chest pain')) return nLow.includes('no chest pain');
        if (pLow.includes('faint')) return nLow.includes('no fainting');
        return nLow === `no ${pLow}` || nLow.includes(`no ${pLow}`);
      });
    });
    concepts = concepts.filter((c) => pos.includes(c));

    // If pos is empty but localInitial has positive symptoms
    if (pos.length === 0 && localInitial.positiveSymptoms.length > 0) {
      pos = localInitial.positiveSymptoms;
      concepts = localInitial.positiveSymptoms;
    }

    const dur = typeof parsed.duration === 'string' && parsed.duration.trim() ? parsed.duration.trim() : (localInitial.duration || '');

    return {
      detectedLanguage: parsed.detectedLanguage || sourceLanguage || 'si',
      englishText: parsed.englishText.trim(),
      symptomConcepts: concepts,
      positiveSymptoms: pos,
      negativeFindings: neg,
      duration: dur,
    };
  }

  // Fallback if translation API fails or times out
  const fallbackInitial = clinicalCaseService.extractInitialSymptomsAndContext(cleanInput);
  return {
    detectedLanguage: sourceLanguage || 'en',
    englishText: cleanInput,
    symptomConcepts: fallbackInitial.positiveSymptoms.length > 0 ? fallbackInitial.positiveSymptoms : [cleanInput.toLowerCase()],
    positiveSymptoms: fallbackInitial.positiveSymptoms,
    negativeFindings: fallbackInitial.negativeFindings,
    duration: fallbackInitial.duration || '',
    isFallback: true,
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

/**
 * Deterministically normalizes common Sinhala/Tamil follow-up questions to canonical English.
 */
const normalizeQuestionTextToEnglish = (questionText = '') => {
  if (!questionText || typeof questionText !== 'string') return '';
  const cleanQ = questionText.trim();
  if (/^[a-zA-Z0-9\s,.?!'\-]+$/.test(cleanQ)) {
    return cleanQ;
  }

  const lower = cleanQ.toLowerCase();

  // Multi-concept detection in Sinhala
  const hasHeadacheSi = lower.includes('හිසේ කැක්කුම') || lower.includes('හිසරදය') || lower.includes('හිස රදය');
  const hasVisionSi = lower.includes('පෙනීමේ වෙනස') || lower.includes('පෙනීම') || lower.includes('ඇස් පෙනීම') || lower.includes('බලන්න අමාරු');
  const hasDizzySi = lower.includes('ක්ලාන්ත') || lower.includes('කරකැවිල්ල');

  if (hasHeadacheSi && hasVisionSi) {
    return 'Do you have headache or vision changes?';
  }
  if (hasDizzySi && hasHeadacheSi && hasVisionSi) {
    return 'Do you experience headache or vision changes when you feel dizzy?';
  }
  if (hasDizzySi && (hasHeadacheSi || lower.includes('වමනය'))) {
    if (lower.includes('වමනය')) return 'Do you have dizziness or vomiting?';
    return 'Do you have dizziness or headache?';
  }

  // Single concept Sinhala questions
  if (lower.includes('පපුවේ වේදනා') || lower.includes('පපුවේ කැක්කුම') || lower.includes('පපුවේ අමාරුව')) {
    return 'Do you have chest pain?';
  }
  if (hasHeadacheSi) {
    return 'Do you have a headache?';
  }
  if (hasVisionSi) {
    return 'Have you experienced any changes in your vision, such as blurriness or seeing spots?';
  }
  if (hasDizzySi) {
    return 'Have you experienced dizziness?';
  }
  if (lower.includes('මුත්රා සමඟ රුධිරය') || lower.includes('මුත්රා වල ලේ') || lower.includes('මුත්රා වල රුධිරය') || lower.includes('රුධිරය පිටවීමක්') || lower.includes('இரத்தம்') || lower.includes('சிறுநீரில் இரத்தம்')) {
    return 'Have you noticed any blood in your urine?';
  }
  if (lower.includes('නිතර මුත්රා') || lower.includes('නිතරම මුත්රා') || lower.includes('අடிக்கடி சிறுநீர்')) {
    return 'Do you feel the need to urinate more often than usual?';
  }
  if ((lower.includes('ඇවිදීමේ') || lower.includes('ඇවිදින')) && (lower.includes('සමබර') || lower.includes('අපහසු')) || lower.includes('සමබරතාවය') || lower.includes('சமநிலை') || lower.includes('நடப்பதில்')) {
    return 'Have you noticed any difficulty with your balance or walking?';
  }
  if (lower.includes('කොපමණ කාලයක්') || lower.includes('කොච්චර කල්') || lower.includes('කවදා සිට') || lower.includes('කාලයක් තිස්සේ')) {
    return 'How long have you been experiencing this?';
  }
  if (lower.includes('උණ')) {
    return 'Do you have a fever?';
  }
  if (lower.includes('වමනය')) {
    return 'Have you been vomiting?';
  }
  if (lower.includes('හුස්ම')) {
    return 'Do you have difficulty breathing?';
  }
  if (lower.includes('බඩේ කැක්කුම') || lower.includes('බඩේ අමාරුව')) {
    return 'Do you have abdominal pain?';
  }

  return cleanQ;
};

module.exports = {
  translateInputToCanonicalEnglish,
  translateFollowUpQuestion,
  translateAnalysisResult,
  normalizeQuestionTextToEnglish,
};
