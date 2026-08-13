import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../../components/ScreenContainer';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getPatientDashboardApi } from '../../services/patientService';
import { PatientDashboardData } from '../../types/patient';
import { VOICE_ONBOARDING_STORAGE_KEY } from './voice-onboarding';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getPatientDashboardApi();
      if (res && res.success) {
        setDashboardData(res.data);
      }
    } catch (err: any) {
      if (err.statusCode === 404) {
        // Profile not found -> Redirect to Complete Profile
        router.replace('/(patient)/complete-profile' as any);
        return;
      }
      setErrorMsg(err.message || 'Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Navigate to Symptom Checker or Voice Onboarding
  const handleCheckSymptomsPress = async () => {
    try {
      const seen = await AsyncStorage.getItem(VOICE_ONBOARDING_STORAGE_KEY);
      if (seen === 'true') {
        router.push('/(patient)/symptom-checker' as any);
      } else {
        router.push('/(patient)/voice-onboarding' as any);
      }
    } catch (err) {
      router.push('/(patient)/symptom-checker' as any);
    }
  };

  // Quick Action Handler for future modules
  const handleFeaturePress = (featureName: string) => {
    Alert.alert(
      `${featureName}`,
      `The ${featureName} feature module will be integrated in the upcoming development phase.`
    );
  };

  if (loading) {
    return <LoadingView message="Loading your MediHeal dashboard..." />;
  }

  const patientName = user?.fullName ? user.fullName.split(' ')[0] : 'Saman';

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      {/* Top Header Navigation */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.push('/(patient)/profile' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.headerIcon}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>MediHeal</Text>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.push('/(patient)/profile' as any)}
          accessibilityRole="button"
          accessibilityLabel="View profile"
        >
          <Text style={styles.headerIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchDashboard()} />
        ) : null}

        {/* Voice Guidance Banner */}
        <TouchableOpacity
          style={styles.voiceBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/(patient)/voice-onboarding' as any)}
        >
          <Text style={styles.speakerIcon}>🔊</Text>
          <View style={styles.voiceTextCol}>
            <Text style={styles.voiceTitle}>Voice Guidance Active</Text>
            <Text style={styles.voiceSub}>Tap to open Voice Onboarding Tutorial</Text>
          </View>
        </TouchableOpacity>

        {/* Greeting */}
        <View style={styles.greetingBox}>
          <Text style={styles.greetingTitle}>Good Day, {patientName}</Text>
          <Text style={styles.greetingSub}>
            Tap a large button below or use your voice to get help.
          </Text>
        </View>

        {/* Active Emergency Alert Warning Banner (If active) */}
        {dashboardData?.activeEmergencyAlert && (
          <View style={styles.sosAlertBanner}>
            <StatusBadge status="emergency" label="ACTIVE EMERGENCY SOS" />
            <Text style={styles.sosAlertText}>
              An emergency alert triggered on{' '}
              {new Date(dashboardData.activeEmergencyAlert.createdAt).toLocaleTimeString()} is currently active.
            </Text>
          </View>
        )}

        {/* Quick Action Grid / Buttons */}
        <View style={styles.actionGrid}>
          {/* Check Symptoms */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={handleCheckSymptomsPress}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.actionIconText}>🛡️</Text>
            </View>
            <Text style={styles.actionTitle}>Check Symptoms</Text>
          </TouchableOpacity>

          {/* Doctor */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/specialists' as any)}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.actionIconText}>🩺</Text>
            </View>
            <Text style={styles.actionTitle}>Doctor</Text>
          </TouchableOpacity>

          {/* Medications */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => handleFeaturePress('Medications')}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.success }]}>
              <Text style={styles.actionIconText}>💊</Text>
            </View>
            <Text style={styles.actionTitle}>Medications</Text>
          </TouchableOpacity>

          {/* EMERGENCY SOS */}
          <TouchableOpacity
            style={[styles.actionCard, styles.sosCard]}
            activeOpacity={0.8}
            onPress={() => handleFeaturePress('Emergency SOS')}
          >
            <View style={styles.sosIconCircle}>
              <Text style={styles.sosIconText}>🚨</Text>
            </View>
            <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
          </TouchableOpacity>
        </View>

        {/* My Appointments Quick Action Banner */}
        <TouchableOpacity
          style={styles.myAppointmentsBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/(patient)/my-bookings' as any)}
        >
          <Text style={styles.appointmentsIcon}>📅</Text>
          <View style={styles.appointmentsTextCol}>
            <Text style={styles.appointmentsTitle}>My Appointments & Bookings</Text>
            <Text style={styles.appointmentsSub}>View upcoming consultations & booking status</Text>
          </View>
          <Text style={styles.appointmentsArrow}>→</Text>
        </TouchableOpacity>

        {/* Consultation History Banner */}
        <TouchableOpacity
          style={[styles.myAppointmentsBanner, { borderColor: colors.accent, marginTop: spacing.sm }]}
          activeOpacity={0.8}
          onPress={() => router.push('/(patient)/consultations' as any)}
        >
          <Text style={styles.appointmentsIcon}>📑</Text>
          <View style={styles.appointmentsTextCol}>
            <Text style={styles.appointmentsTitle}>Consultation History</Text>
            <Text style={styles.appointmentsSub}>View doctor notes, diagnoses & prescriptions</Text>
          </View>
          <Text style={styles.appointmentsArrow}>→</Text>
        </TouchableOpacity>

        {/* Next Medication Preview Card */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeaderRow}>
            <Text style={styles.previewIcon}>⏰</Text>
            <View style={styles.previewTextCol}>
              <Text style={styles.previewTitle}>Next Scheduled Medication</Text>
              {dashboardData?.medications && dashboardData.medications.length > 0 ? (
                <Text style={styles.previewSub}>
                  {dashboardData.medications[0].medicineName} — {dashboardData.medications[0].dosage}
                </Text>
              ) : (
                <Text style={styles.previewSub}>No active medications scheduled</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.header,
    color: colors.primary,
    fontWeight: '800',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerIcon: {
    fontSize: 22,
  },
  content: {
    paddingVertical: spacing.md,
  },
  voiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  speakerIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  voiceTextCol: {
    flex: 1,
  },
  voiceTitle: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
  voiceSub: {
    ...typography.caption,
    color: colors.primary,
  },
  greetingBox: {
    marginVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  greetingTitle: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
  },
  greetingSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sosAlertBanner: {
    backgroundColor: colors.dangerLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  sosAlertText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  actionGrid: {
    marginVertical: spacing.xs,
  },
  actionCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionIconText: {
    fontSize: 28,
  },
  actionTitle: {
    ...typography.subheader,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sosCard: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  sosIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sosIconText: {
    fontSize: 28,
  },
  sosTitle: {
    ...typography.header,
    color: colors.textWhite,
    fontWeight: '800',
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  previewTextCol: {
    flex: 1,
  },
  previewTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  previewSub: {
    ...typography.caption,
    marginTop: 2,
  },
  myAppointmentsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.card,
  },
  appointmentsIcon: {
    fontSize: 26,
    marginRight: spacing.md,
  },
  appointmentsTextCol: {
    flex: 1,
  },
  appointmentsTitle: {
    ...typography.bodyBold,
    color: colors.primaryDark,
    fontSize: 16,
  },
  appointmentsSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  appointmentsArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
});
