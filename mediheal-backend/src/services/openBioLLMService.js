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
 * PRIVACY: ONLY sends symptom data, duration, and severity. NO user PII is transmitted.
 * Accepts either a canonical clinical case object OR individual parameters.
 */
const analyzeSymptomsWithOpenBioLLM = async (input, param2 = '', param3 = 'mild', param4 = '') => {
  let clinicalCase;
  let reqId = '';

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    clinicalCase = input;
    reqId = typeof param2 === 'string' ? param2 : (typeof param4 === 'string' ? param4 : '');
  } else {
    const symptomsArr = Array.isArray(input) ? input : [String(input || '')];
    reqId = typeof param4 === 'string' ? param4 : '';
    clinicalCase = {
      positiveSymptoms: symptomsArr,
      negativeFindings: [],
      context: [],
      duration: typeof param2 === 'string' ? param2 : 'unspecified',
      severity: typeof param3 === 'string' ? param3 : 'mild',
    };
  }

  const tag = reqId ? `[OPENBIOLLM][${reqId}]` : '[OPENBIOLLM]';
  const startedAt = Date.now();
  console.log(`${tag} Request preparation started`);

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    throw new Error('HUGGINGFACE_API_TOKEN is not configured in backend environment.');
  }

  let endpointHost = 'router.huggingface.co';
  try {
    const urlObj = new URL(ROUTER_ENDPOINT);
    endpointHost = urlObj.hostname;
  } catch (e) {
    // Default fallback host
  }

  console.log(`${tag} Endpoint/model configuration verified`);
  console.log(`${tag} Model: ${MODEL_NAME}`);
  console.log(`${tag} Endpoint host: ${endpointHost}`);
  console.log(`${tag} Payload format: chat-completion`);
  console.log(`${tag} Positive symptoms count: ${Array.isArray(clinicalCase.positiveSymptoms) ? clinicalCase.positiveSymptoms.length : 0}`);
  console.log(`${tag} Negative findings count: ${Array.isArray(clinicalCase.negativeFindings) ? clinicalCase.negativeFindings.length : 0}`);
  console.log(`${tag} Context count: ${Array.isArray(clinicalCase.context) ? clinicalCase.context.length : 0}`);
  console.log(`${tag} Duration present: ${clinicalCase.duration && clinicalCase.duration !== 'unspecified' ? 'yes' : 'no'}`);
  console.log(`${tag} Severity explicitly rated: ${clinicalCase.severity ? 'yes' : 'no'}`);

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

  const systemMessage = `You are OpenBioLLM, a specialized biomedical AI assistant for preliminary symptom analysis.
Your task is to analyze patient symptoms and return a JSON object with possible medical conditions, a recommended medical specialist, and general healthcare guidance steps.

Strict Rules:
- Return ONLY valid JSON. No conversational preamble, no markdown formatting.
- "possibleConditions" MUST be an array of up to 3 objects, each with "condition" (the name of a real medical condition) and "confidence" ("high", "medium", or "low").
- "recommendedSpecialist" MUST be ONE of: "General Physician", "Cardiologist", "Dermatologist", "Gastroenterologist", "ENT Specialist", "Orthopedic Specialist", "Neurologist", "Psychiatrist".
- "guidance" MUST be an array of 2-3 safe general self-care recommendations.
- Do NOT prescribe specific prescription medications or claim a definitive diagnosis.
- Reason over the COMPLETE patient case including injury mechanism/context, positive symptoms, and negative findings.
- Do NOT treat context/mechanism items as symptoms, and do NOT ignore injury mechanisms. Do NOT infer unreported symptoms.`;

  const userMessage = `Patient Symptom Assessment:

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
Do not treat context items as symptoms.
Do not ignore injury mechanism.
Do not infer unreported symptoms.

JSON Output:`;

  console.log(`[OPENBIOLLM PAYLOAD][${reqId || 'dev'}]\n\n${userMessage}`);

  const payload = {
    model: MODEL_NAME,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 350,
  };

  const TOTAL_AI_DEADLINE_MS = 25000; // Hard top-level deadline: 25 seconds
  const SAFETY_MARGIN_MS = 1500; // Reserve 1.5s safety margin for error propagation
  const deadlineAt = startedAt + TOTAL_AI_DEADLINE_MS;
  const maxRetries = 1;
  let lastError = null;

  const globalController = new AbortController();
  const globalTimeoutId = setTimeout(() => {
    globalController.abort();
  }, TOTAL_AI_DEADLINE_MS);

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const elapsed = Date.now() - startedAt;
      const remainingTime = deadlineAt - Date.now();

      if (globalController.signal.aborted || remainingTime <= SAFETY_MARGIN_MS) {
        console.warn(`${tag} Global deadline reached (${Math.min(TOTAL_AI_DEADLINE_MS, elapsed)}ms)`);
        lastError = lastError || new Error(`OpenBioLLM global deadline reached (${Math.min(TOTAL_AI_DEADLINE_MS, elapsed)}ms)`);
        break;
      }

      const currentAttemptTimeout = Math.max(100, remainingTime - SAFETY_MARGIN_MS);

      if (attempt === 0) {
        console.log(`${tag} Primary attempt started (timeout: ${currentAttemptTimeout}ms)`);
      } else {
        console.log(`${tag} Retrying with ${remainingTime}ms remaining`);
        console.log(`${tag} Attempt 2 started (timeout: ${currentAttemptTimeout}ms)`);
      }

      if (attempt > 0) {
        const retryDelay = Math.min(500, remainingTime - SAFETY_MARGIN_MS);
        if (retryDelay > 0) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }

      const remainingAfterDelay = deadlineAt - Date.now();
      if (globalController.signal.aborted || remainingAfterDelay <= SAFETY_MARGIN_MS) {
        console.warn(`${tag} Global deadline reached (${Math.min(TOTAL_AI_DEADLINE_MS, Date.now() - startedAt)}ms)`);
        lastError = lastError || new Error(`OpenBioLLM global deadline reached (${Math.min(TOTAL_AI_DEADLINE_MS, Date.now() - startedAt)}ms)`);
        break;
      }

      const attemptMaxTimeout = Math.max(100, remainingAfterDelay - SAFETY_MARGIN_MS);

      if (attemptMaxTimeout < 3000) {
        console.warn(`${tag} Skipping retry attempt ${attempt + 1}: insufficient time budget (${attemptMaxTimeout}ms)`);
        break;
      }

      const attemptController = new AbortController();
      const attemptStart = Date.now();
      const attemptTimeoutId = setTimeout(() => attemptController.abort(), attemptMaxTimeout);

      const onGlobalAbort = () => attemptController.abort();
      if (globalController.signal.aborted) {
        attemptController.abort();
      } else {
        globalController.signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      try {
        console.log(`${tag} Request dispatched`);
        console.log(`${tag} Provider queued / request still pending...`);
        const response = await fetch(ROUTER_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: attemptController.signal,
        });

        clearTimeout(attemptTimeoutId);
        globalController.signal.removeEventListener('abort', onGlobalAbort);
        const attemptDuration = Date.now() - attemptStart;

        if (response.status === 401) {
          console.warn(`${tag} HTTP 401 — authentication failure`);
          lastError = new Error('Provider authentication failure (HTTP 401)');
          break;
        }

        if (response.status === 402) {
          console.warn(`${tag} HTTP 402 — provider quota depleted / payment required`);
          lastError = new Error('Provider quota depleted (HTTP 402)');
          break;
        }

        if (response.status === 403) {
          console.warn(`${tag} HTTP 403 — authorization/provider access failure`);
          lastError = new Error('Provider access failure (HTTP 403)');
          break;
        }

        if (response.status === 404) {
          console.warn(`${tag} HTTP 404 — model/endpoint not available`);
          lastError = new Error('Endpoint not available (HTTP 404)');
          break;
        }

        if (response.status === 429) {
          console.warn(`${tag} HTTP 429 — provider capacity/rate limit (after ${attemptDuration}ms)`);
          lastError = new Error(`Provider rate limited (HTTP 429)`);
          if (attemptDuration < 5000) {
            continue;
          } else {
            break;
          }
        }

        if (response.status === 502) {
          console.warn(`${tag} HTTP 502 — upstream provider error (after ${attemptDuration}ms)`);
          lastError = new Error(`Provider gateway error (HTTP 502)`);
          if (attemptDuration < 5000) {
            continue;
          } else {
            break;
          }
        }

        if (response.status === 503) {
          console.warn(`${tag} HTTP 503 — provider temporarily unavailable (after ${attemptDuration}ms)`);
          lastError = new Error(`Provider temporarily unavailable (HTTP 503)`);
          if (attemptDuration < 5000) {
            continue;
          } else {
            break;
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`${tag} HTTP ${response.status} — provider error: ${errorText.substring(0, 200)}`);
          const permanentError = new Error(`OpenBioLLM API HTTP Error ${response.status}: ${errorText.substring(0, 200)}`);
          if (response.status >= 400 && response.status < 500) {
            lastError = permanentError;
            break;
          }
          throw permanentError;
        }

        const responseData = await response.json();
        const rawContent = responseData.choices?.[0]?.message?.content;

        console.log(`${tag} HTTP status: 200 OK (${attemptDuration}ms)`);
        console.log(`${tag} HTTP 200`);
        console.log(`${tag} Raw response structure recognized: ${responseData.choices?.[0]?.message ? 'YES' : 'NO'}`);
        console.log(`${tag} Generated text extracted: ${rawContent ? 'YES' : 'NO'}`);

        if (!rawContent) {
          console.warn(`${tag} INVALID_RESPONSE`);
          console.warn(`${tag} Reason: empty content response from provider`);
          throw new Error('OpenBioLLM returned an empty content response');
        }

        const parsedJSON = parseJSONFromText(rawContent);
        console.log(`${tag} JSON parse: ${parsedJSON ? 'PASS' : 'FAIL'}`);
        if (!parsedJSON) {
          console.warn(`${tag} INVALID_RESPONSE`);
          console.warn(`${tag} Reason: failed to parse structured JSON from response text`);
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

        console.log(`${tag} Schema validation: ${possibleConditions.length > 0 ? 'PASS' : 'FAIL'}`);

        if (possibleConditions.length === 0) {
          console.warn(`${tag} INVALID_RESPONSE`);
          console.warn(`${tag} Reason: no valid possible conditions found in response`);
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

        const totalElapsed = Math.min(TOTAL_AI_DEADLINE_MS, Date.now() - startedAt);
        console.log(`${tag} Inference: SUCCESS`);
        console.log(`${tag} Inference SUCCESS (in ${attemptDuration}ms)`);
        console.log(`${tag} Total model elapsed: ${totalElapsed}ms`);
        console.log(`${tag} Model: ${MODEL_NAME}`);
        console.log(`${tag} analysisSource: openbiollm`);

        return {
          possibleConditions,
          topCondition: possibleConditions[0].condition,
          recommendedSpecialist,
          guidance,
          modelName: MODEL_NAME,
        };
      } catch (err) {
        clearTimeout(attemptTimeoutId);
        globalController.signal.removeEventListener('abort', onGlobalAbort);
        const attemptDuration = Date.now() - attemptStart;
        if (err.name === 'AbortError' || globalController.signal.aborted) {
          console.warn(`${tag} TIMEOUT — provider exceeded allowed inference time (${attemptDuration}ms)`);
          lastError = new Error(`OpenBioLLM request timed out after ${attemptMaxTimeout}ms`);
        } else {
          lastError = err;
          if (!err.message.includes('HTTP Error') && !err.message.includes('INVALID_RESPONSE')) {
            console.warn(`${tag} NETWORK_ERROR — transport/connectivity failure (${err.message})`);
          } else {
            console.warn(`${tag} Attempt ${attempt + 1} failed: ${err.message}`);
          }
        }
      }
    }
  } finally {
    clearTimeout(globalTimeoutId);
  }

  const finalElapsed = Math.min(TOTAL_AI_DEADLINE_MS, Date.now() - startedAt);
  console.warn(`${tag} Global deadline reached`);
  console.warn(`${tag} Total model elapsed: ${finalElapsed}ms`);
  throw lastError || new Error('Failed to complete OpenBioLLM inference within deadline');
};

module.exports = {
  analyzeSymptomsWithOpenBioLLM,
  normalizeSpecialist,
  MODEL_NAME,
};
