/**
 * Dedicated Secondary Gemini Medical Fallback Service
 * Model: gemini-flash-lite-latest (or GEMINI_MODEL env var)
 * Triggered ONLY when primary OpenBioLLM inference fails or times out.
 * 
 * Rules:
 * - Operates on the EXACT SAME canonical clinical case object as OpenBioLLM
 * - Employs strict JSON formatting and biomedical failover prompt
 * - Respects negative findings and context
 * - Validates and normalizes output (specialist normalized, confidence in high/medium/low, 1-3 conditions)
 * - Returns structured output with analysisSource = 'gemini-secondary' and modelName
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const { normalizeSpecialist } = require('./openBioLLMService');

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
 * Executes secondary biomedical symptom analysis via Gemini API
 * ONLY when primary OpenBioLLM fails.
 * 
 * @param {Object} clinicalCase Canonical clinical case object
 * @param {string} reqId Request tracking ID
 * @param {number} maxTimeoutMs Remaining time budget for Gemini call (e.g. 5000-8000ms)
 */
const analyzeSymptomsWithGeminiSecondary = async (clinicalCase, reqId = '', maxTimeoutMs = 8000) => {
  const tag = reqId ? `[GEMINI SECONDARY][${reqId}]` : '[GEMINI SECONDARY]';
  const startedAt = Date.now();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(`${tag} GEMINI_API_KEY is not configured — bypassing secondary AI`);
    throw new Error('GEMINI_API_KEY unavailable');
  }

  console.log(`${tag} Initiating secondary biomedical analysis via ${GEMINI_MODEL_NAME} (Budget: ${maxTimeoutMs}ms)`);

  const posText = Array.isArray(clinicalCase.positiveSymptoms) && clinicalCase.positiveSymptoms.length > 0
    ? clinicalCase.positiveSymptoms.map((s) => `- ${s}`).join('\n')
    : 'none reported';

  const ctxText = Array.isArray(clinicalCase.context) && clinicalCase.context.length > 0
    ? clinicalCase.context.join(', ')
    : 'none';

  const negText = Array.isArray(clinicalCase.negativeFindings) && clinicalCase.negativeFindings.length > 0
    ? clinicalCase.negativeFindings.map((s) => `- ${s}`).join('\n')
    : 'none reported';

  const addDetailsText = Array.isArray(clinicalCase.additionalDetails) && clinicalCase.additionalDetails.length > 0
    ? clinicalCase.additionalDetails.map((s) => `- ${s}`).join('\n')
    : 'none';

  const durationText = clinicalCase.duration || 'unspecified';
  const severityText = (clinicalCase.severity && clinicalCase.severity !== 'null' && clinicalCase.severity !== 'unspecified')
    ? clinicalCase.severity
    : 'not explicitly rated';

  const systemInstruction = `You are a secondary biomedical AI failover assistant for MediHeal preliminary symptom analysis.
Your task is to analyze patient symptoms and return a structured JSON object with possible medical conditions, a recommended medical specialist, and general healthcare guidance.

Rules:
- Return ONLY valid JSON. No conversational preamble, no markdown formatting.
- "possibleConditions" MUST be an array of 1 to 3 objects, each with "condition" (name of a real medical condition) and "confidence" ("high", "medium", or "low").
- "recommendedSpecialist" MUST be ONE of: "General Physician", "Cardiologist", "Dermatologist", "Gastroenterologist", "ENT Specialist", "Orthopedic Specialist", "Neurologist", "Psychiatrist".
- "guidance" MUST be an array of 2 to 3 safe self-care recommendations.
- Do NOT prescribe specific prescription medications or claim a definitive diagnosis.
- Reason over the COMPLETE patient case including positive symptoms, negative findings, aggravating context, duration, and severity.
- Respect negative findings. If a symptom is in negative findings (e.g., "no fever", "no difficulty breathing"), do NOT infer that symptom.`;

  const userPrompt = `Patient Clinical Case:

Positive symptoms:
${posText}

Negative findings:
${negText}

Relevant context / mechanism:
${ctxText}

Duration:
${durationText}

Severity:
${severityText}

Additional details:
${addDetailsText}

Provide preliminary possible conditions based ONLY on the supplied patient information.

JSON Output:`;

  const requestPayload = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 500,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

  try {
    const url = `${GEMINI_API_URL}/${GEMINI_MODEL_NAME}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn(`${tag} Quota unavailable (429) — using safe fallback`);
      throw new Error('Gemini API rate limit exceeded (429)');
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`${tag} Gemini HTTP ${response.status}: ${errText.substring(0, 100)}`);
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) {
      throw new Error('Empty response payload from Gemini secondary');
    }

    const parsed = parseJSONFromText(rawText);
    if (!parsed) {
      console.warn(`${tag} Failed to parse JSON from response text`);
      throw new Error('Invalid JSON from Gemini secondary');
    }

    // Validate possibleConditions
    let conditions = [];
    if (Array.isArray(parsed.possibleConditions) && parsed.possibleConditions.length > 0) {
      conditions = parsed.possibleConditions.slice(0, 3).map((item) => {
        const condName = typeof item === 'string' ? item : (item.condition || item.name || 'Unspecified Condition');
        const conf = typeof item === 'object' && ['high', 'medium', 'low'].includes(String(item.confidence).toLowerCase())
          ? String(item.confidence).toLowerCase()
          : 'medium';
        return { condition: condName.trim(), confidence: conf };
      });
    } else if (parsed.possibleCondition) {
      conditions = [{ condition: String(parsed.possibleCondition).trim(), confidence: 'medium' }];
    }

    if (conditions.length === 0) {
      throw new Error('Gemini secondary returned no valid conditions');
    }

    // Validate and normalize specialist
    const rawSpec = parsed.recommendedSpecialist || parsed.specialist || 'General Physician';
    const normalizedSpec = normalizeSpecialist(rawSpec);

    // Validate guidance array
    let guidance = [];
    if (Array.isArray(parsed.guidance) && parsed.guidance.length > 0) {
      guidance = parsed.guidance.map((g) => String(g).trim()).filter((g) => g.length > 0).slice(0, 3);
    }
    if (guidance.length === 0) {
      guidance = [
        'Rest and monitor your symptoms closely.',
        'Stay well hydrated and seek medical consultation if symptoms persist.',
      ];
    }

    const elapsed = Date.now() - startedAt;
    console.log(`${tag} Secondary analysis completed successfully in ${elapsed}ms`);

    return {
      topCondition: conditions[0].condition,
      possibleConditions: conditions,
      recommendedSpecialist: normalizedSpec,
      guidance,
      analysisSource: 'gemini-secondary',
      modelName: GEMINI_MODEL_NAME,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startedAt;
    if (err.name === 'AbortError') {
      console.warn(`${tag} Secondary analysis timed out after ${elapsed}ms`);
      throw new Error(`Gemini secondary analysis timed out after ${elapsed}ms`);
    }
    console.warn(`${tag} Secondary analysis failed (${err.message})`);
    throw err;
  }
};

module.exports = {
  analyzeSymptomsWithGeminiSecondary,
  GEMINI_MODEL_NAME,
};
