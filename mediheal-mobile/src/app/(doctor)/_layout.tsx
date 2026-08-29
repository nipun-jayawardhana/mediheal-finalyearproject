import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingView } from '../../components/LoadingView';
import { useTheme } from '../../context/ThemeContext';

export default function DoctorLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/(auth)/login');
      } else if (user.role !== 'doctor') {
        // Role Protection: Redirect non-doctors to their role layout
        switch (user.role) {
          case 'patient':
            router.replace('/(patient)');
            break;
          case 'caregiver':
            router.replace('/(caregiver)');
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

  if (isLoading || !isAuthenticated || user?.role !== 'doctor') {
    return <LoadingView message="Verifying doctor session..." />;
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
      <Stack.Screen name="appointments" options={{ headerShown: false }} />
      <Stack.Screen name="active-consultation" options={{ headerShown: false }} />
      <Stack.Screen name="patient-history" options={{ headerShown: false }} />
    </Stack>
  );
}
