/**
 * Gemini Client
 *
 * Shared REST caller for all Gemini services.
 * - Short per-attempt timeout so a stalled request is abandoned quickly
 * - Retries only transient failures (timeout, network error, 429, 5xx) with jittered backoff
 * - Optional total budget so retries never exceed the caller's overall time limit
 *
 * Throws an Error (with `.status` for HTTP failures) when all attempts fail.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MIN_ATTEMPT_MS = 1500;

const getDefaultTimeoutMs = () => Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 5000;
const getDefaultRetries = () => {
  const n = Number(process.env.GEMINI_MAX_RETRIES);
  return Number.isInteger(n) && n >= 0 ? n : 2;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST a generateContent payload to Gemini and return the parsed JSON body.
 *
 * @param {object} payload - generateContent request body
 * @param {object} [options]
 * @param {string} [options.model] - defaults to GEMINI_MODEL or gemini-flash-lite-latest
 * @param {number} [options.timeoutMs] - per-attempt timeout (GEMINI_REQUEST_TIMEOUT_MS, default 5000)
 * @param {number} [options.retries] - extra attempts after the first (GEMINI_MAX_RETRIES, default 2)
 * @param {number} [options.budgetMs] - total time limit across all attempts
 * @param {string} [options.tag] - log prefix
 */
const callGemini = async (payload, options = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = options.model || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const timeoutMs = options.timeoutMs || getDefaultTimeoutMs();
  const retries = options.retries ?? getDefaultRetries();
  const deadline = options.budgetMs ? Date.now() + options.budgetMs : Infinity;
  const tag = options.tag || '[GEMINI CLIENT]';
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
        return await response.json();
      }

      const errText = await response.text().catch(() => '');
      lastError = new Error(`Gemini API HTTP ${response.status}`);
      lastError.status = response.status;
      lastError.body = errText.substring(0, 200);

      // 400/401/403/404 will not succeed on retry
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
    } catch (err) {
      if (err.status && !RETRYABLE_STATUS.has(err.status)) throw err;
      lastError = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? Object.assign(new Error(`Gemini request timed out after ${attemptTimeout}ms`), { isTimeout: true })
        : err.status ? err : Object.assign(new Error(`Gemini network error: ${err.message}`), { cause: err });
    }

    if (attempt < retries) {
      const backoff = 300 * 2 ** attempt + Math.random() * 200;
      if (Date.now() + backoff + MIN_ATTEMPT_MS > deadline) break;
      console.warn(`${tag} Attempt ${attempt + 1} failed (${lastError.message}). Retrying in ${Math.round(backoff)}ms...`);
      await sleep(backoff);
    }
  }

  throw lastError || new Error('Gemini request budget exhausted');
};

module.exports = {
  callGemini,
  GEMINI_API_URL,
};
