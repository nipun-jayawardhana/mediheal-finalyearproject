const { synthesizeSpeech } = require('../services/voiceTtsService');

/**
 * Controller to handle POST /api/voice/tts
 * Synthesizes cloud TTS speech for requested text and language (Sinhala, Tamil, or English).
 */
const generateTtsAudio = async (req, res, next) => {
  try {
    const { text, language, locale } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Text parameter is required for TTS synthesis.',
      });
    }

    // Resolve language tag
    let resolvedLang = (language || '').toLowerCase().trim();
    if (!resolvedLang && locale) {
      if (locale.toLowerCase().startsWith('si')) resolvedLang = 'si';
      else if (locale.toLowerCase().startsWith('ta')) resolvedLang = 'ta';
      else resolvedLang = 'en';
    }

    if (!['si', 'ta', 'en'].includes(resolvedLang)) {
      resolvedLang = 'en';
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[TTS CONTROLLER] Generating TTS audio. Language: ${resolvedLang}, Text preview: "${text.slice(0, 40)}..."`);
    }

    const audioBase64 = await synthesizeSpeech(text.trim(), resolvedLang);

    return res.status(200).json({
      success: true,
      audioBase64,
      language: resolvedLang,
    });
  } catch (error) {
    console.error('[TTS CONTROLLER] Error generating TTS audio:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to synthesize TTS audio speech.',
    });
  }
};

module.exports = {
  generateTtsAudio,
};
