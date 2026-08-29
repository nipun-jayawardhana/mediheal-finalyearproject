import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function RootStackContent() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="language" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register-patient" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register-caregiver" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register-success" options={{ headerShown: false }} />
        <Stack.Screen name="(patient)" options={{ headerShown: false }} />
        <Stack.Screen name="(caregiver)" options={{ headerShown: false }} />
        <Stack.Screen name="(doctor)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <RootStackContent />
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
