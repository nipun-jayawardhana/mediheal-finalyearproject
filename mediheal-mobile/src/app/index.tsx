import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SplashScreen } from '../components/SplashScreen';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function AppStartupScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isLoadingLanguage } = useLanguage();
  const { isLoadingTheme } = useTheme();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Minimum splash display duration for smooth elderly-friendly presentation
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  // Automatic session, theme & language aware routing after startup initialization completes
  useEffect(() => {
    const isReady = !isLoading && !isLoadingLanguage && !isLoadingTheme && minTimeElapsed;

    if (isReady) {
      if (isAuthenticated && user) {
        switch (user.role) {
          case 'patient':
            router.replace('/(patient)');
            break;
          case 'caregiver':
            router.replace('/(caregiver)');
            break;
          case 'doctor':
            router.replace('/(doctor)');
            break;
          case 'admin':
            router.replace('/(admin)');
            break;
          default:
            router.replace('/(patient)');
            break;
        }
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, isLoadingLanguage, isLoadingTheme, minTimeElapsed, isAuthenticated, user, router]);

  return <SplashScreen />;
}

