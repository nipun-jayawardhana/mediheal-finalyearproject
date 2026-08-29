import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppointmentCard } from '../../components/AppointmentCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, typography } from '../../constants/theme';
import { getMyAppointments, cancelAppointment } from '../../services/appointmentService';
import { getMyConsultations } from '../../services/consultationService';
import { Appointment } from '../../types/appointment';
import { Consultation } from '../../types/consultation';

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

export default function MyBookingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultationMap, setConsultationMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // Fetch both appointments and consultations in parallel
      const [apptsRes, consultsRes] = await Promise.all([
        getMyAppointments(),
        getMyConsultations().catch(() => null), // Fail-safe if no consultations exist
      ]);

      if (apptsRes && apptsRes.success) {
        setAppointments(apptsRes.data || []);
      } else {
        setErrorMsg('Failed to retrieve your appointments.');
      }

      // Build map of appointmentId._id -> consultation._id
      if (consultsRes && consultsRes.success && Array.isArray(consultsRes.data)) {
        const map: Record<string, string> = {};
        consultsRes.data.forEach((c: Consultation) => {
          const apptId = typeof c.appointmentId === 'object' ? c.appointmentId?._id : c.appointmentId;
          if (apptId) {
            map[apptId] = c._id;
          }
        });
        setConsultationMap(map);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh appointments whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleCancelPress = (appointment: Appointment) => {
    const doctorNameRaw = appointment.doctorId?.fullName || 'Doctor';
    const doctorName = doctorNameRaw.toLowerCase().startsWith('dr.')
      ? doctorNameRaw
      : `Dr. ${doctorNameRaw}`;

    Alert.alert(
      t('cancelAppointmentConfirm'),
      `Are you sure you want to cancel your appointment with ${doctorName} on ${appointment.timeSlot}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('yesCancel'),
          style: 'destructive',
          onPress: () => performCancellation(appointment._id),
        },
      ]
    );
  };

  const performCancellation = async (appointmentId: string) => {
    setCancellingId(appointmentId);
    try {
      const res = await cancelAppointment(appointmentId, 'Cancelled by patient via mobile app');
      if (res && res.success) {
        Alert.alert(t('cancelAppointment'), 'Your appointment has been cancelled successfully.');
        setAppointments((prev) =>
          prev.map((app) =>
            app._id === appointmentId
              ? { ...app, status: 'cancelled', cancellationReason: 'Cancelled by patient' }
              : app
          )
        );
      } else {
        Alert.alert('Cancellation Error', res.message || 'Failed to cancel appointment.');
      }
    } catch (err: any) {
      Alert.alert('Cancellation Error', err.message || 'Unable to process cancellation.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleViewSummary = (appointment: Appointment) => {
    const consultationId = consultationMap[appointment._id];
    if (consultationId) {
      router.push({
        pathname: '/(patient)/consultation-summary' as any,
        params: { id: consultationId },
      });
    } else {
      Alert.alert(
        t('consultationSummary'),
        'No detailed consultation notes have been recorded for this appointment yet.'
      );
    }
  };

  // Group appointments into sections
  const upcomingAppointments = appointments.filter(
    (app) => app.status === 'pending' || app.status === 'confirmed'
  );
  const completedAppointments = appointments.filter((app) => app.status === 'completed');
  const cancelledAppointments = appointments.filter((app) => app.status === 'cancelled');

  if (loading && appointments.length === 0) {
    return <LoadingView message="Loading your appointments..." />;
  }

  const isEmpty = appointments.length === 0;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('myBookingsTitle')}
        subtitle={t('manageAppointments')}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchData} />
        ) : null}

        {!errorMsg && isEmpty && (
          <EmptyState
            icon="📅"
            title={t('noBookingsFound')}
            description={t('noBookingsDesc')}
            actionText={t('findDoctor')}
            onAction={() => router.push('/(patient)/specialists' as any)}
          />
        )}

        {!errorMsg && !isEmpty && (
          <FlatList
            data={[{ key: 'content' }]}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <View style={styles.listSection}>
                {/* Upcoming Appointments Section */}
                {upcomingAppointments.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      {t('upcoming')} ({upcomingAppointments.length})
                    </Text>
                    {upcomingAppointments.map((app) => (
                      <AppointmentCard
                        key={app._id}
                        appointment={app}
                        onCancel={handleCancelPress}
                        cancellingId={cancellingId}
                      />
                    ))}
                  </View>
                )}

                {/* Completed Appointments Section */}
                {completedAppointments.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      {t('completed')} ({completedAppointments.length})
                    </Text>
                    {completedAppointments.map((app) => (
                      <AppointmentCard
                        key={app._id}
                        appointment={app}
                        onViewSummary={handleViewSummary}
                      />
                    ))}
                  </View>
                )}

                {/* Cancelled Appointments Section */}
                {cancelledAppointments.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      {t('cancelled')} ({cancelledAppointments.length})
                    </Text>
                    {cancelledAppointments.map((app) => (
                      <AppointmentCard key={app._id} appointment={app} />
                    ))}
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  listSection: {
    paddingBottom: spacing.xl,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
