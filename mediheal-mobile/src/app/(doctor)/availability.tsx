import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getDoctorAvailabilityApi,
  updateDoctorAvailabilityApi,
} from '../../services/appointmentService';
import {
  DoctorWeeklyAvailabilityDay,
} from '../../types/appointment';

const DAYS: Array<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'> = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const SLOT_DURATIONS = [15, 20, 30, 45, 60];

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00',
];

export default function DoctorAvailabilityScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [defaultSlotDuration, setDefaultSlotDuration] = useState<number>(30);
  const [weeklySchedule, setWeeklySchedule] = useState<DoctorWeeklyAvailabilityDay[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>('Monday');

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getDoctorAvailabilityApi();
      if (res && res.success && res.data) {
        setDefaultSlotDuration(res.data.defaultSlotDuration || 30);
        
        // Ensure all 7 days exist
        const fetched = res.data.weeklyAvailability || [];
        const fullWeek = DAYS.map((d) => {
          const found = fetched.find((w) => w.dayOfWeek.toLowerCase() === d.toLowerCase());
          if (found) {
            return {
              dayOfWeek: d,
              startTime: found.startTime || '09:00',
              endTime: found.endTime || '17:00',
              enabled: found.enabled !== false,
              slotDuration: found.slotDuration || 30,
            };
          }
          return {
            dayOfWeek: d,
            startTime: '09:00',
            endTime: d === 'Saturday' || d === 'Sunday' ? '13:00' : '17:00',
            enabled: d !== 'Saturday' && d !== 'Sunday',
            slotDuration: 30,
          };
        });

        setWeeklySchedule(fullWeek);
      } else {
        setErrorMsg('Failed to load doctor availability');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve availability schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handleToggleDay = (day: string) => {
    setWeeklySchedule((prev) =>
      prev.map((item) =>
        item.dayOfWeek === day ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleUpdateTime = (day: string, field: 'startTime' | 'endTime', value: string) => {
    setWeeklySchedule((prev) =>
      prev.map((item) => {
        if (item.dayOfWeek === day) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleUpdateSlotDuration = (day: string, duration: number) => {
    setWeeklySchedule((prev) =>
      prev.map((item) => {
        if (item.dayOfWeek === day) {
          return { ...item, slotDuration: duration };
        }
        return item;
      })
    );
  };

  const handleSave = async () => {
    // Validate each enabled day: startTime < endTime
    for (const item of weeklySchedule) {
      if (item.enabled) {
        const [startH, startM] = item.startTime.split(':').map(Number);
        const [endH, endM] = item.endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        if (startMin >= endMin) {
          Alert.alert(
            'Invalid Schedule',
            `${item.dayOfWeek}: ${t('startTime')} (${item.startTime}) must be earlier than ${t('endTime')} (${item.endTime}).`
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await updateDoctorAvailabilityApi({
        weeklyAvailability: weeklySchedule,
        defaultSlotDuration,
      });

      if (res && res.success) {
        Alert.alert(
          t('saveAvailability'),
          'Your weekly availability and slot durations have been saved successfully.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Save Failed', res.message || 'Unable to update availability.');
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Error occurred while saving availability.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading doctor availability..." />;
  }

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title={t('doctorAvailability')}
        subtitle="Weekly Schedule & Slot Settings"
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchAvailability} />
        ) : null}

        {/* Global Slot Duration Selector */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            {t('slotDuration')}
          </Text>
          <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
            Standard consultation appointment length for booking
          </Text>

          <View style={styles.durationRow}>
            {SLOT_DURATIONS.map((dur) => {
              const isSelected = defaultSlotDuration === dur;
              return (
                <TouchableOpacity
                  key={dur}
                  style={[
                    styles.durationChip,
                    {
                      backgroundColor: isSelected ? themeColors.primary : themeColors.surfaceSecondary,
                      borderColor: isSelected ? themeColors.primary : themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    setDefaultSlotDuration(dur);
                    // Also update any days that don't have custom override
                    setWeeklySchedule((prev) =>
                      prev.map((d) => ({ ...d, slotDuration: dur }))
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${dur} minutes`}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                    ]}
                  >
                    {dur}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Weekly Schedule Days List */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Weekly Days & Hours
          </Text>
          <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
            Enable working days and set start and end consultation hours
          </Text>

          {weeklySchedule.map((item) => {
            const isExpanded = expandedDay === item.dayOfWeek;
            return (
              <View
                key={item.dayOfWeek}
                style={[
                  styles.dayBlock,
                  {
                    backgroundColor: themeColors.surfaceSecondary,
                    borderColor: item.enabled ? themeColors.primary : themeColors.border,
                  },
                ]}
              >
                {/* Day Header Row */}
                <TouchableOpacity
                  style={styles.dayHeaderRow}
                  activeOpacity={0.7}
                  onPress={() => setExpandedDay(isExpanded ? null : item.dayOfWeek)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.dayOfWeek} ${item.enabled ? t('dayEnabled') : t('dayDisabled')}`}
                >
                  <View style={styles.dayTitleGroup}>
                    <Text
                      style={[
                        styles.dayNameText,
                        { color: item.enabled ? themeColors.textPrimary : themeColors.textMuted },
                      ]}
                    >
                      {item.dayOfWeek}
                    </Text>
                    <Text
                      style={[
                        styles.dayStatusBadge,
                        {
                          color: item.enabled ? themeColors.success : themeColors.textMuted,
                          backgroundColor: item.enabled ? themeColors.successLight : 'transparent',
                        },
                      ]}
                    >
                      {item.enabled ? t('dayEnabled') : t('dayDisabled')}
                    </Text>
                  </View>

                  <View style={styles.dayActionGroup}>
                    <Switch
                      value={item.enabled}
                      onValueChange={() => handleToggleDay(item.dayOfWeek)}
                      trackColor={{ false: themeColors.border, true: themeColors.primaryLight }}
                      thumbColor={item.enabled ? themeColors.primary : '#F4F3F4'}
                      accessibilityLabel={`Toggle ${item.dayOfWeek}`}
                    />
                    <Text style={[styles.expandIcon, { color: themeColors.textSecondary }]}>
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Time Pickers */}
                {isExpanded && item.enabled && (
                  <View style={[styles.dayDetailsBox, { borderTopColor: themeColors.border }]}>
                    {/* Start Time Selector */}
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                      {t('startTime')}: <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>{item.startTime}</Text>
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.timeScroll}
                    >
                      {TIME_OPTIONS.map((timeStr) => {
                        const isSelected = item.startTime === timeStr;
                        return (
                          <TouchableOpacity
                            key={timeStr}
                            style={[
                              styles.timeChip,
                              {
                                backgroundColor: isSelected ? themeColors.primary : themeColors.card,
                                borderColor: isSelected ? themeColors.primary : themeColors.border,
                              },
                            ]}
                            onPress={() => handleUpdateTime(item.dayOfWeek, 'startTime', timeStr)}
                            accessibilityRole="button"
                            accessibilityLabel={`Start time ${timeStr}`}
                          >
                            <Text
                              style={[
                                styles.timeChipText,
                                { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                              ]}
                            >
                              {timeStr}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* End Time Selector */}
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: spacing.sm }]}>
                      {t('endTime')}: <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>{item.endTime}</Text>
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.timeScroll}
                    >
                      {TIME_OPTIONS.map((timeStr) => {
                        const isSelected = item.endTime === timeStr;
                        return (
                          <TouchableOpacity
                            key={timeStr}
                            style={[
                              styles.timeChip,
                              {
                                backgroundColor: isSelected ? themeColors.primary : themeColors.card,
                                borderColor: isSelected ? themeColors.primary : themeColors.border,
                              },
                            ]}
                            onPress={() => handleUpdateTime(item.dayOfWeek, 'endTime', timeStr)}
                            accessibilityRole="button"
                            accessibilityLabel={`End time ${timeStr}`}
                          >
                            <Text
                              style={[
                                styles.timeChipText,
                                { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                              ]}
                            >
                              {timeStr}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Custom Slot Duration for this day */}
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: spacing.sm }]}>
                      {t('slotDuration')}:
                    </Text>
                    <View style={styles.dayDurationRow}>
                      {SLOT_DURATIONS.map((dur) => {
                        const isSelected = (item.slotDuration || defaultSlotDuration) === dur;
                        return (
                          <TouchableOpacity
                            key={dur}
                            style={[
                              styles.dayDurationChip,
                              {
                                backgroundColor: isSelected ? themeColors.primary : themeColors.card,
                                borderColor: isSelected ? themeColors.primary : themeColors.border,
                              },
                            ]}
                            onPress={() => handleUpdateSlotDuration(item.dayOfWeek, dur)}
                            accessibilityRole="button"
                            accessibilityLabel={`${dur} minutes`}
                          >
                            <Text
                              style={[
                                styles.dayDurationText,
                                { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                              ]}
                            >
                              {dur}m
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <AppButton
            title={saving ? 'Saving...' : t('saveAvailability')}
            onPress={handleSave}
            variant="primary"
            disabled={saving}
            style={styles.saveBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    ...typography.caption,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  durationChip: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  durationChipText: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  dayBlock: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  dayHeaderRow: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dayTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayNameText: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  dayStatusBadge: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  dayActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expandIcon: {
    fontSize: 12,
    paddingHorizontal: 4,
  },
  dayDetailsBox: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  fieldLabel: {
    ...typography.caption,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  timeScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  timeChip: {
    minWidth: 64,
    height: 48,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
  },
  timeChipText: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  dayDurationRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dayDurationChip: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dayDurationText: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  saveSection: {
    marginTop: spacing.sm,
  },
  saveBtn: {
    width: '100%',
    minHeight: 50,
  },
});
