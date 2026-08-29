import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Switch, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { MedicationCard } from '../../components/MedicationCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getMyMedications, getMyMedicationLogs, markMedicationTaken } from '../../services/medicationService';
import { Medication, MedicationLog } from '../../types/medication';
import {
  initNotificationHandler,
  getRemindersEnabledPreference,
  setRemindersEnabledPreference,
  requestNotificationPermission,
  synchronizeMedicationReminders,
  cancelMedicationReminders,
  setupNotificationResponseListener,
} from '../../services/notificationService';

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

export default function PatientMedicationsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(false);
  const [togglingReminders, setTogglingReminders] = useState<boolean>(false);

  // Compute local today YYYY-MM-DD string without UTC shifts
  const todayIso = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Initialize notification handler & response listener on mount
  useEffect(() => {
    initNotificationHandler();
    const cleanupListener = setupNotificationResponseListener(() => {
      router.push('/(patient)/medications' as any);
    });
    return () => {
      cleanupListener();
    };
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [medsRes, logsRes, pref] = await Promise.all([
        getMyMedications(),
        getMyMedicationLogs().catch(() => null),
        getRemindersEnabledPreference(),
      ]);

      setRemindersEnabled(pref);

      if (medsRes && medsRes.success) {
        const activeMeds = medsRes.data || [];
        setMedications(activeMeds);
        // Automatically sync reminders if enabled
        if (pref) {
          await synchronizeMedicationReminders(activeMeds);
        }
      } else {
        setErrorMsg('Failed to load medications.');
      }

      if (logsRes && logsRes.success) {
        setLogs(logsRes.data || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve medication schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleToggleReminders = async (val: boolean) => {
    setTogglingReminders(true);
    try {
      if (val) {
        // Request permission
        const granted = await requestNotificationPermission();
        if (granted) {
          await setRemindersEnabledPreference(true);
          setRemindersEnabled(true);
          const syncRes = await synchronizeMedicationReminders(medications);
          Alert.alert(
            'Medication Reminders ON',
            `Local dose notifications enabled successfully. (${syncRes.scheduledCount} reminder(s) scheduled)`
          );
        } else {
          await setRemindersEnabledPreference(false);
          setRemindersEnabled(false);
          Alert.alert(
            'Notification Permission Required',
            'Medication tracking works without notifications, but dose reminders require notification permissions to be granted in your device settings.'
          );
        }
      } else {
        await cancelMedicationReminders();
        await setRemindersEnabledPreference(false);
        setRemindersEnabled(false);
        Alert.alert(
          'Medication Reminders OFF',
          'Scheduled local medication alerts have been cancelled.'
        );
      }
    } catch (err: any) {
      Alert.alert('Reminder Configuration Error', err.message || 'Failed to update reminder preference.');
    } finally {
      setTogglingReminders(false);
    }
  };

  const handleMarkTaken = async (medication: Medication, timeSlot: string) => {
    const key = `${medication._id}_${timeSlot}`;
    setMarkingKey(key);

    try {
      const res = await markMedicationTaken(medication._id, {
        scheduledDate: todayIso,
        scheduledTime: timeSlot.trim(),
      });

      if (res && res.success) {
        Alert.alert(
          'Dose Marked Taken',
          `Successfully recorded dose for ${medication.medicineName} at ${timeSlot}.`
        );
        // Refresh logs
        const refreshedLogs = await getMyMedicationLogs().catch(() => null);
        if (refreshedLogs && refreshedLogs.success) {
          setLogs(refreshedLogs.data || []);
        }
      } else {
        Alert.alert('Error', res.message || 'Failed to mark dose as taken.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'An error occurred while marking dose.';
      if (errMsg.toLowerCase().includes('already')) {
        Alert.alert(
          'Dose Already Marked',
          'This medication dose has already been marked as taken today.'
        );
        // Refresh logs to stay sync
        fetchData();
      } else if (errMsg.toLowerCase().includes('outside')) {
        Alert.alert(
          'Schedule Date Error',
          'Scheduled date is outside the active medication period for this prescription.'
        );
      } else if (errMsg.toLowerCase().includes('inactive')) {
        Alert.alert(
          'Medication Inactive',
          'This medication is no longer active in your care plan.'
        );
      } else {
        Alert.alert('Action Failed', errMsg);
      }
    } finally {
      setMarkingKey(null);
    }
  };

  // Compute adherence stats from real logs
  const adherenceStats = useMemo(() => {
    const taken = logs.filter((l) => l.status === 'taken').length;
    const missed = logs.filter((l) => l.status === 'missed').length;
    const total = logs.length;
    const evaluable = taken + missed;

    let percentage: number | null = null;
    if (evaluable > 0) {
      percentage = Math.round((taken / evaluable) * 100);
    }

    return { taken, missed, total, percentage };
  }, [logs]);

  if (loading && medications.length === 0) {
    return <LoadingView message="Loading your medications..." />;
  }

  const isEmpty = medications.length === 0;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('medications')}
        subtitle={t('medicationReminders')}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchData} />
        ) : null}

        {!errorMsg && isEmpty && (
          <EmptyState
            icon="💊"
            title={t('noActiveMedications')}
            description={t('manageDoseNotifications')}
          />
        )}

        {!errorMsg && !isEmpty && (
          <FlatList
            data={medications}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <MedicationCard
                medication={item}
                todayLogs={logs}
                todayIso={todayIso}
                onMarkTaken={handleMarkTaken}
                markingKey={markingKey}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.headerComponent}>
                {/* Medication Reminders Settings Card */}
                <View style={[styles.reminderCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <View style={styles.reminderTextCol}>
                    <Text style={[styles.reminderTitle, { color: themeColors.textPrimary }]}>
                      Medication Reminders: {remindersEnabled ? 'ON' : 'OFF'}
                    </Text>
                    <Text style={[styles.reminderSub, { color: themeColors.textSecondary }]}>
                      {remindersEnabled
                        ? 'Local push alerts will remind you at dose times.'
                        : 'Enable alerts to get local dose notifications.'}
                    </Text>
                  </View>
                  <Switch
                    value={remindersEnabled}
                    onValueChange={handleToggleReminders}
                    disabled={togglingReminders}
                    trackColor={{ false: themeColors.border, true: themeColors.primaryLight }}
                    thumbColor={remindersEnabled ? themeColors.primary : '#f4f3f4'}
                  />
                </View>

                {/* Adherence Summary Box */}
                <View style={[styles.adherenceCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <View style={styles.adherenceTextCol}>
                    <Text style={[styles.adherenceTitle, { color: themeColors.textPrimary }]}>Today's Adherence</Text>
                    {adherenceStats.percentage !== null ? (
                      <Text style={[styles.adherenceVal, { color: themeColors.primary }]}>
                        {adherenceStats.percentage}% Logged Compliance
                      </Text>
                    ) : (
                      <Text style={[styles.adherenceSub, { color: themeColors.textSecondary }]}>
                        Not enough adherence data recorded yet
                      </Text>
                    )}
                  </View>

                  <View style={styles.statsBadgeRow}>
                    <View style={[styles.statPill, { backgroundColor: themeColors.surfaceSecondary }]}>
                      <Text style={[styles.statPillVal, { color: themeColors.primary }]}>{adherenceStats.taken}</Text>
                      <Text style={[styles.statPillLbl, { color: themeColors.textSecondary }]}>Taken</Text>
                    </View>
                    {adherenceStats.missed > 0 && (
                      <View style={[styles.statPill, styles.statPillMissed, { backgroundColor: themeColors.dangerLight }]}>
                        <Text style={[styles.statPillVal, { color: themeColors.danger }]}>
                          {adherenceStats.missed}
                        </Text>
                        <Text style={[styles.statPillLbl, { color: themeColors.danger }]}>Missed</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.sectionHeaderTitle}>Active Prescriptions ({medications.length})</Text>
              </View>
            }
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
  headerComponent: {
    marginBottom: spacing.xs,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.card,
  },
  reminderTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  reminderTitle: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.primaryDark,
  },
  reminderSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
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
  adherenceTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  adherenceTitle: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  adherenceVal: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.success,
    fontWeight: '800',
    marginTop: 2,
  },
  adherenceSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statsBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statPill: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  statPillMissed: {
    backgroundColor: colors.dangerLight,
  },
  statPillVal: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.success,
  },
  statPillLbl: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
  sectionHeaderTitle: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
