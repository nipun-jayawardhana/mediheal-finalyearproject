const https = require('https');

/**
 * Fetches a single audio chunk buffer from Google Translate TTS API.
 */
function fetchAudioChunk(text, lang) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Google TTS returned HTTP status ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Google TTS request timeout'));
    });
  });
}

/**
 * Splits text on sentence or clause punctuation boundaries into chunks under maxLen.
 * Preserves Sinhala and Tamil Unicode text structure.
 */
function splitTextIntoChunks(text, maxLen = 170) {
  if (!text || text.length <= maxLen) return [text];

  const sentences = text.split(/(?<=[.!?\u0964\u0965])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length <= maxLen) {
      current = current ? `${current} ${sentence}` : sentence;
    } else {
      if (current) chunks.push(current);

      if (sentence.length > maxLen) {
        // Sub-split by commas or clause markers
        const subParts = sentence.split(/(?<=[,،;])\s+/);
        let subCurrent = '';
        for (const sub of subParts) {
          if ((subCurrent + ' ' + sub).length <= maxLen) {
            subCurrent = subCurrent ? `${subCurrent} ${sub}` : sub;
          } else {
            if (subCurrent) chunks.push(subCurrent);
            subCurrent = sub;
          }
        }
        if (subCurrent) chunks.push(subCurrent);
        current = '';
      } else {
        current = sentence;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((c) => c && c.trim().length > 0);
}

/**
 * Synthesizes full speech audio from input text for a given language ('en', 'si', 'ta').
 * Returns a Data URI string suitable for direct playback in web/mobile audio players.
 */
async function synthesizeSpeech(text, lang = 'si') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text parameter is required for speech synthesis.');
  }

  const cleanLang = (lang || 'en').toLowerCase().trim();
  const validLang = ['si', 'ta', 'en'].includes(cleanLang) ? cleanLang : 'en';

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[TTS SERVICE] Synthesizing speech for lang=${validLang}, textLength=${text.length}`);
  }

  const chunks = splitTextIntoChunks(text.trim());
  const audioBuffers = [];

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const buf = await fetchAudioChunk(chunk.trim(), validLang);
    audioBuffers.push(buf);
  }

  const concatenatedBuffer = Buffer.concat(audioBuffers);
  const base64Audio = concatenatedBuffer.toString('base64');

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[TTS SERVICE] Successfully synthesized ${concatenatedBuffer.length} bytes of audio.`);
  }

  return `data:audio/mp3;base64,${base64Audio}`;
}

module.exports = {
  synthesizeSpeech,
  splitTextIntoChunks,
};
