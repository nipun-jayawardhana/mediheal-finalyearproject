import AsyncStorage from '@react-native-async-storage/async-storage';

export type LanguageCode = 'en' | 'si' | 'ta';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇱🇰' },
];

const LANGUAGE_STORAGE_KEY = '@mediheal_language';

/**
 * Retrieves stored language preference from AsyncStorage.
 * Defaults to 'en' (English) if no preference is stored.
 */
export const getStoredLanguage = async (): Promise<LanguageCode> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (stored === 'en' || stored === 'si' || stored === 'ta')) {
      return stored as LanguageCode;
    }
  } catch (error) {
    console.error('Failed to load language preference:', error);
  }
  return 'en';
};

/**
 * Stores language preference in AsyncStorage.
 */
export const setStoredLanguage = async (language: LanguageCode): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.error('Failed to save language preference:', error);
    throw error;
  }
};

/**
 * Resolves active language code based on precedence:
 * 1. user profile preferredLanguage ("Sinhala" -> 'si', "Tamil" -> 'ta', "English" -> 'en')
 * 2. stored AsyncStorage language selection
 * 3. default 'en'
 */
export const resolveActiveLanguage = (
  userProfileLang?: string,
  storedLang?: LanguageCode
): LanguageCode => {
  if (userProfileLang) {
    const clean = userProfileLang.toLowerCase().trim();
    if (clean === 'sinhala' || clean === 'si') return 'si';
    if (clean === 'tamil' || clean === 'ta') return 'ta';
    if (clean === 'english' || clean === 'en') return 'en';
  }
  if (storedLang && (storedLang === 'en' || storedLang === 'si' || storedLang === 'ta')) {
    return storedLang;
  }
  return 'en';
};

