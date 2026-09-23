import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getDoctorPatientHistory } from '../../services/doctorPortalService';
import { getDoctorPatientMedicationAnalytics } from '../../services/medicationAnalyticsService';
import { DoctorConsultationRecord } from '../../types/doctorPortal';
import {
  AnalyticsRange,
  MedicationAnalyticsResponse,
} from '../../types/medicationAnalytics';

const formatTimeAmPm = (time24?: string) => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};

const formatDateLabel = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function DoctorPatientHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const { isDark, colors: themeColors } = useTheme();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'consultations' | 'adherence'>('consultations');
  const [consultations, setConsultations] = useState<DoctorConsultationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Adherence Analytics state (Phase 6)
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('30d');
  const [analyticsData, setAnalyticsData] = useState<MedicationAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string>('');

  const fetchHistory = useCallback(async (isRefresh: boolean = false) => {
    if (!params.patientId) {
      setErrorMsg('Patient ID is missing.');
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getDoctorPatientHistory(params.patientId);
      if (res && res.success) {
        setConsultations(res.data || []);
      } else {
        setErrorMsg(res.message || 'Failed to retrieve patient consultation history.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unable to fetch patient history.';
      if (errMsg.toLowerCase().includes('access denied')) {
        setErrorMsg('Access denied. Doctors can view consultation history only for their own assigned patients.');
      } else {
        setErrorMsg(errMsg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.patientId]);

  const fetchAdherence = useCallback(
    async (targetRange: AnalyticsRange = analyticsRange) => {
      if (!params.patientId) return;

      setAnalyticsLoading(true);
      setAnalyticsError('');

      try {
        const res = await getDoctorPatientMedicationAnalytics(params.patientId, targetRange);
        if (res && res.success) {
          setAnalyticsData(res);
        } else {
          setAnalyticsError(res.message || 'Failed to retrieve adherence analytics.');
        }
      } catch (err: any) {
        const errMsg = err.message || 'Unable to load adherence analytics.';
        if (errMsg.toLowerCase().includes('access denied')) {
          setAnalyticsError('Access denied. Doctors can view adherence analytics only for their own patients.');
        } else {
          setAnalyticsError(errMsg);
        }
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [params.patientId, analyticsRange]
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (activeTab === 'adherence') {
      fetchAdherence(analyticsRange);
    }
  }, [activeTab, analyticsRange, fetchAdherence]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'consultations') {
      fetchHistory(true);
    } else {
      fetchAdherence(analyticsRange).finally(() => setRefreshing(false));
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return isoStr;
    }
  };

  const getAdherenceColor = (pct: number | null) => {
    if (pct === null) return themeColors.textSecondary;
    if (pct >= 80) return themeColors.success;
    if (pct >= 50) return themeColors.warning;
    return themeColors.danger;
  };

  const rangeButtons: { key: AnalyticsRange; label: string }[] = [
    { key: '7d', label: t('last7Days') },
    { key: '30d', label: t('last30Days') },
    { key: '90d', label: t('last90Days') },
    { key: 'all', label: t('allTime') },
  ];

  if (loading && consultations.length === 0) {
    return <LoadingView message="Loading patient consultation history..." />;
  }

  const patientName =
    consultations.length > 0 &&
    typeof consultations[0].patientId === 'object' &&
    consultations[0].patientId?.fullName
      ? consultations[0].patientId.fullName
      : analyticsData?.patient?.fullName || 'Patient';

  const adherenceSummary = analyticsData?.summary;
  const hasEnoughData = adherenceSummary?.hasEnoughData ?? false;
  const adherencePct = adherenceSummary?.adherencePercentage ?? null;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Patient History"
        subtitle={patientName ? `Medical History for ${patientName}` : 'Consultation Records'}
        onBackPress={() => router.back()}
      />

      {/* Top Segmented Tab Switcher */}
      <View style={[styles.tabBar, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'consultations' && {
              borderBottomColor: themeColors.primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setActiveTab('consultations')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'consultations'
                    ? themeColors.primary
                    : themeColors.textSecondary,
                fontWeight: activeTab === 'consultations' ? '700' : '500',
              },
            ]}
          >
            📑 Consultations ({consultations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'adherence' && {
              borderBottomColor: themeColors.primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setActiveTab('adherence')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'adherence'
                    ? themeColors.primary
                    : themeColors.textSecondary,
                fontWeight: activeTab === 'adherence' ? '700' : '500',
              },
            ]}
          >
            📊 {t('medicationAdherence')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {activeTab === 'consultations' ? (
          <>
            {errorMsg ? (
              <ErrorView message={errorMsg} onRetry={() => fetchHistory(true)} />
            ) : null}

            {!errorMsg && consultations.length === 0 && (
              <EmptyState
                icon="📑"
                title="No Previous Consultations"
                description="There are no previous consultation records logged for this patient."
              />
            )}

            {!errorMsg && consultations.length > 0 && (
              <FlatList
                data={consultations}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[themeColors.primary]}
                    tintColor={themeColors.primary}
                  />
                }
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.historyCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.dateBadge}>
                        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <View style={[styles.diagnosisBadge, { backgroundColor: themeColors.primaryLight }]}>
                        <Text style={[styles.diagnosisBadgeText, { color: themeColors.primary }]}>
                          {item.diagnosis || 'General Consultation'}
                        </Text>
                      </View>
                    </View>

                    {((typeof item.appointmentId === 'object' && item.appointmentId?.reason) || (item as any).symptoms) ? (
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Reason / Symptoms:</Text>
                        <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>
                          {(typeof item.appointmentId === 'object' && item.appointmentId?.reason) || (item as any).symptoms}
                        </Text>
                      </View>
                    ) : null}

                    {item.clinicalNotes && (
                      <View style={styles.notesBox}>
                        <Text style={[styles.notesLabel, { color: themeColors.textMuted }]}>Clinical Notes:</Text>
                        <Text style={[styles.notesText, { color: themeColors.textPrimary }]}>{item.clinicalNotes}</Text>
                      </View>
                    )}

                    {item.prescriptions && item.prescriptions.length > 0 && (
                      <View style={styles.prescriptionsSection}>
                        <Text style={[styles.sectionHeading, { color: themeColors.textMuted }]}>
                          Prescribed Medications ({item.prescriptions.length})
                        </Text>
                        {item.prescriptions.map((p, idx) => (
                          <View key={idx} style={[styles.pItem, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                            <Text style={[styles.pName, { color: themeColors.primary }]}>
                              💊 {p.medicineName} {p.dosage ? `(${p.dosage})` : ''}
                            </Text>
                            <Text style={[styles.pSub, { color: themeColors.textSecondary }]}>
                              {p.frequency} • {p.duration}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              />
            )}
          </>
        ) : (
          /* Adherence Analytics Tab (Phase 6) */
          <ScrollView
            contentContainerStyle={styles.analyticsScroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[themeColors.primary]}
                tintColor={themeColors.primary}
              />
            }
          >
            {/* Read-Only Doctor Notice */}
            <View
              style={[
                styles.readOnlyBanner,
                {
                  backgroundColor: isDark
                    ? 'rgba(59, 130, 246, 0.15)'
                    : '#EFF6FF',
                  borderColor: themeColors.primary,
                },
              ]}
            >
              <Text style={styles.readOnlyIcon}>ℹ️</Text>
              <Text style={[styles.readOnlyText, { color: themeColors.textPrimary }]}>
                Read-only adherence records for {patientName}. Doctor review mode.
              </Text>
            </View>

            {/* Date Range Selector Pills */}
            <View style={styles.rangeRow}>
              {rangeButtons.map((btn) => {
                const isSelected = analyticsRange === btn.key;
                return (
                  <TouchableOpacity
                    key={btn.key}
                    style={[
                      styles.rangePill,
                      {
                        backgroundColor: isSelected
                          ? themeColors.primary
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#F1F5F9',
                        borderColor: isSelected
                          ? themeColors.primary
                          : themeColors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setAnalyticsRange(btn.key)}
                  >
                    <Text
                      style={[
                        styles.rangePillText,
                        {
                          color: isSelected ? '#FFFFFF' : themeColors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {analyticsLoading && !analyticsData ? (
              <LoadingView message="Loading patient adherence analytics..." />
            ) : analyticsError ? (
              <ErrorView
                message={analyticsError}
                onRetry={() => fetchAdherence(analyticsRange)}
              />
            ) : (
              <>
                {/* Hero Adherence Card */}
                <View
                  style={[
                    styles.heroCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.heroSubtitle, { color: themeColors.textSecondary }]}>
                    {analyticsRange === '7d'
                      ? t('last7Days')
                      : analyticsRange === '30d'
                      ? t('last30Days')
                      : analyticsRange === '90d'
                      ? t('last90Days')
                      : t('allTime')}
                  </Text>

                  {hasEnoughData && adherencePct !== null ? (
                    <>
                      <Text
                        style={[
                          styles.heroPercentage,
                          { color: getAdherenceColor(adherencePct) },
                        ]}
                      >
                        {adherencePct}%
                      </Text>
                      <Text style={[styles.heroLabel, { color: themeColors.textPrimary }]}>
                        {t('medicationAdherence')}
                      </Text>

                      {/* Progress bar */}
                      <View
                        style={[
                          styles.progressBarTrack,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.1)'
                              : '#E2E8F0',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(100, Math.max(0, adherencePct))}%`,
                              backgroundColor: getAdherenceColor(adherencePct),
                            },
                          ]}
                        />
                      </View>
                    </>
                  ) : (
                    <View style={styles.zeroDataBox}>
                      <Text style={styles.zeroDataIcon}>📊</Text>
                      <Text style={[styles.zeroDataTitle, { color: themeColors.textPrimary }]}>
                        {t('notEnoughAdherenceData')}
                      </Text>
                      <Text style={[styles.zeroDataSub, { color: themeColors.textSecondary }]}>
                        Evaluated doses will show here once doses are taken or missed.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Core Metrics Counters */}
                <View style={styles.metricsGrid}>
                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#DCFCE7',
                      },
                    ]}
                  >
                    <Text style={styles.metricIcon}>✓</Text>
                    <Text style={[styles.metricNumber, { color: themeColors.success }]}>
                      {adherenceSummary?.totalTaken ?? 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                      {t('takenDoses')}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2',
                      },
                    ]}
                  >
                    <Text style={styles.metricIcon}>⚠</Text>
                    <Text style={[styles.metricNumber, { color: themeColors.danger }]}>
                      {adherenceSummary?.totalMissed ?? 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                      {t('missedDoses')}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: isDark ? 'rgba(234, 179, 8, 0.3)' : '#FEF9C3',
                      },
                    ]}
                  >
                    <Text style={styles.metricIcon}>⏳</Text>
                    <Text style={[styles.metricNumber, { color: themeColors.warning }]}>
                      {adherenceSummary?.totalPending ?? 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                      {t('pendingDoses')}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <Text style={styles.metricIcon}>📋</Text>
                    <Text style={[styles.metricNumber, { color: themeColors.primary }]}>
                      {adherenceSummary?.totalScheduledEvaluated ?? 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                      {t('evaluatedDoses')}
                    </Text>
                  </View>
                </View>

                {/* Daily Trend */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                    📈 {t('dailyTrend')}
                  </Text>
                  {analyticsData?.dailyTrend && analyticsData.dailyTrend.length > 0 ? (
                    <View style={styles.dailyTrendList}>
                      {analyticsData.dailyTrend.map((item, idx) => (
                        <View key={`${item.date}-${idx}`} style={styles.dailyTrendRow}>
                          <Text style={[styles.dailyDateText, { color: themeColors.textPrimary }]}>
                            {formatDateLabel(item.date)}
                          </Text>
                          <View style={styles.dailyBarWrapper}>
                            <View
                              style={[
                                styles.dailyBarTrack,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : '#F1F5F9',
                                },
                              ]}
                            >
                              {item.percentage !== null && (
                                <View
                                  style={[
                                    styles.dailyBarFill,
                                    {
                                      width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                                      backgroundColor: getAdherenceColor(item.percentage),
                                    },
                                  ]}
                                />
                              )}
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.dailyPctText,
                              {
                                color:
                                  item.percentage !== null
                                    ? getAdherenceColor(item.percentage)
                                    : themeColors.textSecondary,
                              },
                            ]}
                          >
                            {item.percentage !== null ? `${item.percentage}%` : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.emptySectionText, { color: themeColors.textSecondary }]}>
                      {t('notEnoughAdherenceData')}
                    </Text>
                  )}
                </View>

                {/* Medication Breakdown */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                    💊 {t('medicationBreakdown')}
                  </Text>
                  {analyticsData?.medications && analyticsData.medications.length > 0 ? (
                    analyticsData.medications.map((med) => (
                      <View
                        key={med.scheduleId}
                        style={[
                          styles.medCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : '#F8FAFC',
                            borderColor: themeColors.border,
                          },
                        ]}
                      >
                        <View style={styles.medHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.medName, { color: themeColors.textPrimary }]}>
                              {med.medicineName}
                            </Text>
                            <Text style={[styles.medDosage, { color: themeColors.textSecondary }]}>
                              {med.dosage}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.medAdherenceBadge,
                              {
                                backgroundColor:
                                  med.adherencePercentage !== null
                                    ? isDark
                                      ? 'rgba(34, 197, 94, 0.15)'
                                      : '#DCFCE7'
                                    : isDark
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : '#F1F5F9',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.medAdherenceText,
                                {
                                  color:
                                    med.adherencePercentage !== null
                                      ? getAdherenceColor(med.adherencePercentage)
                                      : themeColors.textSecondary,
                                },
                              ]}
                            >
                              {med.adherencePercentage !== null
                                ? `${med.adherencePercentage}%`
                                : '—'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.medStatsRow}>
                          <Text style={[styles.medStatText, { color: themeColors.success }]}>
                            ✓ {t('taken')}: {med.taken}
                          </Text>
                          <Text style={[styles.medStatText, { color: themeColors.danger }]}>
                            ⚠ {t('missed')}: {med.missed}
                          </Text>
                          <Text style={[styles.medStatText, { color: themeColors.warning }]}>
                            ⏳ {t('pending')}: {med.pending}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptySectionText, { color: themeColors.textSecondary }]}>
                      {t('noMedicationScheduledToday')}
                    </Text>
                  )}
                </View>

                {/* Missed Dose Times */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                    ⏰ {t('missedDoseTimes')}
                  </Text>
                  {analyticsData?.missedByTime && analyticsData.missedByTime.length > 0 ? (
                    analyticsData.missedByTime.map((item, idx) => (
                      <View
                        key={`${item.time}-${idx}`}
                        style={[
                          styles.missedTimeRow,
                          { borderColor: themeColors.border },
                        ]}
                      >
                        <Text style={[styles.missedTimeText, { color: themeColors.textPrimary }]}>
                          {formatTimeAmPm(item.time)}
                        </Text>
                        <View
                          style={[
                            styles.missedCountBadge,
                            {
                              backgroundColor: isDark
                                ? 'rgba(239, 68, 68, 0.2)'
                                : '#FEE2E2',
                            },
                          ]}
                        >
                          <Text style={[styles.missedCountText, { color: themeColors.danger }]}>
                            {item.missedCount} missed
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.noMissedText, { color: themeColors.success }]}>
                      🎉 No missed doses recorded in this period!
                    </Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  historyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dateBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  diagnosisBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  diagnosisBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 80,
  },
  infoValue: {
    fontSize: 13,
    flex: 1,
  },
  notesBox: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.sm,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  prescriptionsSection: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: spacing.xs,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pItem: {
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: 4,
    borderWidth: 1,
  },
  pName: {
    fontSize: 13,
    fontWeight: '700',
  },
  pSub: {
    fontSize: 12,
    marginTop: 1,
  },
  // Adherence styles
  analyticsScroll: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  readOnlyIcon: {
    fontSize: 16,
  },
  readOnlyText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  rangePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangePillText: {
    fontSize: 12,
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  heroPercentage: {
    fontSize: 44,
    fontWeight: '800',
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  zeroDataBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  zeroDataIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  zeroDataTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  zeroDataSub: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    ...shadows.card,
  },
  metricIcon: {
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySectionText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  dailyTrendList: {
    gap: spacing.sm,
  },
  dailyTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dailyDateText: {
    fontSize: 12,
    fontWeight: '600',
    width: 60,
  },
  dailyBarWrapper: {
    flex: 1,
  },
  dailyBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dailyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  dailyPctText: {
    fontSize: 12,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
  },
  medCard: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  medHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  medName: {
    fontSize: 14,
    fontWeight: '700',
  },
  medDosage: {
    fontSize: 12,
    marginTop: 1,
  },
  medAdherenceBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.pill,
  },
  medAdherenceText: {
    fontSize: 12,
    fontWeight: '800',
  },
  medStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  medStatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  missedTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  missedTimeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  missedCountBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.pill,
  },
  missedCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noMissedText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
