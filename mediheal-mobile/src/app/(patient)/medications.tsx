import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
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

export default function PatientMedicationsScreen() {
  const router = useRouter();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [markingKey, setMarkingKey] = useState<string | null>(null);

  // Compute local today YYYY-MM-DD string without UTC shifts
  const todayIso = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const [medsRes, logsRes] = await Promise.all([
        getMyMedications(),
        getMyMedicationLogs().catch(() => null),
      ]);

      if (medsRes && medsRes.success) {
        setMedications(medsRes.data || []);
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
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="My Medications"
        subtitle="Daily Schedule & Dose Tracker"
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchData} />
        ) : null}

        {!errorMsg && isEmpty && (
          <EmptyState
            icon="💊"
            title="No Active Medications"
            description="Medications added to your care plan by your linked caregiver will appear here."
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
                {/* Adherence Summary Box */}
                <View style={styles.adherenceCard}>
                  <View style={styles.adherenceTextCol}>
                    <Text style={styles.adherenceTitle}>Today's Adherence</Text>
                    {adherenceStats.percentage !== null ? (
                      <Text style={styles.adherenceVal}>
                        {adherenceStats.percentage}% Logged Compliance
                      </Text>
                    ) : (
                      <Text style={styles.adherenceSub}>
                        Not enough adherence data recorded yet
                      </Text>
                    )}
                  </View>

                  <View style={styles.statsBadgeRow}>
                    <View style={styles.statPill}>
                      <Text style={styles.statPillVal}>{adherenceStats.taken}</Text>
                      <Text style={styles.statPillLbl}>Taken</Text>
                    </View>
                    {adherenceStats.missed > 0 && (
                      <View style={[styles.statPill, styles.statPillMissed]}>
                        <Text style={[styles.statPillVal, { color: colors.danger }]}>
                          {adherenceStats.missed}
                        </Text>
                        <Text style={styles.statPillLbl}>Missed</Text>
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
