import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getMyPrescriptions } from '../../services/prescriptionService';
import { Prescription } from '../../types/prescription';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

export default function PatientPrescriptionsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchPrescriptions = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getMyPrescriptions();
      if (res && res.success) {
        setPrescriptions(res.data || []);
      } else {
        setErrorMsg(res.message || 'Failed to load prescriptions.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve your prescriptions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPrescriptions();
    }, [fetchPrescriptions])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPrescriptions(true);
  };

  const formatDate = (rawDate?: string | null) => {
    if (!rawDate) return '';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return String(rawDate);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return String(rawDate);
    }
  };

  const getDoctorName = (prescription: Prescription): string => {
    const raw =
      prescription.doctorDetails?.fullName ||
      (typeof prescription.doctorId === 'object' ? prescription.doctorId.fullName : '') ||
      'Medical Specialist';
    return raw.toLowerCase().startsWith('dr.') ? raw : `Dr. ${raw}`;
  };

  const getDoctorInitials = (fullName: string): string => {
    return (
      fullName
        .replace(/^dr\.\s*/i, '')
        .trim()
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'DR'
    );
  };

  if (loading && prescriptions.length === 0) {
    return <LoadingView message="Loading your prescriptions..." />;
  }

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Doctor Prescriptions"
        subtitle="Official Treatment & Medicine Orders"
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchPrescriptions(true)} />
        ) : null}

        {!errorMsg && (
          <FlatList
            data={prescriptions}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[themeColors.primary]}
                tintColor={themeColors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="📋"
                title="No Prescriptions Found"
                description="You do not have any prescriptions recorded yet. Prescriptions issued by doctors during your consultations will appear here."
                actionText="Book Doctor Appointment"
                onAction={() => router.push('/(patient)/specialists' as any)}
              />
            }
            renderItem={({ item }) => {
              const docName = getDoctorName(item);
              const initials = getDoctorInitials(docName);
              const dateStr = formatDate(item.createdAt);
              const specialization =
                item.doctorDetails?.specialization || 'Medical Specialist';
              const hospital = item.doctorDetails?.hospital;

              return (
                <View
                  style={[
                    styles.prescriptionCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  {/* Doctor Info Header Row */}
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: themeColors.primaryLight,
                          borderColor: themeColors.primary,
                        },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: themeColors.primary }]}>
                        {initials}
                      </Text>
                    </View>

                    <View style={styles.doctorTextCol}>
                      <Text style={[styles.doctorName, { color: themeColors.textPrimary }]}>
                        {docName}
                      </Text>
                      <Text style={[styles.specializationText, { color: themeColors.primary }]}>
                        {specialization}
                      </Text>
                      {hospital ? (
                        <Text style={[styles.hospitalText, { color: themeColors.textSecondary }]}>
                          🏥 {hospital}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.dateCol}>
                      <Text style={[styles.dateBadge, { color: themeColors.textMuted }]}>
                        {dateStr}
                      </Text>
                    </View>
                  </View>

                  {/* Diagnosis Tag (if present) */}
                  {item.diagnosis ? (
                    <View
                      style={[
                        styles.diagnosisBox,
                        {
                          backgroundColor: themeColors.surfaceSecondary,
                          borderColor: themeColors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.diagnosisLabel, { color: themeColors.textMuted }]}>
                        Diagnosis:
                      </Text>
                      <Text style={[styles.diagnosisValue, { color: themeColors.textPrimary }]}>
                        {item.diagnosis}
                      </Text>
                    </View>
                  ) : null}

                  {/* Clinical Notes (if present) */}
                  {item.clinicalNotes ? (
                    <Text style={[styles.clinicalNotesText, { color: themeColors.textSecondary }]}>
                      "{item.clinicalNotes}"
                    </Text>
                  ) : null}

                  {/* Prescribed Medications List */}
                  <View style={styles.medicationsSection}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionTitleIcon}>💊</Text>
                      <Text style={[styles.sectionTitleText, { color: themeColors.textPrimary }]}>
                        Prescribed Medicines ({item.medications?.length || 0})
                      </Text>
                    </View>

                    {item.medications && item.medications.length > 0 ? (
                      item.medications.map((med, mIdx) => (
                        <View
                          key={mIdx}
                          style={[
                            styles.medicineItemCard,
                            {
                              backgroundColor: themeColors.surfaceSecondary,
                              borderColor: themeColors.border,
                            },
                          ]}
                        >
                          <View style={styles.medicineHeaderRow}>
                            <Text style={[styles.medicineName, { color: themeColors.textPrimary }]}>
                              {med.medicineName}
                            </Text>
                            <View
                              style={[
                                styles.dosageBadge,
                                {
                                  backgroundColor: themeColors.primaryLight,
                                  borderColor: themeColors.primary,
                                },
                              ]}
                            >
                              <Text style={[styles.dosageBadgeText, { color: themeColors.primary }]}>
                                {med.dosage}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.medicineMetaRow}>
                            <Text style={[styles.medicineMetaText, { color: themeColors.textSecondary }]}>
                              🔄 {med.frequency}
                            </Text>
                            <Text style={[styles.medicineMetaDot, { color: themeColors.textMuted }]}>
                              •
                            </Text>
                            <Text style={[styles.medicineMetaText, { color: themeColors.textSecondary }]}>
                              ⏱️ {med.duration}
                            </Text>
                          </View>

                          {med.instructions ? (
                            <View style={styles.instructionsWrap}>
                              <Text
                                style={[
                                  styles.instructionsText,
                                  { color: themeColors.textSecondary },
                                ]}
                              >
                                📌 {med.instructions}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.emptyMedsText, { color: themeColors.textMuted }]}>
                        No medications listed on this prescription.
                      </Text>
                    )}
                  </View>

                  {/* Track Today's Doses Action (Phase 2) */}
                  <TouchableOpacity
                    style={[
                      styles.trackScheduleBtn,
                      { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                    ]}
                    onPress={() => router.push('/(patient)/today-medication' as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.trackScheduleBtnText, { color: themeColors.primaryDark }]}>
                      💊 Track Medication Schedule & Doses →
                    </Text>
                  </TouchableOpacity>

                  {/* Consultation Details Link (if linked) */}
                  {item.consultationId ? (
                    <TouchableOpacity
                      style={[
                        styles.consultationLinkBtn,
                        {
                          backgroundColor: themeColors.card,
                          borderColor: themeColors.border,
                        },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: '/(patient)/consultation-summary' as any,
                          params: { id: item.consultationId },
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.consultationLinkText, { color: themeColors.primary }]}>
                        View Consultation Notes & Summary →
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            }}
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
  listContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  prescriptionCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.subheader,
    fontSize: 16,
    fontWeight: '800',
  },
  doctorTextCol: {
    flex: 1,
  },
  doctorName: {
    ...typography.subheader,
    fontSize: 16,
    fontWeight: '800',
  },
  specializationText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 1,
  },
  hospitalText: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  dateCol: {
    alignItems: 'flex-end',
  },
  dateBadge: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  diagnosisBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  diagnosisLabel: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  diagnosisValue: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 13,
    flex: 1,
  },
  clinicalNotesText: {
    ...typography.caption,
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  medicationsSection: {
    marginTop: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: 4,
  },
  sectionTitleIcon: {
    fontSize: 14,
  },
  sectionTitleText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 13,
  },
  medicineItemCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  medicineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  medicineName: {
    ...typography.bodyBold,
    fontSize: 14,
    flex: 1,
  },
  dosageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    marginLeft: spacing.xs,
  },
  dosageBadgeText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 11,
  },
  medicineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  medicineMetaText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  medicineMetaDot: {
    marginHorizontal: spacing.xs,
    fontSize: 12,
  },
  instructionsWrap: {
    marginTop: 2,
  },
  instructionsText: {
    ...typography.caption,
    fontSize: 12,
  },
  emptyMedsText: {
    ...typography.caption,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  consultationLinkBtn: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  consultationLinkText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  trackScheduleBtn: {
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  trackScheduleBtnText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 13,
  },
});
