import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getCaregiverPatientMedicationAnalytics } from '../../services/medicationAnalyticsService';
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

export default function CaregiverMedicationAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>();
  const { isDark, colors: themeColors } = useTheme();
  const { t } = useLanguage();

  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [analytics, setAnalytics] = useState<MedicationAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const patientId = params.patientId;

  const fetchAnalytics = useCallback(
    async (isRefresh: boolean = false, targetRange: AnalyticsRange = range) => {
      if (!patientId) {
        setErrorMsg('Patient ID is missing.');
        setLoading(false);
        return;
      }

      if (!isRefresh) setLoading(true);
      setErrorMsg('');

      try {
        const res = await getCaregiverPatientMedicationAnalytics(patientId, targetRange);
        if (res && res.success) {
          setAnalytics(res);
        } else {
          setErrorMsg(res.message || 'Failed to retrieve medication adherence analytics.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Unable to load adherence analytics. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [patientId, range]
  );

  useEffect(() => {
    fetchAnalytics(false, range);
  }, [range, fetchAnalytics]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics(true, range);
    }, [fetchAnalytics, range])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics(true, range);
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

  if (loading && !analytics) {
    return <LoadingView message="Loading patient adherence analytics..." />;
  }

  const patientDisplayName =
    analytics?.patient?.fullName || params.patientName || 'Patient';
  const summary = analytics?.summary;
  const hasEnoughData = summary?.hasEnoughData ?? false;
  const adherencePct = summary?.adherencePercentage ?? null;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('medicationAnalytics')}
        subtitle={`${patientDisplayName} • ${t('medicationAdherence')}`}
        onBackPress={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
      >
        {/* Date Range Selector Pills */}
        <View style={styles.rangeRow}>
          {rangeButtons.map((btn) => {
            const isSelected = range === btn.key;
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
                    borderColor: isSelected ? themeColors.primary : themeColors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setRange(btn.key)}
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

        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchAnalytics(false, range)} />
        ) : (
          <>
            {/* Adherence Hero Card */}
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
                {patientDisplayName} •{' '}
                {range === '7d'
                  ? t('last7Days')
                  : range === '30d'
                  ? t('last30Days')
                  : range === '90d'
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

                  {/* Horizontal Progress Bar */}
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
              {/* Taken */}
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
                  {summary?.totalTaken ?? 0}
                </Text>
                <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                  {t('takenDoses')}
                </Text>
              </View>

              {/* Missed */}
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
                  {summary?.totalMissed ?? 0}
                </Text>
                <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                  {t('missedDoses')}
                </Text>
              </View>

              {/* Pending */}
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
                  {summary?.totalPending ?? 0}
                </Text>
                <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                  {t('pendingDoses')}
                </Text>
              </View>

              {/* Evaluated */}
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
                  {summary?.totalScheduledEvaluated ?? 0}
                </Text>
                <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>
                  {t('evaluatedDoses')}
                </Text>
              </View>
            </View>

            {/* Daily Trend Section */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionIcon}>📈</Text>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                  {t('dailyTrend')}
                </Text>
              </View>

              {analytics?.dailyTrend && analytics.dailyTrend.length > 0 ? (
                <View style={styles.dailyTrendList}>
                  {analytics.dailyTrend.map((item, idx) => (
                    <View key={`${item.date}-${idx}`} style={styles.dailyTrendRow}>
                      <View style={styles.dailyDateCol}>
                        <Text style={[styles.dailyDateText, { color: themeColors.textPrimary }]}>
                          {formatDateLabel(item.date)}
                        </Text>
                      </View>

                      {/* Daily progress mini-bar */}
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

                      {/* Percentage Badge */}
                      <View style={styles.dailyPctCol}>
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
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.emptySectionText, { color: themeColors.textSecondary }]}>
                  {t('notEnoughAdherenceData')}
                </Text>
              )}
            </View>

            {/* Medication Breakdown Section */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionIcon}>💊</Text>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                  {t('medicationBreakdown')}
                </Text>
              </View>

              {analytics?.medications && analytics.medications.length > 0 ? (
                analytics.medications.map((med) => (
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
                      <View style={styles.medTitleCol}>
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

                    {/* Counts Row */}
                    <View style={styles.medStatsRow}>
                      <Text style={[styles.medStatText, { color: themeColors.success }]}>
                        ✓ {t('takenDoses')}: {med.taken}
                      </Text>
                      <Text style={[styles.medStatText, { color: themeColors.danger }]}>
                        ⚠ {t('missedDoses')}: {med.missed}
                      </Text>
                      <Text style={[styles.medStatText, { color: themeColors.warning }]}>
                        ⏳ {t('pendingDoses')}: {med.pending}
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

            {/* Missed Dose Time Analysis Section */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionIcon}>⏰</Text>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                  {t('missedDoseTimes')}
                </Text>
              </View>

              {analytics?.missedByTime && analytics.missedByTime.length > 0 ? (
                analytics.missedByTime.map((item, idx) => (
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
                      <Text
                        style={[
                          styles.missedCountText,
                          { color: themeColors.danger },
                        ]}
                      >
                        {item.missedCount} {item.missedCount === 1 ? 'missed' : 'missed'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noMissedBox}>
                  <Text style={styles.noMissedIcon}>🎉</Text>
                  <Text style={[styles.noMissedText, { color: themeColors.success }]}>
                    No missed doses in this period!
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
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
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 56,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  zeroDataBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  zeroDataIcon: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  zeroDataTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  zeroDataSub: {
    fontSize: 12,
    textAlign: 'center',
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
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySectionText: {
    fontSize: 14,
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
  dailyDateCol: {
    width: 65,
  },
  dailyDateText: {
    fontSize: 12,
    fontWeight: '600',
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
  dailyPctCol: {
    width: 48,
    alignItems: 'flex-end',
  },
  dailyPctText: {
    fontSize: 12,
    fontWeight: '700',
  },
  medCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  medHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  medTitleCol: {
    flex: 1,
  },
  medName: {
    fontSize: 14,
    fontWeight: '700',
  },
  medDosage: {
    fontSize: 12,
    marginTop: 2,
  },
  medAdherenceBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  missedTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  missedCountBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.pill,
  },
  missedCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noMissedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  noMissedIcon: {
    fontSize: 18,
  },
  noMissedText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
