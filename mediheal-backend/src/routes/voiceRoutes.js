const express = require('express');
const router = express.Router();
const { generateTtsAudio } = require('../controllers/voiceController');

/**
 * @route   POST /api/voice/tts
 * @desc    Synthesize speech audio for localized patient text (Sinhala, Tamil, English)
 * @access  Public
 */
router.post('/tts', generateTtsAudio);

module.exports = router;
