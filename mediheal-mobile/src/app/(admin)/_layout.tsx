import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingView } from '../../components/LoadingView';
import { useTheme } from '../../context/ThemeContext';

export default function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/(auth)/login');
      } else if (user.role !== 'admin') {
        // Role Protection: Redirect non-admins to their role layout
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
          default:
            router.replace('/(auth)/login');
        }
      }
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return <LoadingView message="Verifying administrator session..." />;
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
      <Stack.Screen name="doctors" options={{ headerShown: false }} />
      <Stack.Screen name="doctor-add" options={{ headerShown: false }} />
      <Stack.Screen name="doctor-edit" options={{ headerShown: false }} />
    </Stack>
  );
}
