import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingView } from '../../components/LoadingView';
import { useTheme } from '../../context/ThemeContext';

export default function CaregiverLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/(auth)/login');
      } else if (user.role !== 'caregiver') {
        // Role Protection: Redirect non-caregivers to their role layout
        switch (user.role) {
          case 'patient':
            router.replace('/(patient)');
            break;
          case 'doctor':
            router.replace('/(doctor)');
            break;
          case 'admin':
            router.replace('/(admin)');
            break;
          default:
            router.replace('/(auth)/login');
        }
      }
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== 'caregiver') {
    return <LoadingView message="Verifying caregiver session..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="link-patient" options={{ headerShown: false }} />
      <Stack.Screen name="patient-overview" options={{ headerShown: false }} />
      <Stack.Screen name="medications" options={{ headerShown: false }} />
      <Stack.Screen name="medication-add" options={{ headerShown: false }} />
      <Stack.Screen name="medication-edit" options={{ headerShown: false }} />
      <Stack.Screen name="alerts" options={{ headerShown: false }} />
      <Stack.Screen name="community" options={{ headerShown: false }} />
    </Stack>
  );
}
