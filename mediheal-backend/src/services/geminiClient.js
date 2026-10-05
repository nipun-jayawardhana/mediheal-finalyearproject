/**
 * Gemini Client
 *
 * Shared REST caller for all Gemini services.
 * - Short per-attempt timeout so a stalled request is abandoned quickly
 * - Retries only transient failures (timeout, network error, 429, 5xx) with jittered backoff
 * - Falls back to GEMINI_FALLBACK_MODEL (default gemini-3.5-flash-lite) when the primary model fails
 * - Optional total budget so retries and fallback never exceed the caller's overall time limit
 *
 * Throws an Error (with `.status` for HTTP failures) when every model and attempt fails.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-lite-latest';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
// Model missing/retired: the next model may still work
const NEXT_MODEL_STATUS = new Set([404]);
const MIN_ATTEMPT_MS = 1500;
const FALLBACK_RESERVE_MS = 4000;

const getDefaultTimeoutMs = () => Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 5000;
const getDefaultRetries = () => {
  const n = Number(process.env.GEMINI_MAX_RETRIES);
  return Number.isInteger(n) && n >= 0 ? n : 2;
};

const getPrimaryModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;
const getFallbackModels = () => (process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Try a single model with retries until `deadline`.
 */
const callModel = async (model, payload, { apiKey, timeoutMs, retries, deadline, tag }) => {
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const attemptTimeout = Math.min(timeoutMs, remaining);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(attemptTimeout),
      });

      if (response.ok) {
        const data = await response.json();
        data.servedByModel = model;
        return data;
      }

      const errText = await response.text().catch(() => '');
      lastError = new Error(`Gemini API HTTP ${response.status} (${model})`);
      lastError.status = response.status;
      lastError.body = errText.substring(0, 200);

      // 400/401/403/404 will not succeed on retry
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
    } catch (err) {
      if (err.status && !RETRYABLE_STATUS.has(err.status)) throw err;
      lastError = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? Object.assign(new Error(`Gemini request timed out after ${attemptTimeout}ms (${model})`), { isTimeout: true })
        : err.status ? err : Object.assign(new Error(`Gemini network error (${model}): ${err.message}`), { cause: err });
    }

    if (attempt < retries) {
      const backoff = 300 * 2 ** attempt + Math.random() * 200;
      if (Date.now() + backoff + MIN_ATTEMPT_MS > deadline) break;
      console.warn(`${tag} Attempt ${attempt + 1} failed (${lastError.message}). Retrying in ${Math.round(backoff)}ms...`);
      await sleep(backoff);
    }
  }

  throw lastError || Object.assign(new Error(`Gemini request budget exhausted (${model})`), { isTimeout: true });
};

/**
 * POST a generateContent payload to Gemini and return the parsed JSON body.
 * The returned body has `servedByModel` set to the model that answered.
 *
 * @param {object} payload - generateContent request body
 * @param {object} [options]
 * @param {string} [options.model] - primary model, defaults to GEMINI_MODEL or gemini-flash-lite-latest
 * @param {string[]} [options.fallbackModels] - defaults to GEMINI_FALLBACK_MODEL (comma-separated)
 * @param {number} [options.timeoutMs] - per-attempt timeout (GEMINI_REQUEST_TIMEOUT_MS, default 5000)
 * @param {number} [options.retries] - extra attempts per model (GEMINI_MAX_RETRIES, default 2)
 * @param {number} [options.budgetMs] - total time limit across all models and attempts
 * @param {string} [options.tag] - log prefix
 */
const callGemini = async (payload, options = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const primary = options.model || getPrimaryModel();
  const models = [primary, ...(options.fallbackModels || getFallbackModels())]
    .filter((m, i, all) => all.indexOf(m) === i);
  const timeoutMs = options.timeoutMs || getDefaultTimeoutMs();
  const retries = options.retries ?? getDefaultRetries();
  const deadline = options.budgetMs != null ? Date.now() + Math.max(0, options.budgetMs) : Infinity;
  const tag = options.tag || '[GEMINI CLIENT]';

  let lastError;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isLast = i === models.length - 1;

    // Leave time for the next model so a slow primary can't consume the whole budget
    let modelDeadline = deadline;
    if (!isLast && Number.isFinite(deadline)) {
      const remaining = deadline - Date.now();
      modelDeadline = deadline - Math.min(FALLBACK_RESERVE_MS, remaining * 0.4);
    }

    if (i > 0) {
      console.warn(`${tag} Primary model failed (${lastError?.message}). Switching to fallback model ${model}`);
    }

    try {
      return await callModel(model, payload, { apiKey, timeoutMs, retries, deadline: modelDeadline, tag });
    } catch (err) {
      lastError = err;
      // Bad request / bad key fail the same way on every model
      if (err.status && !RETRYABLE_STATUS.has(err.status) && !NEXT_MODEL_STATUS.has(err.status)) throw err;
    }
  }

  throw lastError;
};

module.exports = {
  callGemini,
  getPrimaryModel,
  GEMINI_API_URL,
};
