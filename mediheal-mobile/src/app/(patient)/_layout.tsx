import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingView } from '../../components/LoadingView';

export default function PatientLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/(auth)/login');
      } else if (user.role !== 'patient') {
        // Role Protection: Redirect non-patients to their role layout
        switch (user.role) {
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
            router.replace('/(auth)/login');
        }
      }
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== 'patient') {
    return <LoadingView message="Verifying patient session..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="voice-onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="symptom-checker" options={{ headerShown: false }} />
      <Stack.Screen name="analysis-result" options={{ headerShown: false }} />
      <Stack.Screen name="specialists" options={{ headerShown: false }} />
      <Stack.Screen name="doctor-details" options={{ headerShown: false }} />
      <Stack.Screen name="booking-confirmation" options={{ headerShown: false }} />
      <Stack.Screen name="my-bookings" options={{ headerShown: false }} />
      <Stack.Screen name="consultations" options={{ headerShown: false }} />
      <Stack.Screen name="consultation-summary" options={{ headerShown: false }} />
      <Stack.Screen name="medications" options={{ headerShown: false }} />
    </Stack>
  );
}
