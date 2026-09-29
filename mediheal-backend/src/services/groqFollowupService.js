/**
 * Groq Follow-up Service
 * Backup AI provider for MediHeal Patient Symptom Conversational Follow-Up.
 * Model: qwen/qwen-2.5-7b-instruct (with live Groq compatibility fallback to qwen/qwen3.8-27b)
 * 
 * Clinical Safety Guardrails:
 * - Generate FOLLOW-UP QUESTIONS ONLY.
 * - Do NOT diagnose diseases or conditions.
 * - Do NOT generate medical recommendations or treatments.
 * - Do NOT assess or change risk levels.
 * - Do NOT override emergency detection.
 * - Strictly target missing clinical information (one concept per question).
 * - NEVER ask about symptoms already present in Negative Findings.
 * - Do NOT repeat previous questions.
 */

const clinicalCaseService = require('./clinicalCaseService');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'qwen/qwen-2.5-7b-instruct';
const COMPATIBILITY_MODEL = 'qwen/qwen3.8-27b';
const GROQ_REQUEST_TIMEOUT_MS = parseInt(process.env.GROQ_REQUEST_TIMEOUT_MS, 10) || 8000;

/**
 * Extract JSON object safely from raw response text
 */
const parseJSONFromText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Continue
  }

  // 2. Markdown code block extraction
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
 * Generate a conversational follow-up question via Groq Qwen2.5
 * 
 * Accepts either:
 * - An options object: { symptoms, canonicalCase, previousQuestions, language, questionCount }
 * - Positional arguments: (symptoms, canonicalCase, previousQuestions, language, questionCount)
 * 
 * Returns:
 * {
 *   question: string,
 *   concept: string,
 *   quickOptions: string[]
 * }
 */
const generateFollowUpQuestion = async (arg1 = {}, ...rest) => {
  let symptoms = [];
  let canonicalCase = null;
  let previousQuestions = [];
  let language = 'en';
  let questionCount = 0;

  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && (arg1.symptoms || arg1.canonicalCase || arg1.previousQuestions !== undefined)) {
    symptoms = Array.isArray(arg1.symptoms) ? arg1.symptoms : [];
    canonicalCase = arg1.canonicalCase || null;
    previousQuestions = Array.isArray(arg1.previousQuestions) ? arg1.previousQuestions : [];
    language = typeof arg1.language === 'string' ? arg1.language : 'en';
    questionCount = Number(arg1.questionCount) || 0;
  } else {
    symptoms = Array.isArray(arg1) ? arg1 : [];
    canonicalCase = rest[0] || null;
    previousQuestions = Array.isArray(rest[1]) ? rest[1] : [];
    language = typeof rest[2] === 'string' ? rest[2] : 'en';
    questionCount = Number(rest[3]) || 0;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in environment');
  }

  // Ensure structured canonical case is available
  const activeCase = canonicalCase || clinicalCaseService.buildCanonicalClinicalCase({
    symptoms,
  });

  const clinicalProfile = clinicalCaseService.buildClinicalProfile(activeCase);

  const systemPrompt = `You are MediHeal's conversational symptom follow-up assistant for elderly patients.
Your sole purpose is to ask 1 short, polite follow-up question (1 sentence max) to clarify missing clinical information.

Strict Clinical Safety Rules:
- Generate FOLLOW-UP QUESTIONS ONLY.
- Do NOT diagnose any disease or medical condition.
- Do NOT provide medical advice, treatments, or prescriptions.
- Do NOT assess or change risk levels.
- Do NOT override emergency detection.
- Ask about ONLY ONE clinical concept (never combine multiple symptoms or concepts in one question).
- Strictly adhere to the active Clinical Domain (${clinicalProfile.clinicalDomain || 'general'}).
- NEVER ask about or assume symptoms that appear in Negative Findings (e.g. if 'no fever' is reported, do NOT ask about fever).
- Do NOT repeat questions that were already asked.
- Do NOT ask for information that is already known (such as known duration, known severity, or known symptoms).
- Provide 2 to 4 simple, elderly-friendly quick answer options (e.g., ["Yes", "No"]).

Respond strictly with a single valid JSON object matching this schema:
{
  "question": "Have you noticed any changes in your ability to walk?",
  "concept": "mobility",
  "quickOptions": ["Yes", "No"]
}`;

  const userPrompt = `Patient Clinical Profile:
Primary Complaint: ${clinicalProfile.primaryComplaint || symptoms.join(', ') || 'unspecified'}
Clinical Domain: ${clinicalProfile.clinicalDomain || 'general'}
Body Regions: ${(clinicalProfile.bodyRegions || []).join(', ') || 'unspecified'}

Patient Cumulative Clinical Case:
Positive Symptoms: ${(activeCase.positiveSymptoms || symptoms || []).join(', ') || 'none reported'}
Negative Findings (NEVER ASK ABOUT OR ASSUME THESE): ${(activeCase.negativeFindings || []).join(', ') || 'none'}
Injury Mechanism / Context: ${(activeCase.context || []).join(', ') || 'none'}
Current Duration: ${activeCase.duration || 'unspecified'}
Current Severity: ${activeCase.severity || 'unspecified'}
Additional Details: ${(activeCase.additionalDetails || []).join(', ') || 'none'}

Previous Questions Asked: ${previousQuestions.join(' | ') || 'none'}
Current Question Count: ${questionCount} / 3

Instruction:
Generate 1 relevant, single-concept follow-up question targeting missing clinical information ONLY.
Ensure the question strictly relates to the active Clinical Domain (${clinicalProfile.clinicalDomain}).
Respond strictly in JSON format.`;

  const sendRequest = async (modelToUse) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return { ok: response.ok, status: response.status, data: await response.json() };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // Attempt primary model first
  let res = await sendRequest(PRIMARY_MODEL);

  // If primary model is not found or decommissioned on Groq, fallback to active Groq Qwen model
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    const errCode = res.data?.error?.code;
    if (errCode === 'model_not_found' || errCode === 'model_decommissioned') {
      res = await sendRequest(COMPATIBILITY_MODEL);
    }
  }

  if (!res.ok) {
    const errMsg = res.data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Groq API request failed: ${errMsg}`);
  }

  const rawContent = res.data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Groq returned empty response content');
  }

  const parsed = parseJSONFromText(rawContent);
  if (!parsed || typeof parsed !== 'object' || !parsed.question || typeof parsed.question !== 'string') {
    throw new Error('Groq returned invalid JSON schema missing question');
  }

  let candidateQ = parsed.question.trim();
  if (candidateQ.length > 150) {
    candidateQ = candidateQ.substring(0, 147) + '...';
  }

  const rawOptions = Array.isArray(parsed.quickOptions) ? parsed.quickOptions : ['Yes', 'No'];
  const cleanOptions = rawOptions
    .filter((o) => typeof o === 'string' && o.trim().length > 0 && o.length < 30)
    .slice(0, 4);

  let concept = parsed.concept || parsed.field || '';
  if (!concept) {
    const conceptInfo = clinicalCaseService.extractPrimaryClinicalConcept(candidateQ, activeCase);
    concept = conceptInfo.primaryConcept || 'follow_up';
  }

  return {
    question: candidateQ,
    concept,
    quickOptions: cleanOptions.length > 0 ? cleanOptions : ['Yes', 'No'],
  };
};

module.exports = {
  generateFollowUpQuestion,
  generateFollowUp: generateFollowUpQuestion,
};
