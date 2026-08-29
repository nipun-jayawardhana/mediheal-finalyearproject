import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ThemeColors, lightColors, darkColors } from '../constants/theme';

const THEME_STORAGE_KEY = 'mediheal_theme_mode';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  isLoadingTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'light',
  isDark: false,
  colors: lightColors,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
  isLoadingTheme: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeState] = useState<ThemeMode>('light');
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);

  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          setThemeState(stored);
        }
      } catch (err) {
        console.warn('Failed to load theme preference:', err);
      } finally {
        setIsLoadingTheme(false);
      }
    }
    loadStoredTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to save theme preference:', err);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode = themeMode === 'light' ? 'dark' : 'light';
    await setThemeMode(nextMode);
  }, [themeMode, setThemeMode]);

  const isDark = themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        setThemeMode,
        toggleTheme,
        isLoadingTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
