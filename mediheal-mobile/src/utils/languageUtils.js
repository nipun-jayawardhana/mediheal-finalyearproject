/**
 * Formats condition and specialist text for patient-facing display based on selected app language.
 * Strips parenthetical English text for Sinhala/Tamil and extracts pure English for English mode.
 * Applies Unicode NFC normalization.
 */
const formatConditionForDisplay = (rawText, targetLanguage) => {
  if (!rawText || typeof rawText !== 'string') return '';

  let cleaned = rawText.trim();

  if (targetLanguage === 'si' || targetLanguage === 'ta') {
    // Strip trailing parenthetical English text e.g. "මුත්රා මාර්ග ආසාදනය (Urinary Tract Infection)" -> "මුත්රා මාර්ග ආසාදනය"
    cleaned = cleaned.replace(/\s*\([\w\s\-\/]+\)$/i, '').trim();
  } else if (targetLanguage === 'en') {
    // If English selected, extract English inside parentheses if present e.g. "මයිග්‍රේන් (Migraine)" -> "Migraine"
    const matchParen = cleaned.match(/\(([\w\s\-\/]+)\)$/i);
    if (matchParen && matchParen[1]) {
      cleaned = matchParen[1].trim();
    } else {
      const asciiOnly = cleaned.replace(/[^\x00-\x7F]+/g, '').trim();
      if (asciiOnly.length > 2) {
        cleaned = asciiOnly;
      }
    }
  }

  // Unicode NFC normalization
  try {
    cleaned = cleaned.normalize('NFC');
  } catch (e) {
    // Fallback
  }

  return cleaned;
};

module.exports = {
  formatConditionForDisplay,
};
