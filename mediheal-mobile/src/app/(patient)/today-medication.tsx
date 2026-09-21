import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { spacing, borderRadius, typography } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getMyTodayMedicationSchedules,
  markScheduleTaken,
  getMedicationHistory,
} from '../../services/medicationScheduleService';
import {
  TodayMedicationTask,
  AdherenceHistoryItem,
  AdherenceStats,
} from '../../types/medicationSchedule';

/**
 * Format HH:MM (24h) to 12h format with AM/PM (e.g. "08:00" -> "08:00 AM")
 */
const formatTimeAmPm = (time24?: string): string => {
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

/**
 * Format timestamp into readable time (e.g. "08:05 AM")
 */
const formatTimestampTime = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
};

export default function TodayMedicationScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [tasks, setTasks] = useState<TodayMedicationTask[]>([]);
  const [historyItems, setHistoryItems] = useState<AdherenceHistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<AdherenceStats | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Fetch today's tasks and history
  const loadData = useCallback(async () => {
    setErrorMsg('');
    try {
      const [todayRes, historyRes] = await Promise.all([
        getMyTodayMedicationSchedules(),
        getMedicationHistory().catch(() => null),
      ]);

      if (todayRes && todayRes.success) {
        setTasks(todayRes.data || []);
      } else {
        setErrorMsg('Failed to load today medication schedule.');
      }

      if (historyRes && historyRes.success) {
        setHistoryItems(historyRes.data || []);
        setHistoryStats(historyRes.stats || null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve medication schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Handle marking a scheduled medicine dose as taken
  const handleMarkAsTaken = async (task: TodayMedicationTask) => {
    if (task.status === 'TAKEN' || markingId) return;

    setMarkingId(task._id);
    try {
      const res = await markScheduleTaken(task._id);

      if (res && res.success) {
        const nowIso = new Date().toISOString();
        // Optimistically update local task list
        setTasks((prev) =>
          prev.map((tItem) =>
            tItem._id === task._id
              ? {
                  ...tItem,
                  status: 'TAKEN',
                  takenAt: res.data?.takenAt || nowIso,
                }
              : tItem
          )
        );

        // Also refresh adherence history in background
        getMedicationHistory()
          .then((histRes) => {
            if (histRes && histRes.success) {
              setHistoryItems(histRes.data || []);
              setHistoryStats(histRes.stats || null);
            }
          })
          .catch(() => {});

        Alert.alert(
          t('taken'),
          `${task.medicineName} ${task.dosage} marked as taken at ${formatTimestampTime(
            res.data?.takenAt || nowIso
          )}.`
        );
      } else {
        Alert.alert('Error', res.message || 'Failed to record medication dose.');
      }
    } catch (err: any) {
      const msg = err.message || 'Unable to mark medication as taken.';
      Alert.alert('Action Failed', msg);
    } finally {
      setMarkingId(null);
    }
  };

  // Compute counts for today
  const { totalCount, takenCount, pendingCount } = useMemo(() => {
    const total = tasks.length;
    const taken = tasks.filter((tItem) => tItem.status === 'TAKEN').length;
    const pending = tasks.filter((tItem) => tItem.status === 'PENDING').length;
    return { totalCount: total, takenCount: taken, pendingCount: pending };
  }, [tasks]);

  if (loading && !refreshing) {
    return <LoadingView message="Loading medication schedule..." />;
  }

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('todayMedication')}
        subtitle={
          activeTab === 'today'
            ? `${pendingCount} ${t('medicinesRemaining')}`
            : t('medicationHistory')
        }
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {/* Segmented Tab Switcher */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'today' && {
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={() => setActiveTab('today')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                {
                  color:
                    activeTab === 'today' ? '#FFFFFF' : themeColors.textSecondary,
                },
                activeTab === 'today' && styles.tabBtnTextActive,
              ]}
            >
              💊 {t('todayMedication')} {totalCount > 0 ? `(${totalCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'history' && {
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                {
                  color:
                    activeTab === 'history' ? '#FFFFFF' : themeColors.textSecondary,
                },
                activeTab === 'history' && styles.tabBtnTextActive,
              ]}
            >
              📊 {t('medicationHistory')}
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? <ErrorView message={errorMsg} onRetry={loadData} /> : null}

        {/* TAB 1: TODAY'S MEDICATION TASKS */}
        {activeTab === 'today' && (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeColors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              tasks.length > 0 ? (
                <View
                  style={[
                    styles.progressCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor:
                        pendingCount === 0 ? themeColors.success : themeColors.border,
                    },
                  ]}
                >
                  <View style={styles.progressRow}>
                    <View style={styles.progressTextCol}>
                      <Text
                        style={[
                          styles.progressTitle,
                          { color: themeColors.textPrimary },
                        ]}
                      >
                        {pendingCount === 0
                          ? t('allMedicinesTaken')
                          : `${pendingCount} ${t('medicinesRemaining')}`}
                      </Text>
                      <Text
                        style={[
                          styles.progressSub,
                          { color: themeColors.textSecondary },
                        ]}
                      >
                        {takenCount} of {totalCount} doses recorded today
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.progressBadge,
                        {
                          backgroundColor:
                            pendingCount === 0
                              ? themeColors.successLight
                              : themeColors.primaryLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.progressBadgeText,
                          {
                            color:
                              pendingCount === 0
                                ? themeColors.success
                                : themeColors.primary,
                          },
                        ]}
                      >
                        {totalCount > 0
                          ? `${Math.round((takenCount / totalCount) * 100)}%`
                          : '0%'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              !errorMsg ? (
                <View style={styles.emptyContainer}>
                  <EmptyState
                    icon="💊"
                    title={t('noMedicationScheduledToday')}
                    description="No doctor prescriptions are active or scheduled for today."
                  />
                  <TouchableOpacity
                    style={[
                      styles.viewPrescriptionsBtn,
                      { backgroundColor: themeColors.primary },
                    ]}
                    onPress={() => router.push('/(patient)/prescriptions' as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewPrescriptionsBtnText}>
                      📋 View Doctor Prescriptions
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isTaken = item.status === 'TAKEN';
              const isMissed = item.status === 'MISSED';
              const isMarking = markingId === item._id;

              return (
                <View
                  style={[
                    styles.medCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: isTaken
                        ? themeColors.success
                        : isMissed
                        ? themeColors.danger
                        : themeColors.border,
                    },
                  ]}
                >
                  {/* Card Header Row */}
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.medIconCircle,
                        {
                          backgroundColor: isTaken
                            ? themeColors.successLight
                            : isMissed
                            ? themeColors.dangerLight
                            : themeColors.primaryLight,
                        },
                      ]}
                    >
                      <Text style={styles.medIcon}>
                        {isTaken ? '✓' : isMissed ? '⚠️' : '💊'}
                      </Text>
                    </View>

                    <View style={styles.medNameCol}>
                      <Text
                        style={[
                          styles.medicineName,
                          { color: themeColors.textPrimary },
                        ]}
                      >
                        {item.medicineName}
                      </Text>
                      <Text
                        style={[
                          styles.dosageText,
                          { color: themeColors.textSecondary },
                        ]}
                      >
                        {t('dosage')}: {item.dosage}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isTaken
                            ? themeColors.successLight
                            : isMissed
                            ? themeColors.dangerLight
                            : isDark
                            ? 'rgba(234, 179, 8, 0.2)'
                            : '#FEF3C7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color: isTaken
                              ? themeColors.success
                              : isMissed
                              ? themeColors.danger
                              : isDark
                              ? '#FDE047'
                              : '#B45309',
                          },
                        ]}
                      >
                        {isTaken
                          ? `✓ ${t('taken')}`
                          : isMissed
                          ? `⚠️ ${t('missed')}`
                          : t('pending')}
                      </Text>
                    </View>
                  </View>

                  {/* Scheduled Time & Details */}
                  <View
                    style={[
                      styles.detailsSection,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : '#F9FAFB',
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>⏰</Text>
                      <Text
                        style={[
                          styles.detailLabel,
                          { color: themeColors.textSecondary },
                        ]}
                      >
                        Time:
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: themeColors.textPrimary },
                        ]}
                      >
                        {formatTimeAmPm(item.scheduledTime)}
                      </Text>
                    </View>

                    {item.instructions ? (
                      <View style={[styles.detailRow, { marginTop: 4 }]}>
                        <Text style={styles.detailIcon}>📝</Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: themeColors.textSecondary },
                          ]}
                        >
                          Instructions:
                        </Text>
                        <Text
                          style={[
                            styles.detailValue,
                            { color: themeColors.textPrimary, flex: 1 },
                          ]}
                        >
                          {item.instructions}
                        </Text>
                      </View>
                    ) : null}

                    {isMissed ? (
                      <View style={[styles.detailRow, { marginTop: 4 }]}>
                        <Text style={styles.detailIcon}>⚠️</Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: themeColors.danger, fontWeight: '700' },
                          ]}
                        >
                          Dose Missed (Past grace period)
                        </Text>
                      </View>
                    ) : null}

                    {!isTaken && !isMissed ? (
                      <View style={[styles.detailRow, { marginTop: 4 }]}>
                        <Text style={styles.detailIcon}>⏰</Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: themeColors.primary, fontWeight: '700' },
                          ]}
                        >
                          {t('reminderActive')}:
                        </Text>
                        <Text
                          style={[
                            styles.detailValue,
                            { color: themeColors.primary, flex: 1, fontWeight: '600' },
                          ]}
                        >
                          {t('reminder15MinNotice')}
                        </Text>
                      </View>
                    ) : null}

                    {isTaken && item.takenAt ? (
                      <View style={[styles.detailRow, { marginTop: 4 }]}>
                        <Text style={styles.detailIcon}>⏱️</Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: themeColors.success },
                          ]}
                        >
                          {t('takenAt')}:
                        </Text>
                        <Text
                          style={[
                            styles.detailValue,
                            { color: themeColors.success, fontWeight: '700' },
                          ]}
                        >
                          {formatTimestampTime(item.takenAt)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Button */}
                  <View style={styles.cardActionArea}>
                    {isTaken ? (
                      <View
                        style={[
                          styles.takenDisabledBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(34, 197, 94, 0.15)'
                              : '#ECFDF5',
                            borderColor: themeColors.success,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.takenDisabledBtnText,
                            { color: themeColors.success },
                          ]}
                        >
                          ✓ {t('taken')}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.markTakenBtn,
                          { backgroundColor: themeColors.primary },
                          isMarking && { opacity: 0.7 },
                        ]}
                        onPress={() => handleMarkAsTaken(item)}
                        disabled={isMarking}
                        activeOpacity={0.8}
                      >
                        {isMarking ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.markTakenBtnText}>
                            {t('markAsTaken')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* TAB 2: ADHERENCE HISTORY */}
        {activeTab === 'history' && (
          <ScrollView
            style={styles.historyContainer}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeColors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Stats Box */}
            <View
              style={[
                styles.historyStatsCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.historyStatsTitle,
                  { color: themeColors.textPrimary },
                ]}
              >
                Overall Adherence Compliance
              </Text>
              <View style={styles.statsMetricsRow}>
                <View style={styles.metricCol}>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: themeColors.primary },
                    ]}
                  >
                    {historyStats?.adherencePercentage ?? 0}%
                  </Text>
                  <Text
                    style={[
                      styles.metricLabel,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    {t('adherenceCompliance')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.metricDivider,
                    { backgroundColor: themeColors.border },
                  ]}
                />
                <View style={styles.metricCol}>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: themeColors.success },
                    ]}
                  >
                    {historyStats?.totalTaken ?? 0}
                  </Text>
                  <Text
                    style={[
                      styles.metricLabel,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    {t('taken')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.metricDivider,
                    { backgroundColor: themeColors.border },
                  ]}
                />
                <View style={styles.metricCol}>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: themeColors.textPrimary },
                    ]}
                  >
                    {historyStats?.totalScheduled ?? 0}
                  </Text>
                  <Text
                    style={[
                      styles.metricLabel,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Total Doses
                  </Text>
                </View>
              </View>
            </View>

            {/* History List */}
            {historyItems.length === 0 ? (
              <EmptyState
                icon="📊"
                title="No Adherence History"
                description="No medication logs recorded yet. Mark doses as taken to build your adherence history."
              />
            ) : (
              historyItems.map((hist) => {
                const isHistTaken = hist.status === 'TAKEN';
                return (
                  <View
                    key={hist._id}
                    style={[
                      styles.historyCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyCardLeft}>
                        <Text
                          style={[
                            styles.historyMedicine,
                            { color: themeColors.textPrimary },
                          ]}
                        >
                          {hist.medicineName} ({hist.dosage})
                        </Text>
                        <Text
                          style={[
                            styles.historySub,
                            { color: themeColors.textSecondary },
                          ]}
                        >
                          Date: {hist.scheduledDate} • Time:{' '}
                          {formatTimeAmPm(hist.scheduledTime)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isHistTaken
                              ? themeColors.successLight
                              : isDark
                              ? 'rgba(234, 179, 8, 0.2)'
                              : '#FEF3C7',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: isHistTaken
                                ? themeColors.success
                                : isDark
                                ? '#FDE047'
                                : '#B45309',
                            },
                          ]}
                        >
                          {isHistTaken ? `✓ ${t('taken')}` : t('pending')}
                        </Text>
                      </View>
                    </View>

                    {isHistTaken && hist.takenAt && (
                      <Text
                        style={[
                          styles.historyTakenTimestamp,
                          { color: themeColors.success },
                        ]}
                      >
                        ✓ {t('takenAt')}: {formatTimestampTime(hist.takenAt)}
                      </Text>
                    )}
                  </View>
                );
              })
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
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  tabBtnText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  tabBtnTextActive: {
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  progressCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTextCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  progressTitle: {
    ...typography.subheader,
    fontWeight: '700',
    fontSize: 16,
  },
  progressSub: {
    ...typography.caption,
    fontSize: 13,
    marginTop: 2,
  },
  progressBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  progressBadgeText: {
    fontWeight: '800',
    fontSize: 14,
  },
  medCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  medIcon: {
    fontSize: 20,
  },
  medNameCol: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  medicineName: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  dosageText: {
    ...typography.caption,
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  detailsSection: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  detailLabel: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 13,
    marginRight: 6,
  },
  detailValue: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '500',
  },
  cardActionArea: {
    marginTop: spacing.md,
  },
  markTakenBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markTakenBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  takenDisabledBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takenDisabledBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  viewPrescriptionsBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  viewPrescriptionsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  historyContainer: {
    flex: 1,
  },
  historyStatsCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  historyStatsTitle: {
    ...typography.subheader,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  statsMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.xs,
  },
  metricCol: {
    alignItems: 'center',
  },
  metricValue: {
    fontWeight: '800',
    fontSize: 20,
  },
  metricLabel: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 32,
  },
  historyCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardLeft: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  historyMedicine: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  historySub: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  historyTakenTimestamp: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 6,
  },
});
