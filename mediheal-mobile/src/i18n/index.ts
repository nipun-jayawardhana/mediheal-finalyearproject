import { en, TranslationKeys } from './en';
import { si } from './si';
import { ta } from './ta';
import { LanguageCode } from '../utils/languageStorage';

const translations: Record<LanguageCode, Record<TranslationKeys, string>> = {
  en,
  si,
  ta,
};

/**
 * Returns localized string for a given key and language code.
 * Defaults to English ('en') if translation is missing.
 */
export const t = (key: TranslationKeys, lang: LanguageCode = 'en'): string => {
  const activeLang = lang === 'si' || lang === 'ta' ? lang : 'en';
  const val = translations[activeLang]?.[key];
  if (!val) {
    if (__DEV__) {
      console.warn(`[I18N] Missing ${activeLang} translation for key: ${key}`);
    }
    return translations.en[key] || String(key);
  }
  return val;
};

export { TranslationKeys };
