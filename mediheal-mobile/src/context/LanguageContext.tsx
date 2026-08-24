import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  LanguageCode,
  getStoredLanguage,
  setStoredLanguage as saveLanguageToStorage,
  resolveActiveLanguage,
} from '../utils/languageStorage';
import { t as translateHelper, TranslationKeys } from '../i18n';
import { useAuth } from './AuthContext';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: (key: TranslationKeys) => string;
  isLoadingLanguage: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [isLoadingLanguage, setIsLoadingLanguage] = useState<boolean>(true);

  // Initialize language preference from AsyncStorage or User Profile
  const initLanguage = useCallback(async () => {
    try {
      const stored = await getStoredLanguage();
      const resolved = resolveActiveLanguage(user?.preferredLanguage, stored);
      setLanguageState(resolved);
    } catch (err) {
      console.error('Failed to initialize LanguageContext:', err);
    } finally {
      setIsLoadingLanguage(false);
    }
  }, [user?.preferredLanguage]);

  useEffect(() => {
    initLanguage();
  }, [initLanguage]);

  // Handler to update selected language across app dynamically
  const setLanguage = async (code: LanguageCode): Promise<void> => {
    try {
      setLanguageState(code);
      await saveLanguageToStorage(code);
    } catch (err) {
      console.error('Failed to save language choice:', err);
    }
  };

  // Bound translation helper
  const t = useCallback(
    (key: TranslationKeys): string => {
      return translateHelper(key, language);
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isLoadingLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
