import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getPatientMedicalHistory } from '../../services/medicalHistoryService';
import { MedicalTimelineItem } from '../../types/medicalHistory';

export default function PatientMedicalHistoryScreen() {
  const router = useRouter();
  const { colors: themeColors, isDark } = useTheme();
  const { t } = useLanguage();

  const [historyItems, setHistoryItems] = useState<MedicalTimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchTimeline = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getPatientMedicalHistory();
      if (res && res.success) {
        const items = res.data || [];
        setHistoryItems(items);
        // Default: expand the first (most recent) item if available
        if (items.length > 0 && !isRefresh) {
          setExpandedIds(new Set([items[0].id]));
        }
      } else {
        setErrorMsg(res?.message || 'Failed to retrieve medical history.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to fetch medical history timeline.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTimeline(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllExpanded = () => {
    if (expandedIds.size === sortedItems.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(sortedItems.map((item) => item.id)));
    }
  };

  const sortedItems = useMemo(() => {
    const list = [...historyItems];
    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
    return list;
  }, [historyItems, sortOrder]);

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

  if (loading && historyItems.length === 0) {
    return <LoadingView message="Loading medical history timeline..." />;
  }

  const allExpanded = sortedItems.length > 0 && expandedIds.size === sortedItems.length;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('medicalHistory')}
        subtitle={t('medicalHistorySub')}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchTimeline(true)} />
        ) : null}

        {!errorMsg && historyItems.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t('noMedicalHistoryTitle')}
            description={t('noMedicalHistoryDesc')}
          />
        ) : null}

        {!errorMsg && historyItems.length > 0 ? (
          <View style={styles.contentWrap}>
            {/* Controls Bar: Sort & Expand All */}
            <View style={styles.controlsBar}>
              <View style={styles.sortToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.sortBtn,
                    {
                      backgroundColor:
                        sortOrder === 'newest'
                          ? themeColors.primary
                          : isDark
                          ? themeColors.surfaceSecondary
                          : '#FFFFFF',
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => setSortOrder('newest')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sortBtnText,
                      {
                        color:
                          sortOrder === 'newest'
                            ? '#FFFFFF'
                            : themeColors.textSecondary,
                        fontWeight: sortOrder === 'newest' ? '700' : '500',
                      },
                    ]}
                  >
                    ↓ {t('newestFirst')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sortBtn,
                    {
                      backgroundColor:
                        sortOrder === 'oldest'
                          ? themeColors.primary
                          : isDark
                          ? themeColors.surfaceSecondary
                          : '#FFFFFF',
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => setSortOrder('oldest')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sortBtnText,
                      {
                        color:
                          sortOrder === 'oldest'
                            ? '#FFFFFF'
                            : themeColors.textSecondary,
                        fontWeight: sortOrder === 'oldest' ? '700' : '500',
                      },
                    ]}
                  >
                    ↑ {t('oldestFirst')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.expandAllBtn,
                  {
                    backgroundColor: isDark ? themeColors.surfaceSecondary : '#FFFFFF',
                    borderColor: themeColors.border,
                  },
                ]}
                onPress={toggleAllExpanded}
                activeOpacity={0.7}
              >
                <Text style={[styles.expandAllText, { color: themeColors.primary }]}>
                  {allExpanded ? t('collapseAll') : t('expandAll')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Timeline List */}
            <FlatList
              data={sortedItems}
              keyExtractor={(item) => item.id}
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
              renderItem={({ item, index }) => {
                const isExpanded = expandedIds.has(item.id);
                const isLast = index === sortedItems.length - 1;
                const dateLabel = formatDate(item.date);

                return (
                  <View style={styles.timelineRow}>
                    {/* Left Column: Timeline Bullet and Connecting Line */}
                    <View style={styles.timelineTrackCol}>
                      <View
                        style={[
                          styles.timelineBullet,
                          {
                            backgroundColor: themeColors.primary,
                            borderColor: isDark ? themeColors.background : '#FFFFFF',
                          },
                        ]}
                      >
                        <View style={styles.timelineBulletInner} />
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: themeColors.border },
                          ]}
                        />
                      )}
                    </View>

                    {/* Right Column: Timeline Card Content */}
                    <View style={styles.timelineCardCol}>
                      {/* Date Header Tag */}
                      <View style={styles.dateHeaderRow}>
                        <Text
                          style={[
                            styles.dateHeaderText,
                            { color: themeColors.primaryDark },
                          ]}
                        >
                          ● {dateLabel}
                        </Text>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor:
                                item.type === 'CONSULTATION'
                                  ? themeColors.primaryLight
                                  : isDark
                                  ? 'rgba(32, 138, 239, 0.2)'
                                  : '#E0F2FE',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              {
                                color:
                                  item.type === 'CONSULTATION'
                                    ? themeColors.primaryDark
                                    : themeColors.accent,
                              },
                            ]}
                          >
                            {item.type === 'CONSULTATION'
                              ? `🩺 ${t('consultation')}`
                              : `📋 ${t('prescription')}`}
                          </Text>
                        </View>
                      </View>

                      {/* Main Card */}
                      <TouchableOpacity
                        style={[
                          styles.cardContainer,
                          {
                            backgroundColor: themeColors.card,
                            borderColor: isExpanded
                              ? themeColors.primary
                              : themeColors.border,
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => toggleExpand(item.id)}
                      >
                        {/* Collapsed Header Summary */}
                        <View style={styles.cardHeader}>
                          <View style={styles.doctorInfoCol}>
                            <Text
                              style={[
                                styles.doctorName,
                                { color: themeColors.textPrimary },
                              ]}
                            >
                              {item.doctor.name}
                            </Text>
                            <Text
                              style={[
                                styles.doctorSub,
                                { color: themeColors.textSecondary },
                              ]}
                            >
                              {item.doctor.specialization}
                              {item.doctor.hospital ? ` • ${item.doctor.hospital}` : ''}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.expandChevron,
                              { color: themeColors.primary },
                            ]}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </Text>
                        </View>

                        {/* Diagnosis pill in collapsed/preview mode */}
                        {item.diagnosis ? (
                          <View
                            style={[
                              styles.diagnosisBox,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(59, 130, 246, 0.12)'
                                  : '#EFF6FF',
                                borderColor: themeColors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.diagLabel,
                                { color: themeColors.textSecondary },
                              ]}
                            >
                              {t('diagnosis')}:
                            </Text>
                            <Text
                              style={[
                                styles.diagValue,
                                { color: themeColors.primaryDark },
                              ]}
                            >
                              {item.diagnosis}
                            </Text>
                          </View>
                        ) : null}

                        {/* Collapsed Mini Badges (Pills) */}
                        {!isExpanded && (
                          <View style={styles.miniBadgesRow}>
                            {item.prescription && item.prescription.medications ? (
                              <View
                                style={[
                                  styles.miniBadge,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(16, 124, 65, 0.2)'
                                      : '#E6F4EA',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.miniBadgeText,
                                    { color: themeColors.success },
                                  ]}
                                >
                                  💊 {item.prescription.medications.length} {t('medications')}
                                </Text>
                              </View>
                            ) : null}

                            {item.adherence ? (
                              <View
                                style={[
                                  styles.miniBadge,
                                  {
                                    backgroundColor: item.adherence.hasEnoughData
                                      ? isDark
                                        ? 'rgba(59, 130, 246, 0.2)'
                                        : '#E0F2FE'
                                      : isDark
                                      ? 'rgba(148, 163, 184, 0.2)'
                                      : '#F1F5F9',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.miniBadgeText,
                                    {
                                      color: item.adherence.hasEnoughData
                                        ? themeColors.primary
                                        : themeColors.textMuted,
                                    },
                                  ]}
                                >
                                  📊 {item.adherence.hasEnoughData
                                    ? `${item.adherence.adherencePercentage}%`
                                    : t('notEnoughAdherenceData')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        )}

                        {/* EXPANDED SECTION */}
                        {isExpanded && (
                          <View style={styles.expandedContent}>
                            {/* Clinical Notes */}
                            {item.clinicalNotes ? (
                              <View
                                style={[
                                  styles.sectionBox,
                                  {
                                    backgroundColor: isDark
                                      ? themeColors.surfaceSecondary
                                      : '#F8FAFC',
                                    borderColor: themeColors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.sectionHeaderLabel,
                                    { color: themeColors.textMuted },
                                  ]}
                                >
                                  📝 {t('clinicalNotes')}
                                </Text>
                                <Text
                                  style={[
                                    styles.notesBody,
                                    { color: themeColors.textPrimary },
                                  ]}
                                >
                                  {item.clinicalNotes}
                                </Text>
                              </View>
                            ) : null}

                            {/* Doctor Recommendations */}
                            {item.recommendations && item.recommendations.length > 0 ? (
                              <View
                                style={[
                                  styles.sectionBox,
                                  {
                                    backgroundColor: isDark
                                      ? themeColors.surfaceSecondary
                                      : '#F8FAFC',
                                    borderColor: themeColors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.sectionHeaderLabel,
                                    { color: themeColors.textMuted },
                                  ]}
                                >
                                  💡 {t('recommendations')}
                                </Text>
                                {item.recommendations.map((rec, rIdx) => (
                                  <Text
                                    key={rIdx}
                                    style={[
                                      styles.recBulletText,
                                      { color: themeColors.textPrimary },
                                    ]}
                                  >
                                    • {rec}
                                  </Text>
                                ))}
                              </View>
                            ) : null}

                            {/* Follow-up Date */}
                            {item.followUpDate ? (
                              <View style={styles.followUpRow}>
                                <Text
                                  style={[
                                    styles.followUpText,
                                    { color: themeColors.accent },
                                  ]}
                                >
                                  📅 {t('followUp')}: {formatDate(item.followUpDate)}
                                </Text>
                              </View>
                            ) : null}

                            {/* Prescribed Medications Section */}
                            {item.prescription &&
                            item.prescription.medications &&
                            item.prescription.medications.length > 0 ? (
                              <View style={styles.prescSection}>
                                <View style={styles.prescHeaderRow}>
                                  <Text
                                    style={[
                                      styles.prescTitle,
                                      { color: themeColors.primaryDark },
                                    ]}
                                  >
                                    💊 {t('prescriptionsTitle')}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.prescCount,
                                      { color: themeColors.textMuted },
                                    ]}
                                  >
                                    ({item.prescription.medications.length})
                                  </Text>
                                </View>

                                {item.prescription.medications.map((med, mIdx) => (
                                  <View
                                    key={mIdx}
                                    style={[
                                      styles.medicineCard,
                                      {
                                        backgroundColor: isDark
                                          ? themeColors.surfaceSecondary
                                          : '#FFFFFF',
                                        borderColor: themeColors.border,
                                      },
                                    ]}
                                  >
                                    <View style={styles.medHeaderRow}>
                                      <Text
                                        style={[
                                          styles.medName,
                                          { color: themeColors.textPrimary },
                                        ]}
                                      >
                                        {med.medicineName}
                                      </Text>
                                      <View
                                        style={[
                                          styles.dosagePill,
                                          { backgroundColor: themeColors.primaryLight },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.dosagePillText,
                                            { color: themeColors.primaryDark },
                                          ]}
                                        >
                                          {med.dosage}
                                        </Text>
                                      </View>
                                    </View>

                                    <Text
                                      style={[
                                        styles.medDetailText,
                                        { color: themeColors.textSecondary },
                                      ]}
                                    >
                                      ⏱ {t('frequency')}: {med.frequency} • {t('duration')}: {med.duration}
                                    </Text>

                                    {med.instructions ? (
                                      <Text
                                        style={[
                                          styles.medInstructions,
                                          { color: themeColors.textMuted },
                                        ]}
                                      >
                                        ℹ️ {t('instructions')}: {med.instructions}
                                      </Text>
                                    ) : null}
                                  </View>
                                ))}
                              </View>
                            ) : null}

                            {/* Medication Adherence Section */}
                            {item.adherence ? (
                              <View
                                style={[
                                  styles.adherenceCard,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(16, 96, 200, 0.1)'
                                      : '#F0F7FF',
                                    borderColor: themeColors.border,
                                  },
                                ]}
                              >
                                <View style={styles.adhHeaderRow}>
                                  <Text
                                    style={[
                                      styles.adhTitle,
                                      { color: themeColors.primaryDark },
                                    ]}
                                  >
                                    📊 {t('medicationAdherence')}
                                  </Text>
                                  {item.adherence.hasEnoughData ? (
                                    <View
                                      style={[
                                        styles.adhPercentPill,
                                        {
                                          backgroundColor:
                                            (item.adherence.adherencePercentage || 0) >= 80
                                              ? themeColors.successLight
                                              : themeColors.warningLight,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.adhPercentText,
                                          {
                                            color:
                                              (item.adherence.adherencePercentage || 0) >= 80
                                                ? themeColors.success
                                                : themeColors.warning,
                                          },
                                        ]}
                                      >
                                        {item.adherence.adherencePercentage}%
                                      </Text>
                                    </View>
                                  ) : (
                                    <View
                                      style={[
                                        styles.adhPercentPill,
                                        {
                                          backgroundColor: isDark
                                            ? 'rgba(148, 163, 184, 0.2)'
                                            : '#E2E8F0',
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.adhPercentText,
                                          { color: themeColors.textMuted },
                                        ]}
                                      >
                                        {t('notEnoughAdherenceData')}
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {/* Adherence Progress Bar */}
                                {item.adherence.hasEnoughData ? (
                                  <View
                                    style={[
                                      styles.progressBarTrack,
                                      { backgroundColor: themeColors.border },
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.progressBarFill,
                                        {
                                          width: `${Math.min(
                                            100,
                                            item.adherence.adherencePercentage || 0
                                          )}%`,
                                          backgroundColor:
                                            (item.adherence.adherencePercentage || 0) >= 80
                                              ? themeColors.success
                                              : themeColors.warning,
                                        },
                                      ]}
                                    />
                                  </View>
                                ) : null}

                                {/* Metrics Breakdown: Taken / Missed / Pending */}
                                <View style={styles.metricsRow}>
                                  <View style={styles.metricItem}>
                                    <Text
                                      style={[
                                        styles.metricNum,
                                        { color: themeColors.success },
                                      ]}
                                    >
                                      {item.adherence.totalTaken}
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

                                  <View style={styles.metricItem}>
                                    <Text
                                      style={[
                                        styles.metricNum,
                                        { color: themeColors.danger },
                                      ]}
                                    >
                                      {item.adherence.totalMissed}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.metricLabel,
                                        { color: themeColors.textSecondary },
                                      ]}
                                    >
                                      {t('missed')}
                                    </Text>
                                  </View>

                                  <View style={styles.metricItem}>
                                    <Text
                                      style={[
                                        styles.metricNum,
                                        { color: themeColors.textMuted },
                                      ]}
                                    >
                                      {item.adherence.totalPending}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.metricLabel,
                                        { color: themeColors.textSecondary },
                                      ]}
                                    >
                                      {t('pending')}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            ) : null}
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  contentWrap: {
    flex: 1,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  sortToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  sortBtnText: {
    fontSize: 12,
  },
  expandAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  expandAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineTrackCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 6,
  },
  timelineBullet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    zIndex: 1,
  },
  timelineBulletInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineCardCol: {
    flex: 1,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dateHeaderText: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '800',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardContainer: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  doctorInfoCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  doctorName: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  doctorSub: {
    ...typography.caption,
    fontSize: 13,
    marginTop: 2,
  },
  expandChevron: {
    fontSize: 13,
    paddingHorizontal: 4,
  },
  diagnosisBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  diagLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  diagValue: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  miniBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedContent: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sectionBox: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  sectionHeaderLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  notesBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  recBulletText: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  followUpRow: {
    marginVertical: 4,
  },
  followUpText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
  },
  prescSection: {
    marginTop: spacing.xs,
  },
  prescHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  prescTitle: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  prescCount: {
    ...typography.caption,
    fontSize: 12,
  },
  medicineCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: 6,
    borderWidth: 1,
  },
  medHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  medName: {
    ...typography.bodyBold,
    fontSize: 14,
    flex: 1,
  },
  dosagePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: 6,
  },
  dosagePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  medDetailText: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  medInstructions: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  adherenceCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
  },
  adhHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  adhTitle: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  adhPercentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  adhPercentText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 1,
  },
});
