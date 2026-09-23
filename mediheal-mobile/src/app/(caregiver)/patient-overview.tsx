import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getPatientDetailsForCaregiver,
  removeCaregiverLink,
} from '../../services/caregiverService';
import { getCaregiverPatientTodayMedications } from '../../services/medicationReminderService';
import { getCaregiverPatientMedicationAnalytics } from '../../services/medicationAnalyticsService';
import { CaregiverPatientOverview } from '../../types/caregiver';
import { CaregiverPatientTodayMedicationTask } from '../../types/medicationReminder';
import { MedicationAnalyticsResponse } from '../../types/medicationAnalytics';

export default function PatientOverviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { isDark, colors: themeColors } = useTheme();
  const { t } = useLanguage();

  const [overview, setOverview] = useState<CaregiverPatientOverview | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<CaregiverPatientTodayMedicationTask[]>([]);
  const [phase6Analytics, setPhase6Analytics] = useState<MedicationAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unlinking, setUnlinking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchOverview = useCallback(async () => {
    if (!params.id) {
      setErrorMsg(t('patientIdMissing'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const [res, todayRes, analyticsRes] = await Promise.all([
        getPatientDetailsForCaregiver(params.id),
        getCaregiverPatientTodayMedications(params.id).catch(() => ({ success: false, data: [] })),
        getCaregiverPatientMedicationAnalytics(params.id, '30d').catch(() => null),
      ]);
      if (res && res.success && res.data) {
        setOverview(res.data);
      } else {
        setErrorMsg(t('failedToLoadPatientOverview'));
      }
      if (todayRes && todayRes.success && todayRes.data) {
        setTodaySchedules(todayRes.data);
      }
      if (analyticsRes && analyticsRes.success) {
        setPhase6Analytics(analyticsRes);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('failedToLoadPatientOverview'));
    } finally {
      setLoading(false);
    }
  }, [params.id, t]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleUnlink = () => {
    if (!params.id || !overview) return;

    Alert.alert(
      t('removePatientLinkTitle'),
      t('removePatientLinkConfirm').replace('{name}', overview.patient.fullName),
      [
        { text: t('keepLink'), style: 'cancel' },
        {
          text: t('removeLink'),
          style: 'destructive',
          onPress: performUnlink,
        },
      ]
    );
  };

  const performUnlink = async () => {
    if (!params.id) return;
    setUnlinking(true);

    try {
      const res = await removeCaregiverLink(params.id);
      if (res && res.success) {
        Alert.alert(t('linkRemovedTitle'), t('linkRemovedSuccess'));
        router.replace('/(caregiver)' as any);
      } else {
        Alert.alert('Error', res.message || 'Failed to remove link.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to remove patient link.');
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return <LoadingView message={t('loadingPatientOverview')} />;
  }

  if (errorMsg || !overview) {
    return (
      <ScreenContainer backgroundColor={themeColors.background}>
        <AppHeader title={t('patientOverviewTitle')} onBackPress={() => router.back()} />
        <ErrorView message={errorMsg || t('patientDetailsUnavailable')} onRetry={fetchOverview} />
      </ScreenContainer>
    );
  }

  const { patient, patientProfile, adherenceSummary } = overview;
  const patientInitials =
    patient.fullName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'PT';

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('patientOverviewTitle')}
        subtitle={overview.relationship ? `${t('relationship')}: ${overview.relationship}` : undefined}
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Patient Hero Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: themeColors.primaryLight,
                borderColor: themeColors.primary,
              },
            ]}
          >
            <Text style={[styles.avatarText, { color: themeColors.primary }]}>{patientInitials}</Text>
          </View>
          <Text style={[styles.patientName, { color: themeColors.textPrimary }]}>{patient.fullName}</Text>
          <Text style={[styles.patientSub, { color: themeColors.textSecondary }]}>
            {patientProfile?.gender ? `${patientProfile.gender.toLowerCase() === 'male' ? t('male').toUpperCase() : patientProfile.gender.toLowerCase() === 'female' ? t('female').toUpperCase() : t('other').toUpperCase()} • ` : ''}
            {patientProfile?.bloodGroup ? `${t('blood')}: ${patientProfile.bloodGroup}` : ''}
          </Text>

          {patientProfile?.address ? (
            <Text style={[styles.addressText, { color: themeColors.textMuted }]}>📍 {patientProfile.address}</Text>
          ) : null}

          {/* Emergency Contact */}
          {patientProfile?.emergencyContactName ? (
            <View
              style={[
                styles.contactBox,
                {
                  backgroundColor: themeColors.surfaceSecondary,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text style={[styles.contactTitle, { color: themeColors.textMuted }]}>{t('emergencyContact')}:</Text>
              <Text style={[styles.contactDetail, { color: themeColors.textPrimary }]}>
                👤 {patientProfile.emergencyContactName} ({patientProfile.emergencyContactPhone || 'N/A'})
              </Text>
            </View>
          ) : null}
        </View>

        {/* Adherence Summary Card (Phase 6) */}
        <TouchableOpacity
          style={[styles.adherenceCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
          activeOpacity={0.8}
          onPress={() => {
            router.push({
              pathname: '/(caregiver)/medication-analytics' as any,
              params: { patientId: patient._id, patientName: patient.fullName },
            });
          }}
        >
          <View style={styles.adherenceHeaderRow}>
            <View style={styles.adherenceTextCol}>
              <Text style={[styles.adherenceTitle, { color: themeColors.textMuted }]}>{t('medicationAnalytics')}</Text>
              <Text style={[styles.adherenceSubtitle, { color: themeColors.textSecondary }]}>{t('last30Days')}</Text>
              {phase6Analytics?.summary?.hasEnoughData && phase6Analytics.summary.adherencePercentage !== null ? (
                <Text style={[styles.adherenceVal, { color: phase6Analytics.summary.adherencePercentage >= 80 ? themeColors.success : themeColors.warning }]}>
                  {phase6Analytics.summary.adherencePercentage}% {t('adherenceRate')}
                </Text>
              ) : (
                <Text style={[styles.adherenceVal, { color: themeColors.textSecondary, fontSize: 14 }]}>
                  {t('notEnoughAdherenceData')}
                </Text>
              )}
            </View>
            <View style={[styles.viewAnalyticsBtn, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.viewAnalyticsBtnText}>{t('viewAnalytics')}</Text>
            </View>
          </View>

          {phase6Analytics?.summary && (
            <View style={styles.adherenceStatsRow}>
              <View style={[styles.statPill, { backgroundColor: themeColors.successLight }]}>
                <Text style={[styles.statVal, { color: themeColors.success }]}>{phase6Analytics.summary.totalTaken}</Text>
                <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>✓ {t('taken')}</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                <Text style={[styles.statVal, { color: colors.danger }]}>{phase6Analytics.summary.totalMissed}</Text>
                <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>⚠ {t('missed')}</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: isDark ? 'rgba(234, 179, 8, 0.2)' : '#FEF9C3' }]}>
                <Text style={[styles.statVal, { color: '#D97706' }]}>{phase6Analytics.summary.totalPending}</Text>
                <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>⏳ {t('pending')}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Today's Prescribed Medication Tasks */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              {t('todayMedication')} ({todaySchedules.length})
            </Text>
            {todaySchedules.some((s) => s.status === 'MISSED') && (
              <View style={[styles.missedAlertPill, { backgroundColor: themeColors.dangerLight }]}>
                <Text style={[styles.missedAlertPillText, { color: colors.danger }]}>
                  ⚠️ {todaySchedules.filter((s) => s.status === 'MISSED').length} {t('missed')}
                </Text>
              </View>
            )}
          </View>

          {todaySchedules.length > 0 ? (
            todaySchedules.map((item) => (
              <View
                key={item._id}
                style={[
                  styles.todaySchedCard,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                  item.status === 'MISSED' && { borderColor: colors.danger, borderWidth: 1.5 },
                ]}
              >
                <View style={styles.todaySchedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todaySchedMed, { color: themeColors.textPrimary }]}>
                      💊 {item.medicineName}
                    </Text>
                    <Text style={[styles.todaySchedMeta, { color: themeColors.textSecondary }]}>
                      {item.dosage} • ⏰ {item.scheduledTimeFormatted || item.scheduledTime}
                    </Text>
                    {item.instructions ? (
                      <Text style={[styles.todaySchedNotes, { color: themeColors.textMuted }]}>
                        {item.instructions}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'TAKEN' && { backgroundColor: themeColors.successLight },
                      item.status === 'MISSED' && { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' },
                      item.status === 'PENDING' && { backgroundColor: themeColors.warningLight || '#FEF3C7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        item.status === 'TAKEN' && { color: themeColors.success },
                        item.status === 'MISSED' && { color: colors.danger },
                        item.status === 'PENDING' && { color: '#D97706' },
                      ]}
                    >
                      {item.status === 'TAKEN' ? `✓ ${t('taken')}` : item.status === 'MISSED' ? `⚠️ ${t('missed')}` : `⏳ ${t('pending')}`}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                {t('allDosesOnTrack')}
              </Text>
            </View>
          )}
        </View>

        {/* Active Medications Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              {t('activeMedicationsTitle')} ({overview.activeMedications?.length || 0})
            </Text>
            <TouchableOpacity
              style={[styles.addMedBtn, { backgroundColor: themeColors.primary }]}
              onPress={() =>
                router.push({
                  pathname: '/(caregiver)/medication-add' as any,
                  params: { patientId: patient._id },
                })
              }
            >
              <Text style={styles.addMedText}>+ {t('addMedication')}</Text>
            </TouchableOpacity>
          </View>

          {overview.activeMedications && overview.activeMedications.length > 0 ? (
            overview.activeMedications.map((med) => (
              <View
                key={med._id}
                style={[
                  styles.medCard,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                ]}
              >
                <View style={styles.medHeaderRow}>
                  <Text style={[styles.medName, { color: themeColors.textPrimary }]}>💊 {med.medicineName}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/(caregiver)/medication-edit' as any,
                        params: { id: med._id, patientId: patient._id },
                      })
                    }
                  >
                    <Text style={[styles.editMedText, { color: themeColors.primary }]}>{t('edit')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.medDetail, { color: themeColors.textSecondary }]}>
                  {t('dosage')}: {med.dosage} • {t('frequency')}: {med.frequency}
                </Text>
                <Text style={[styles.medTimes, { color: themeColors.primary }]}>{t('scheduleTimes')}: {med.timeSlots?.join(', ')}</Text>
                {med.instructions ? (
                  <Text style={[styles.medInstructions, { color: themeColors.textMuted }]}>{t('instructionsLabel')}: {med.instructions}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
            >
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>{t('noActiveMedicationsYet')}</Text>
            </View>
          )}
        </View>

        {/* Upcoming Appointments Section */}
        {overview.upcomingAppointments && overview.upcomingAppointments.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('upcomingDoctorAppointments')}</Text>
            {overview.upcomingAppointments.map((appt) => (
              <View
                key={appt._id}
                style={[
                  styles.apptCard,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                ]}
              >
                <Text style={[styles.apptDoctor, { color: themeColors.textPrimary }]}>
                  👨‍⚕️ {appt.doctorId?.fullName || t('specialists')}
                </Text>
                <Text style={[styles.apptMeta, { color: themeColors.primary }]}>
                  📅 {new Date(appt.appointmentDate).toLocaleDateString('en-GB')} at {appt.timeSlot}
                </Text>
                {appt.reason ? (
                  <Text style={[styles.apptReason, { color: themeColors.textSecondary }]}>{t('reasonForVisit')}: {appt.reason}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Recent Consultations Section */}
        {overview.recentConsultations && overview.recentConsultations.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('recentConsultations')}</Text>
            {overview.recentConsultations.map((c) => (
              <View
                key={c._id}
                style={[
                  styles.consultCard,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                ]}
              >
                <Text style={[styles.consultDiag, { color: themeColors.textPrimary }]}>🩺 {c.diagnosis}</Text>
                <Text style={[styles.consultDoctor, { color: themeColors.textSecondary }]}>
                  {t('doctor')}: {c.doctorId?.fullName || t('specialists')}
                </Text>
                {c.clinicalNotes ? (
                  <Text style={[styles.consultNotes, { color: themeColors.textMuted }]} numberOfLines={2}>
                    {t('notesLabel')}: {c.clinicalNotes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Unlink Patient Action */}
        <TouchableOpacity
          style={[
            styles.unlinkBtn,
            {
              backgroundColor: themeColors.dangerLight,
              borderColor: themeColors.danger,
            },
          ]}
          onPress={handleUnlink}
          disabled={unlinking}
        >
          <Text style={[styles.unlinkBtnText, { color: themeColors.danger }]}>
            {unlinking ? t('unlinkingPatient') : t('removePatientLinkBtn')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: {
    ...typography.header,
    fontSize: 22,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  patientName: {
    ...typography.header,
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  patientSub: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  contactBox: {
    marginTop: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  contactTitle: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  contactDetail: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
  },
  adherenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  adherenceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  adherenceTextCol: {
    flex: 1,
  },
  adherenceTitle: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  adherenceSubtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  adherenceVal: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.success,
    fontWeight: '800',
    marginTop: 2,
  },
  viewAnalyticsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  viewAnalyticsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  adherenceStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statPill: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
  },
  statPillMissed: {
    backgroundColor: colors.dangerLight,
  },
  statVal: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.success,
  },
  statLbl: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 17,
    color: colors.textPrimary,
  },
  addMedBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  addMedText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  medCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  medHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  editMedText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  medDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  medTimes: {
    ...typography.caption,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  medInstructions: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  apptCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  apptDoctor: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  apptMeta: {
    ...typography.caption,
    color: colors.primaryDark,
    fontSize: 13,
    marginTop: 2,
  },
  apptReason: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  consultCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  consultDiag: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  consultDoctor: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  consultNotes: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  unlinkBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    backgroundColor: colors.dangerLight,
  },
  unlinkBtnText: {
    ...typography.bodyBold,
    color: colors.danger,
    fontSize: 14,
  },
  missedAlertPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  missedAlertPillText: {
    fontWeight: '800',
    fontSize: 12,
  },
  todaySchedCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  todaySchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  todaySchedMed: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  todaySchedMeta: {
    ...typography.caption,
    fontSize: 13,
    marginTop: 2,
  },
  todaySchedNotes: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  statusPillText: {
    fontWeight: '800',
    fontSize: 12,
  },
});
