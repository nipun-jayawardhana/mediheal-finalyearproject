/**
 * Dedicated OpenBioLLM Biomedical Inference Service
 * Model: aaditya/Llama3-OpenBioLLM-8B
 * Provider: Hugging Face Inference Router (featherless-ai)
 */

const MODEL_NAME = process.env.HUGGINGFACE_MODEL || 'aaditya/Llama3-OpenBioLLM-8B';
const ROUTER_ENDPOINT = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';

// Supported MediHeal Specialist categories
const VALID_SPECIALISTS = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Gastroenterologist',
  'ENT Specialist',
  'Orthopedic Specialist',
  'Neurologist',
  'Psychiatrist',
];

/**
 * Normalizes and maps raw specialist strings from LLM output to valid MediHeal specializations
 */
const normalizeSpecialist = (rawSpecialist) => {
  if (!rawSpecialist || typeof rawSpecialist !== 'string') {
    return 'General Physician';
  }
  const clean = rawSpecialist.trim();
  const found = VALID_SPECIALISTS.find(
    (spec) => spec.toLowerCase() === clean.toLowerCase()
  );
  if (found) return found;

  const lower = clean.toLowerCase();
  if (lower.includes('cardio') || lower.includes('heart')) return 'Cardiologist';
  if (lower.includes('derma') || lower.includes('skin')) return 'Dermatologist';
  if (lower.includes('gastro') || lower.includes('stomach') || lower.includes('digest')) return 'Gastroenterologist';
  if (lower.includes('ent') || lower.includes('ear') || lower.includes('nose') || lower.includes('throat')) return 'ENT Specialist';
  if (lower.includes('ortho') || lower.includes('bone') || lower.includes('joint')) return 'Orthopedic Specialist';
  if (lower.includes('neuro') || lower.includes('brain')) return 'Neurologist';
  if (lower.includes('psych') || lower.includes('mental')) return 'Psychiatrist';

  return 'General Physician';
};

/**
 * Extract JSON object from raw response text
 */
const parseJSONFromText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Try direct JSON parse
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Continue to pattern extraction
  }

  // 2. Try markdown code block extraction
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      // Continue
    }
  }

  // 3. Try finding first '{' and last '}'
  const startIdx = rawText.indexOf('{');
  const endIdx = rawText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    const candidate = rawText.substring(startIdx, endIdx + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // Continue
    }
  }

  return null;
};

/**
 * Perform inference call against OpenBioLLM-8B via Hugging Face Router
 * PRIVACY: ONLY sends symptom array, duration, and severity. NO user PII is transmitted.
 */
const analyzeSymptomsWithOpenBioLLM = async (symptoms, duration = '', severity = 'mild') => {
  console.log('[OPENBIOLLM]');
  console.log('Starting biomedical symptom analysis');

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    throw new Error('HUGGINGFACE_API_TOKEN is not configured in backend environment.');
  }

  const symptomsText = Array.isArray(symptoms) ? symptoms.join(', ') : String(symptoms);

  const systemMessage = `You are OpenBioLLM, a specialized biomedical AI assistant for preliminary symptom analysis.
Your task is to analyze patient symptoms and return a JSON object with possible medical conditions, a recommended medical specialist, and general healthcare guidance steps.

Strict Rules:
- Return ONLY valid JSON. No conversational preamble, no markdown formatting.
- "possibleConditions" MUST be an array of up to 3 objects, each with "condition" (the name of a real medical condition) and "confidence" ("high", "medium", or "low").
- "recommendedSpecialist" MUST be ONE of: "General Physician", "Cardiologist", "Dermatologist", "Gastroenterologist", "ENT Specialist", "Orthopedic Specialist", "Neurologist", "Psychiatrist".
- "guidance" MUST be an array of 2-3 safe general self-care recommendations.
- Do NOT prescribe specific prescription medications or claim a definitive diagnosis.`;

  const userMessage = `Patient Symptoms: ${symptomsText}
Duration: ${duration || 'unspecified'}
Severity: ${severity || 'mild'}

JSON Output:`;

  const payload = {
    model: MODEL_NAME,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 350,
  };

  let lastError = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Delay 2.5 seconds on retry for 503 capacity issues
      await new Promise((r) => setTimeout(r, 2500));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(ROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 503 || response.status === 429) {
        lastError = new Error(`Provider temporarily unavailable (HTTP ${response.status})`);
        continue; // Retry
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenBioLLM API HTTP Error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const responseData = await response.json();
      const rawContent = responseData.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error('OpenBioLLM returned an empty content response');
      }

      const parsedJSON = parseJSONFromText(rawContent);
      if (!parsedJSON) {
        throw new Error('Failed to parse structured JSON from OpenBioLLM response');
      }

      // Output Validation & Normalization
      let possibleConditions = [];
      if (Array.isArray(parsedJSON.possibleConditions) && parsedJSON.possibleConditions.length > 0) {
        const validConfidences = ['high', 'medium', 'low'];
        const seenConditions = new Set();

        for (const item of parsedJSON.possibleConditions) {
          if (!item || typeof item !== 'object') continue;
          const condName = typeof item.condition === 'string' ? item.condition.trim() : '';
          if (!condName || seenConditions.has(condName.toLowerCase())) continue;

          seenConditions.add(condName.toLowerCase());
          let conf = typeof item.confidence === 'string' ? item.confidence.toLowerCase().trim() : 'medium';
          if (!validConfidences.includes(conf)) conf = 'medium';

          possibleConditions.push({
            condition: condName,
            confidence: conf,
          });

          if (possibleConditions.length >= 3) break;
        }
      }

      if (possibleConditions.length === 0) {
        throw new Error('OpenBioLLM did not produce valid possible conditions');
      }

      const recommendedSpecialist = normalizeSpecialist(parsedJSON.recommendedSpecialist);

      let guidance = [];
      if (Array.isArray(parsedJSON.guidance) && parsedJSON.guidance.length > 0) {
        guidance = parsedJSON.guidance
          .map((g) => (typeof g === 'string' ? g.trim() : ''))
          .filter((g) => g.length > 0 && g.length <= 250)
          .slice(0, 4);
      }

      if (guidance.length === 0) {
        guidance = [
          'Rest adequately and monitor symptoms.',
          'Stay well hydrated with fluids.',
          'Consult a medical professional if symptoms worsen.',
        ];
      }

      console.log('[OPENBIOLLM]');
      console.log(`Model: ${MODEL_NAME}`);
      console.log('Inference: SUCCESS');
      console.log('analysisSource: openbiollm');

      return {
        possibleConditions,
        topCondition: possibleConditions[0].condition,
        recommendedSpecialist,
        guidance,
        modelName: MODEL_NAME,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error('OpenBioLLM request timed out after 15 seconds');
      }
    }
  }

  throw lastError || new Error('Failed to complete OpenBioLLM inference after retries');
};

module.exports = {
  analyzeSymptomsWithOpenBioLLM,
  normalizeSpecialist,
  MODEL_NAME,
};
