import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
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
import { getLocaleForLanguage } from '../../services/voiceService';
import { useLanguage } from '../../context/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../../utils/languageStorage';
import { useTheme } from '../../context/ThemeContext';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme, colors: themeColors } = useTheme();

  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [langModalVisible, setLangModalVisible] = useState(false);

  const currentLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const HEADER_LANGUAGE_LABELS: Record<LanguageCode, string> = {
    en: 'EN',
    si: 'සිං',
    ta: 'TA',
  };

  const handleSelectLanguage = async (code: LanguageCode) => {
    setLangModalVisible(false);
    await setLanguage(code);
  };

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

  // Real Dashboard TTS Voice Guidance (Language-Aware)
  const handleReadDashboard = () => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    const defaultPatientLabel = language === 'si' ? 'රෝගියා' : language === 'ta' ? 'நோயாளி' : 'Patient';
    const patientName = user?.fullName ? user.fullName.split(' ')[0] : defaultPatientLabel;

    let summaryParts: string[] = [
      `${t('welcomeBack')}, ${patientName}. ${t('dashboardVoiceGreeting')}`
    ];

    if (dashboardData) {
      if (dashboardData.upcomingAppointments && dashboardData.upcomingAppointments.length > 0) {
        const appt = dashboardData.upcomingAppointments[0];
        const dateStr = new Date(appt.appointmentDate).toLocaleDateString();
        const defaultConsultationLabel = language === 'si' ? 'පරීක්ෂාව' : language === 'ta' ? 'ஆலோசனை' : 'consultation';
        const reasonStr = appt.reason || defaultConsultationLabel;
        summaryParts.push(
          `${t('dashboardVoiceHasAppointment')}: ${reasonStr}, ${t('date')}: ${dateStr}.`
        );
      } else {
        summaryParts.push(t('dashboardVoiceNoAppointments'));
      }

      if (dashboardData.medications && dashboardData.medications.length > 0) {
        const med = dashboardData.medications[0];
        summaryParts.push(
          `${t('dashboardVoiceHasMedication')} ${med.medicineName}, ${t('dashboardVoiceDosage')} ${med.dosage}.`
        );
      } else {
        summaryParts.push(t('noActiveMedications'));
      }

      if (dashboardData.activeEmergencyAlert) {
        summaryParts.push(t('dashboardVoiceEmergencyActive'));
      }
    }

    summaryParts.push(t('dashboardVoiceNavHint'));

    const fullNarration = summaryParts.join(' ');

    if (__DEV__) {
      console.log(`[TTS DASHBOARD] App language: ${language}`);
      console.log(`[TTS DASHBOARD] Locale: ${getLocaleForLanguage(language)}`);
      console.log(`[TTS DASHBOARD] Narration source: localized`);
    }

    speak(fullNarration);
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
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <View style={{ flex: 1 }}>
        {/* Universal Header Navigation */}
        <View style={[styles.headerBar, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => { stopSpeech(); router.push('/(patient)/profile' as any); }}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.headerIcon, { color: themeColors.textPrimary }]}>☰</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: themeColors.primary }]} pointerEvents="none" numberOfLines={1}>
            {t('appTitle')}
          </Text>

          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              style={[styles.langBtnCompact, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => { stopSpeech(); setLangModalVisible(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Current language ${currentLangOption.name}. Tap to change language`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.langTextCompact, { color: themeColors.primary }]} numberOfLines={1}>
                {HEADER_LANGUAGE_LABELS[language] || 'EN'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => { stopSpeech(); void toggleTheme(); }}
              accessibilityRole="button"
              accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.headerIcon, { color: themeColors.textPrimary }]}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => { stopSpeech(); router.push('/(patient)/profile' as any); }}
              accessibilityRole="button"
              accessibilityLabel="View profile"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.headerIcon, { color: themeColors.textPrimary }]}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Elderly-Friendly Language Selection Modal */}
        <Modal
          visible={langModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLangModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setLangModalVisible(false)}
          >
            <Pressable
              style={[styles.modalContent, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>{t('selectLanguageTitle')}</Text>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: themeColors.background }]}
                  onPress={() => setLangModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close language selection"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.modalCloseText, { color: themeColors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalOptionsList}>
                {SUPPORTED_LANGUAGES.map((item) => {
                  const isSelected = language === item.code;
                  return (
                    <TouchableOpacity
                      key={item.code}
                      activeOpacity={0.8}
                      onPress={() => handleSelectLanguage(item.code)}
                      style={[
                        styles.langOptionCard,
                        { backgroundColor: themeColors.card, borderColor: themeColors.border },
                        isSelected && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.nativeName}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.langOptionLeft}>
                        <Text style={styles.langOptionFlag}>{item.flag}</Text>
                        <View style={styles.langOptionTextCol}>
                          <Text
                            style={[
                              styles.langOptionNative,
                              { color: themeColors.textPrimary },
                              isSelected && { color: themeColors.primaryDark },
                            ]}
                          >
                            {item.nativeName}
                          </Text>
                          <Text style={[styles.langOptionEnglish, { color: themeColors.textSecondary }]}>{item.name}</Text>
                        </View>
                      </View>
                      {isSelected ? (
                        <View style={[styles.checkBadge, { backgroundColor: themeColors.primary }]}>
                          <Text style={styles.checkBadgeText}>✓</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.content}>
          {errorMsg ? (
            <ErrorView message={errorMsg} onRetry={() => fetchDashboard()} />
          ) : null}

          {/* Voice Guidance Banner with real "Read My Dashboard" action */}
          <TouchableOpacity
            style={[
              styles.voiceBanner,
              { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
              isSpeaking && styles.voiceBannerSpeaking,
            ]}
            activeOpacity={0.8}
            onPress={handleReadDashboard}
            accessibilityRole="button"
            accessibilityLabel={isSpeaking ? t('tapToStopAudio') : t('readDashboardVoice')}
          >
            <Text style={styles.speakerIcon}>{isSpeaking ? '⏹️' : '🔊'}</Text>
            <View style={styles.voiceTextCol}>
              <Text style={[styles.voiceTitle, { color: themeColors.primaryDark }]}>
                {isSpeaking ? t('readDashboardSpeaking') : t('readDashboardVoice')}
              </Text>
              <Text style={[styles.voiceSub, { color: themeColors.primary }]}>
                {isSpeaking ? t('tapToStopAudio') : t('tapToReadDashboard')}
              </Text>
            </View>
            <View style={[styles.audioBadge, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.audioBadgeText}>{isSpeaking ? t('stop') : t('read')}</Text>
            </View>
          </TouchableOpacity>

          {/* Greeting */}
          <View style={styles.greetingBox}>
            <Text style={[styles.greetingTitle, { color: themeColors.textPrimary }]}>{t('goodDay')}, {patientName}</Text>
            <Text style={[styles.greetingSub, { color: themeColors.textSecondary }]}>
              {t('howCanWeHelpDashboard')}
            </Text>
          </View>

          {/* Active Emergency Alert Warning Banner (If active) */}
          {dashboardData?.activeEmergencyAlert && (
            <TouchableOpacity
              style={[styles.sosAlertBanner, { backgroundColor: themeColors.dangerLight, borderColor: themeColors.danger }]}
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
              <Text style={[styles.sosAlertText, { color: themeColors.danger }]}>
                {t('activeEmergencyBanner')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick Action Grid / Buttons */}
          <View style={styles.actionGrid}>
            {/* Check Symptoms */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              activeOpacity={0.8}
              onPress={handleCheckSymptomsPress}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.actionIconText}>🛡️</Text>
              </View>
              <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>{t('checkSymptoms')}</Text>
            </TouchableOpacity>

            {/* Doctor */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              activeOpacity={0.8}
              onPress={() => { stopSpeech(); router.push('/(patient)/specialists' as any); }}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.actionIconText}>🩺</Text>
              </View>
              <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>{t('doctor')}</Text>
            </TouchableOpacity>

            {/* Medications */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              activeOpacity={0.8}
              onPress={() => { stopSpeech(); router.push('/(patient)/medications' as any); }}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: themeColors.success }]}>
                <Text style={styles.actionIconText}>💊</Text>
              </View>
              <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>{t('medications')}</Text>
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
            style={[styles.myAppointmentsBanner, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            activeOpacity={0.8}
            onPress={() => { stopSpeech(); router.push('/(patient)/my-bookings' as any); }}
          >
            <Text style={styles.appointmentsIcon}>📅</Text>
            <View style={styles.appointmentsTextCol}>
              <Text style={[styles.appointmentsTitle, { color: themeColors.primary }]}>{t('myAppointmentsBookings')}</Text>
              <Text style={[styles.appointmentsSub, { color: themeColors.textSecondary }]}>{t('viewUpcomingBookings')}</Text>
            </View>
            <Text style={[styles.appointmentsArrow, { color: themeColors.primary }]}>→</Text>
          </TouchableOpacity>

          {/* Consultation History Banner */}
          <TouchableOpacity
            style={[styles.myAppointmentsBanner, { backgroundColor: themeColors.card, borderColor: themeColors.accent, marginTop: spacing.sm }]}
            activeOpacity={0.8}
            onPress={() => { stopSpeech(); router.push('/(patient)/consultations' as any); }}
          >
            <Text style={styles.appointmentsIcon}>📑</Text>
            <View style={styles.appointmentsTextCol}>
              <Text style={[styles.appointmentsTitle, { color: themeColors.primary }]}>{t('consultationHistory')}</Text>
              <Text style={[styles.appointmentsSub, { color: themeColors.textSecondary }]}>{t('viewDoctorNotes')}</Text>
            </View>
            <Text style={[styles.appointmentsArrow, { color: themeColors.primary }]}>→</Text>
          </TouchableOpacity>

          {/* Community Health Banner */}
          <TouchableOpacity
            style={[styles.myAppointmentsBanner, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginTop: spacing.sm }]}
            activeOpacity={0.8}
            onPress={() => { stopSpeech(); router.push('/(patient)/community' as any); }}
          >
            <Text style={styles.appointmentsIcon}>💬</Text>
            <View style={styles.appointmentsTextCol}>
              <Text style={[styles.appointmentsTitle, { color: themeColors.primary }]}>{t('communityHealthForum')}</Text>
              <Text style={[styles.appointmentsSub, { color: themeColors.textSecondary }]}>{t('communityForumSub')}</Text>
            </View>
            <Text style={[styles.appointmentsArrow, { color: themeColors.primary }]}>→</Text>
          </TouchableOpacity>

          {/* Next Medication Preview Card */}
          <TouchableOpacity
            style={[styles.previewCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            activeOpacity={0.8}
            onPress={() => { stopSpeech(); router.push('/(patient)/medications' as any); }}
          >
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewIcon}>⏰</Text>
              <View style={styles.previewTextCol}>
                <Text style={[styles.previewTitle, { color: themeColors.textPrimary }]}>{t('nextScheduledMedication')}</Text>
                {dashboardData?.medications && dashboardData.medications.length > 0 ? (
                  <Text style={[styles.previewSub, { color: themeColors.textSecondary }]}>
                    {dashboardData.medications[0].medicineName} — {dashboardData.medications[0].dosage} ({dashboardData.medications[0].timeSlots?.join(', ') || 'Scheduled'})
                  </Text>
                ) : (
                  <Text style={[styles.previewSub, { color: themeColors.textSecondary }]}>{t('noActiveMedications')}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
    position: 'relative',
  },
  headerTitle: {
    ...typography.header,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 19,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 0,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  langBtnCompact: {
    height: 36,
    minWidth: 42,
    maxWidth: 48,
    paddingHorizontal: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  langTextCompact: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.subheader,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalOptionsList: {
    gap: spacing.sm,
  },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 60,
  },
  langOptionCardSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  langOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  langOptionFlag: {
    fontSize: 28,
  },
  langOptionTextCol: {},
  langOptionNative: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  langOptionEnglish: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  langOptionTextSelected: {
    color: colors.primaryDark,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '800',
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
