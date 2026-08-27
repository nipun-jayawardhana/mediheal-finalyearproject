import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../../components/ScreenContainer';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getPatientDashboardApi } from '../../services/patientService';
import { PatientDashboardData } from '../../types/patient';
import { getActiveEmergencyAlert } from '../../services/emergencyService';
import { VOICE_ONBOARDING_STORAGE_KEY } from './voice-onboarding';
import { useVoice } from '../../hooks/useVoice';
import { useLanguage } from '../../context/LanguageContext';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const { isSpeaking, speak, stopSpeech } = useVoice({ language });

  const fetchDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
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
    fetchDashboard(true);
  }, [fetchDashboard]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard(false);
      void getActiveEmergencyAlert();
    }, [fetchDashboard])
  );

  // Real Dashboard TTS Voice Guidance
  const handleReadDashboard = () => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    const patientName = user?.fullName ? user.fullName.split(' ')[0] : 'Patient';
    let summaryParts: string[] = [`Welcome ${patientName}.`];

    if (dashboardData) {
      if (dashboardData.upcomingAppointments && dashboardData.upcomingAppointments.length > 0) {
        const appt = dashboardData.upcomingAppointments[0];
        summaryParts.push(
          `You have an upcoming appointment for ${appt.reason || 'consultation'} on ${new Date(appt.appointmentDate).toLocaleDateString()}.`
        );
      } else {
        summaryParts.push('You have no upcoming doctor appointments scheduled.');
      }

      if (dashboardData.medications && dashboardData.medications.length > 0) {
        const med = dashboardData.medications[0];
        summaryParts.push(
          `Your next scheduled medication is ${med.medicineName}, dosage ${med.dosage}.`
        );
      } else {
        summaryParts.push('No active medications are currently scheduled.');
      }

      if (dashboardData.activeEmergencyAlert) {
        summaryParts.push('Attention: You have an active emergency alert currently open.');
      }
    }

    summaryParts.push('Tap Check Symptoms or Doctor to navigate.');

    speak(summaryParts.join(' '));
  };

  // Navigate to Symptom Checker or Voice Onboarding
  const handleCheckSymptomsPress = async () => {
    stopSpeech();
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

  const handleEmergencySOSPress = async () => {
    stopSpeech();
    try {
      const active = await getActiveEmergencyAlert();
      if (active) {
        router.push({
          pathname: '/(patient)/emergency-active' as any,
          params: { id: active._id },
        });
      } else {
        router.push('/(patient)/emergency-countdown' as any);
      }
    } catch (e) {
      router.push('/(patient)/emergency-countdown' as any);
    }
  };

  if (loading) {
    return <LoadingView message="Loading your MediHeal dashboard..." />;
  }

  const patientName = user?.fullName ? user.fullName.split(' ')[0] : 'Patient';

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      {/* Top Header Navigation */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => { stopSpeech(); router.push('/(patient)/profile' as any); }}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.headerIcon}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('appTitle')}</Text>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => { stopSpeech(); router.push('/(patient)/profile' as any); }}
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

        {/* Voice Guidance Banner with real "Read My Dashboard" action */}
        <TouchableOpacity
          style={[styles.voiceBanner, isSpeaking && styles.voiceBannerSpeaking]}
          activeOpacity={0.8}
          onPress={handleReadDashboard}
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? t('tapToStopAudio') : t('readDashboardVoice')}
        >
          <Text style={styles.speakerIcon}>{isSpeaking ? '⏹️' : '🔊'}</Text>
          <View style={styles.voiceTextCol}>
            <Text style={styles.voiceTitle}>
              {isSpeaking ? t('readDashboardSpeaking') : t('readDashboardVoice')}
            </Text>
            <Text style={styles.voiceSub}>
              {isSpeaking ? t('tapToStopAudio') : t('tapToReadDashboard')}
            </Text>
          </View>
          <View style={styles.audioBadge}>
            <Text style={styles.audioBadgeText}>{isSpeaking ? t('stop') : t('read')}</Text>
          </View>
        </TouchableOpacity>

        {/* Greeting */}
        <View style={styles.greetingBox}>
          <Text style={styles.greetingTitle}>{t('goodDay')}, {patientName}</Text>
          <Text style={styles.greetingSub}>
            {t('howCanWeHelpDashboard')}
          </Text>
        </View>

        {/* Active Emergency Alert Warning Banner (If active) */}
        {dashboardData?.activeEmergencyAlert && (
          <TouchableOpacity
            style={styles.sosAlertBanner}
            activeOpacity={0.8}
            onPress={() => {
              stopSpeech();
              router.push({
                pathname: '/(patient)/emergency-active' as any,
                params: { id: dashboardData.activeEmergencyAlert?._id },
              });
            }}
          >
            <StatusBadge status="emergency" label={t('emergencySos')} />
            <Text style={styles.sosAlertText}>
              {t('activeEmergencyBanner')}
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.actionTitle}>{t('checkSymptoms')}</Text>
          </TouchableOpacity>

          {/* Doctor */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => { stopSpeech(); router.push('/(patient)/specialists' as any); }}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.actionIconText}>🩺</Text>
            </View>
            <Text style={styles.actionTitle}>{t('doctor')}</Text>
          </TouchableOpacity>

          {/* Medications */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => { stopSpeech(); router.push('/(patient)/medications' as any); }}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.success }]}>
              <Text style={styles.actionIconText}>💊</Text>
            </View>
            <Text style={styles.actionTitle}>{t('medications')}</Text>
          </TouchableOpacity>

          {/* EMERGENCY SOS */}
          <TouchableOpacity
            style={[styles.actionCard, styles.sosCard]}
            activeOpacity={0.8}
            onPress={handleEmergencySOSPress}
          >
            <View style={styles.sosIconCircle}>
              <Text style={styles.sosIconText}>🚨</Text>
            </View>
            <Text style={styles.sosTitle}>{t('emergencySos')}</Text>
          </TouchableOpacity>
        </View>

        {/* My Appointments Quick Action Banner */}
        <TouchableOpacity
          style={styles.myAppointmentsBanner}
          activeOpacity={0.8}
          onPress={() => { stopSpeech(); router.push('/(patient)/my-bookings' as any); }}
        >
          <Text style={styles.appointmentsIcon}>📅</Text>
          <View style={styles.appointmentsTextCol}>
            <Text style={styles.appointmentsTitle}>{t('myAppointmentsBookings')}</Text>
            <Text style={styles.appointmentsSub}>{t('viewUpcomingBookings')}</Text>
          </View>
          <Text style={styles.appointmentsArrow}>→</Text>
        </TouchableOpacity>

        {/* Consultation History Banner */}
        <TouchableOpacity
          style={[styles.myAppointmentsBanner, { borderColor: colors.accent, marginTop: spacing.sm }]}
          activeOpacity={0.8}
          onPress={() => { stopSpeech(); router.push('/(patient)/consultations' as any); }}
        >
          <Text style={styles.appointmentsIcon}>📑</Text>
          <View style={styles.appointmentsTextCol}>
            <Text style={styles.appointmentsTitle}>{t('consultationHistory')}</Text>
            <Text style={styles.appointmentsSub}>{t('viewDoctorNotes')}</Text>
          </View>
          <Text style={styles.appointmentsArrow}>→</Text>
        </TouchableOpacity>

        {/* Community Health Banner */}
        <TouchableOpacity
          style={[styles.myAppointmentsBanner, { borderColor: colors.primary, marginTop: spacing.sm }]}
          activeOpacity={0.8}
          onPress={() => { stopSpeech(); router.push('/(patient)/community' as any); }}
        >
          <Text style={styles.appointmentsIcon}>💬</Text>
          <View style={styles.appointmentsTextCol}>
            <Text style={styles.appointmentsTitle}>{t('communityHealthForum')}</Text>
            <Text style={styles.appointmentsSub}>{t('communityForumSub')}</Text>
          </View>
          <Text style={styles.appointmentsArrow}>→</Text>
        </TouchableOpacity>

        {/* Next Medication Preview Card */}
        <TouchableOpacity
          style={styles.previewCard}
          activeOpacity={0.8}
          onPress={() => { stopSpeech(); router.push('/(patient)/medications' as any); }}
        >
          <View style={styles.previewHeaderRow}>
            <Text style={styles.previewIcon}>⏰</Text>
            <View style={styles.previewTextCol}>
              <Text style={styles.previewTitle}>{t('nextScheduledMedication')}</Text>
              {dashboardData?.medications && dashboardData.medications.length > 0 ? (
                <Text style={styles.previewSub}>
                  {dashboardData.medications[0].medicineName} — {dashboardData.medications[0].dosage} ({dashboardData.medications[0].timeSlots?.join(', ') || 'Scheduled'})
                </Text>
              ) : (
                <Text style={styles.previewSub}>{t('noActiveMedications')}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
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
  voiceBannerSpeaking: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
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
  audioBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  audioBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
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
