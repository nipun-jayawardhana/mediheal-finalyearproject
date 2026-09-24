import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  Platform,
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
  getCaregiverEmergencyAlertHealthSummary,
  resolveEmergencyAlert,
} from '../../services/caregiverService';
import { CaregiverEmergencyAlertSummaryResponse } from '../../types/emergency';

export default function CaregiverEmergencyDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ alertId?: string }>();
  const { isDark, colors: themeColors } = useTheme();
  const { t } = useLanguage();

  const [summaryData, setSummaryData] = useState<CaregiverEmergencyAlertSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [resolving, setResolving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const alertId = params.alertId;

  const fetchDetails = useCallback(async (isRefresh: boolean = false) => {
    if (!alertId) {
      setErrorMsg('No alert ID specified.');
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getCaregiverEmergencyAlertHealthSummary(alertId);
      if (res && res.success) {
        setSummaryData(res);
      } else {
        setErrorMsg(res?.message || 'Unable to retrieve emergency health summary.');
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message || err?.message || 'Unable to retrieve emergency health summary.';
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDetails(true);
  };

  const handleCallPatient = () => {
    const phone = summaryData?.patient?.phone;
    const name = summaryData?.patient?.name || t('careRecipient');

    if (!phone) {
      Alert.alert(t('callPatient'), t('noPhoneRecorded'));
      return;
    }

    Alert.alert(
      t('callPatient'),
      t('callingPatientConfirm').replace('{name}', name).replace('{phone}', phone),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('call'),
          style: 'default',
          onPress: () => {
            void Linking.openURL(`tel:${phone}`);
          },
        },
      ]
    );
  };

  const handleCallEmergencyContact = () => {
    const contact = summaryData?.emergencySummary?.emergencyContact;
    const phone = contact?.phone;
    const name = contact?.name || t('emergencyContact');

    if (!phone) {
      Alert.alert(t('callEmergencyContact'), t('noPhoneRecorded'));
      return;
    }

    Alert.alert(
      t('callEmergencyContact'),
      t('callingContactConfirm').replace('{name}', name).replace('{phone}', phone),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('call'),
          style: 'default',
          onPress: () => {
            void Linking.openURL(`tel:${phone}`);
          },
        },
      ]
    );
  };

  const handleResolveAlert = () => {
    if (!alertId || resolving) return;

    const patientName = summaryData?.patient?.name || t('careRecipient');

    Alert.alert(
      t('resolveAlertTitle'),
      t('resolveAlertConfirm').replace('{name}', patientName),
      [
        { text: t('keepActive'), style: 'cancel' },
        {
          text: t('resolveAlertBtn'),
          style: 'default',
          onPress: performResolveAlert,
        },
      ]
    );
  };

  const performResolveAlert = async () => {
    if (!alertId) return;
    setResolving(true);

    try {
      const res = await resolveEmergencyAlert(alertId);
      if (res && res.success) {
        Alert.alert(t('alertResolvedTitle'), t('alertResolvedSuccess'), [
          {
            text: t('done'),
            onPress: () => router.replace('/(caregiver)/alerts' as any),
          },
        ]);
      } else {
        Alert.alert(t('error'), res?.message || 'Failed to resolve emergency alert.');
      }
    } catch (err: any) {
      Alert.alert(t('error'), err?.message || 'Unable to resolve emergency alert.');
    } finally {
      setResolving(false);
    }
  };

  const formatTimestamp = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return (
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ` on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      );
    } catch (e) {
      return isoStr;
    }
  };

  if (loading) {
    return <LoadingView message={t('loadingEmergencyAlerts')} />;
  }

  if (errorMsg || !summaryData) {
    return (
      <ScreenContainer backgroundColor={themeColors.background}>
        <AppHeader
          title={t('emergencySOS')}
          subtitle={t('emergencyDetails')}
          onBackPress={() => router.back()}
        />
        <ErrorView
          message={errorMsg || 'Emergency alert record not found.'}
          onRetry={() => fetchDetails(false)}
        />
      </ScreenContainer>
    );
  }

  const { alert, patient, emergencySummary } = summaryData;
  const isAlertActive = alert?.status === 'active';
  const isProfileUnavailable = Boolean(emergencySummary?.unavailable);
  const isProfileCompleted = Boolean(emergencySummary?.profileCompleted);

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('emergencySOS')}
        subtitle={patient?.name || t('careRecipient')}
        onBackPress={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.danger]}
            tintColor={themeColors.danger}
          />
        }
      >
        {/* High Priority Active SOS Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
              borderColor: themeColors.danger,
            },
          ]}
          accessible={true}
          accessibilityLabel={`${t('emergencySOS')}, ${patient?.name}, status ${alert?.status}`}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroIcon}>🚨</Text>
              <View>
                <Text style={[styles.heroHeading, { color: themeColors.danger }]}>
                  {t('emergencySOS').toUpperCase()}
                </Text>
                <Text style={[styles.heroSubheading, { color: themeColors.textSecondary }]}>
                  {t('sosTriggeredAt')}: {formatTimestamp(alert?.triggeredAt)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isAlertActive ? themeColors.danger : themeColors.success },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {String(alert?.status || 'ACTIVE').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={[styles.activeAlertNoticeText, { color: themeColors.danger }]}>
            {t('activeAlertNotice')}
          </Text>

          <View
            style={[
              styles.privacyDisclaimerBox,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.privacyNoticeText, { color: themeColors.textMuted }]}>
              🛡️ {t('emergencySummaryNotice')}
            </Text>
          </View>
        </View>

        {/* Section 1: Patient Information */}
        <View
          style={[
            styles.cardSection,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              👤 {t('patientInformation')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
              {t('careRecipient')}:
            </Text>
            <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>
              {patient?.name || t('informationNotProvided')}
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
              {t('patientPhone')}:
            </Text>
            <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>
              {patient?.phone || t('informationNotProvided')}
            </Text>
          </View>

          {patient?.phone ? (
            <TouchableOpacity
              style={[
                styles.inlineCallBtn,
                { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF', borderColor: themeColors.primary },
              ]}
              onPress={handleCallPatient}
              accessibilityRole="button"
              accessibilityLabel={`${t('callPatient')} ${patient.name}`}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnIcon}>📞</Text>
              <Text style={[styles.callBtnLabel, { color: themeColors.primary }]}>
                {t('callPatient')} ({patient.phone})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Section 2: Emergency Medical Information */}
        <View
          style={[
            styles.cardSection,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              🩺 {t('emergencyMedicalInformation')}
            </Text>

            <View
              style={[
                styles.profileStateBadge,
                {
                  backgroundColor: isProfileCompleted
                    ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5')
                    : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFFBEB'),
                  borderColor: isProfileCompleted ? themeColors.success : '#F59E0B',
                },
              ]}
            >
              <Text
                style={[
                  styles.profileStateBadgeText,
                  { color: isProfileCompleted ? themeColors.success : '#D97706' },
                ]}
              >
                {isProfileCompleted ? t('done') : t('profileNotCompleted')}
              </Text>
            </View>
          </View>

          {/* Failure-Safe Fallback Banner if profile retrieval failed */}
          {isProfileUnavailable ? (
            <View
              style={[
                styles.unavailableBanner,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                  borderColor: themeColors.danger,
                },
              ]}
            >
              <Text style={styles.unavailableIcon}>⚠️</Text>
              <Text style={[styles.unavailableText, { color: themeColors.danger }]}>
                {t('emergencyInformationUnavailable')}
              </Text>
            </View>
          ) : null}

          {/* Blood Group */}
          <View style={styles.medicalItemContainer}>
            <Text style={[styles.medicalFieldLabel, { color: themeColors.textSecondary }]}>
              🩸 {t('bloodGroup')}
            </Text>
            <View style={styles.bloodGroupRow}>
              <View
                style={[
                  styles.bloodGroupBadge,
                  {
                    backgroundColor:
                      emergencySummary?.bloodGroup &&
                      emergencySummary.bloodGroup !== 'Unknown' &&
                      emergencySummary.bloodGroup !== 'Not provided'
                        ? themeColors.danger
                        : (isDark ? '#374151' : '#E2E8F0'),
                  },
                ]}
              >
                <Text style={styles.bloodGroupText}>
                  {emergencySummary?.bloodGroup &&
                  emergencySummary.bloodGroup !== 'Unknown' &&
                  emergencySummary.bloodGroup !== 'Not provided'
                    ? emergencySummary.bloodGroup
                    : t('informationNotProvided')}
                </Text>
              </View>
            </View>
          </View>

          {/* Allergies */}
          <View style={styles.medicalItemContainer}>
            <Text style={[styles.medicalFieldLabel, { color: themeColors.textSecondary }]}>
              ⚠️ {t('allergies')}
            </Text>
            {emergencySummary?.hasNoKnownAllergies ? (
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4',
                    borderColor: themeColors.success,
                  },
                ]}
              >
                <Text style={[styles.statusTagText, { color: themeColors.success }]}>
                  🛡️ {t('noKnownAllergies')}
                </Text>
              </View>
            ) : emergencySummary?.allergies && emergencySummary.allergies.length > 0 ? (
              <View style={styles.tagsWrapRow}>
                {emergencySummary.allergies.map((allergy, index) => (
                  <View
                    key={`allergy-${index}`}
                    style={[
                      styles.allergyTag,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                        borderColor: themeColors.danger,
                      },
                    ]}
                  >
                    <Text style={[styles.allergyTagText, { color: themeColors.danger }]}>
                      {allergy}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyMedicalNotice, { color: themeColors.textMuted }]}>
                {t('noAllergyInformation')}
              </Text>
            )}
          </View>

          {/* Chronic Conditions */}
          <View style={styles.medicalItemContainer}>
            <Text style={[styles.medicalFieldLabel, { color: themeColors.textSecondary }]}>
              🏥 {t('chronicConditions')}
            </Text>
            {emergencySummary?.chronicConditions && emergencySummary.chronicConditions.length > 0 ? (
              <View style={styles.tagsWrapRow}>
                {emergencySummary.chronicConditions.map((condition, index) => (
                  <View
                    key={`condition-${index}`}
                    style={[
                      styles.conditionTag,
                      {
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
                        borderColor: themeColors.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.conditionTagText, { color: themeColors.primary }]}>
                      {condition}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyMedicalNotice, { color: themeColors.textMuted }]}>
                {t('informationNotProvided')}
              </Text>
            )}
          </View>

          {/* Current Medications */}
          <View style={[styles.medicalItemContainer, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={[styles.medicalFieldLabel, { color: themeColors.textSecondary }]}>
              💊 {t('currentMedications')}
            </Text>

            {emergencySummary?.currentMedications && emergencySummary.currentMedications.length > 0 ? (
              <View style={styles.medicationsList}>
                {emergencySummary.currentMedications.map((med, index) => (
                  <View
                    key={`med-${index}`}
                    style={[
                      styles.medicationCard,
                      {
                        backgroundColor: isDark ? '#1F2937' : '#F8FAFC',
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.medicationTopRow}>
                      <Text style={[styles.medicationName, { color: themeColors.textPrimary }]}>
                        {med.medicineName}
                      </Text>
                      <View
                        style={[
                          styles.dosageBadge,
                          {
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
                          },
                        ]}
                      >
                        <Text style={[styles.dosageText, { color: themeColors.primary }]}>
                          {med.dosage}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.medicationFrequency, { color: themeColors.textSecondary }]}>
                      ⏱️ {med.frequency}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyMedicalNotice, { color: themeColors.textMuted }]}>
                {t('noActiveMedications')}
              </Text>
            )}
          </View>
        </View>

        {/* Section 3: Emergency Contact */}
        <View
          style={[
            styles.cardSection,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              📞 {t('emergencyContact')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
              {t('careRecipient')}:
            </Text>
            <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>
              {emergencySummary?.emergencyContact?.name || t('informationNotProvided')}
            </Text>
          </View>

          {emergencySummary?.emergencyContact?.relationship ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
                {t('relationshipLabel')}:
              </Text>
              <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>
                {emergencySummary.emergencyContact.relationship}
              </Text>
            </View>
          ) : null}

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>
              {t('patientPhone')}:
            </Text>
            <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>
              {emergencySummary?.emergencyContact?.phone || t('informationNotProvided')}
            </Text>
          </View>

          {emergencySummary?.emergencyContact?.phone ? (
            <TouchableOpacity
              style={[
                styles.inlineCallBtn,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                  borderColor: themeColors.danger,
                },
              ]}
              onPress={handleCallEmergencyContact}
              accessibilityRole="button"
              accessibilityLabel={`${t('callEmergencyContact')} ${emergencySummary.emergencyContact.name}`}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnIcon}>📞</Text>
              <Text style={[styles.callBtnLabel, { color: themeColors.danger }]}>
                {t('callEmergencyContact')} ({emergencySummary.emergencyContact.phone})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Section 4: Emergency Notes */}
        <View
          style={[
            styles.cardSection,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              📝 {t('emergencyNotes')}
            </Text>
          </View>

          {emergencySummary?.emergencyNotes ? (
            <View
              style={[
                styles.notesBox,
                {
                  backgroundColor: isDark ? '#1F2937' : '#F8FAFC',
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text style={[styles.notesText, { color: themeColors.textPrimary }]}>
                {emergencySummary.emergencyNotes}
              </Text>
            </View>
          ) : (
            <Text style={[styles.emptyMedicalNotice, { color: themeColors.textMuted }]}>
              {t('noEmergencyNotes')}
            </Text>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsContainer}>
          {/* Main Call Patient Action */}
          {patient?.phone ? (
            <AppButton
              title={`${t('callPatient')} (${patient.phone})`}
              onPress={handleCallPatient}
              variant="primary"
              style={styles.primaryActionBtn}
            />
          ) : null}

          {/* Main Call Emergency Contact Action */}
          {emergencySummary?.emergencyContact?.phone ? (
            <AppButton
              title={`${t('callEmergencyContact')} (${emergencySummary.emergencyContact.phone})`}
              onPress={handleCallEmergencyContact}
              variant="secondary"
              style={styles.secondaryActionBtn}
            />
          ) : null}

          {/* Resolve Alert Action */}
          {isAlertActive && (
            <AppButton
              title={resolving ? t('resolvingAlert') : t('resolveAlertBtn')}
              onPress={handleResolveAlert}
              variant="danger"
              disabled={resolving}
              style={styles.resolveActionBtn}
            />
          )}

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
          >
            <Text style={[styles.backBtnText, { color: themeColors.textSecondary }]}>
              ← {t('back')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    ...shadows.card,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  heroIcon: {
    fontSize: 28,
  },
  heroHeading: {
    ...typography.header,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroSubheading: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  statusBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  activeAlertNoticeText: {
    ...typography.bodyBold,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  privacyDisclaimerBox: {
    marginTop: spacing.xs,
    padding: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  privacyNoticeText: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 16,
  },
  cardSection: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 16,
    fontWeight: '800',
  },
  profileStateBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  profileStateBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
  },
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  unavailableIcon: {
    fontSize: 16,
  },
  unavailableText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoLabel: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  infoValue: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  inlineCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginTop: spacing.sm,
    minHeight: 48,
    gap: spacing.xs,
  },
  callBtnIcon: {
    fontSize: 16,
  },
  callBtnLabel: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  medicalItemContainer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  medicalFieldLabel: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  bloodGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bloodGroupBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  bloodGroupText: {
    ...typography.subheader,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  tagsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  allergyTag: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  allergyTagText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '800',
  },
  conditionTag: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  conditionTagText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusTagText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyMedicalNotice: {
    ...typography.caption,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  medicationsList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  medicationCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  medicationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medicationName: {
    ...typography.bodyBold,
    fontSize: 14,
    fontWeight: '800',
  },
  dosageBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  dosageText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
  },
  medicationFrequency: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 4,
  },
  notesBox: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  notesText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  primaryActionBtn: {
    minHeight: 50,
    borderRadius: borderRadius.md,
  },
  secondaryActionBtn: {
    minHeight: 50,
    borderRadius: borderRadius.md,
  },
  resolveActionBtn: {
    minHeight: 50,
    borderRadius: borderRadius.md,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  backBtnText: {
    ...typography.bodyBold,
    fontSize: 15,
  },
});
