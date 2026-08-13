import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getDoctorPatientHistory } from '../../services/doctorPortalService';
import { DoctorConsultationRecord } from '../../types/doctorPortal';

export default function DoctorPatientHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();

  const [consultations, setConsultations] = useState<DoctorConsultationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

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

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory(true);
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

  if (loading && consultations.length === 0) {
    return <LoadingView message="Loading patient consultation history..." />;
  }

  const patientName =
    consultations.length > 0 &&
    typeof consultations[0].patientId === 'object' &&
    consultations[0].patientId?.fullName
      ? consultations[0].patientId.fullName
      : 'Patient';

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Patient History"
        subtitle={patientName ? `Medical History for ${patientName}` : 'Consultation Records'}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
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
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.diagTitle}>🩺 {item.diagnosis}</Text>
                  <Text style={styles.dateText}>{formatDate(item.createdAt || item.completedAt)}</Text>
                </View>

                {item.clinicalNotes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Clinical Notes:</Text>
                    <Text style={styles.notesText}>{item.clinicalNotes}</Text>
                  </View>
                ) : null}

                {/* Prescriptions */}
                {item.prescriptions && item.prescriptions.length > 0 && (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionLabel}>Prescribed Medications:</Text>
                    {item.prescriptions.map((p, idx) => (
                      <View key={idx} style={styles.pItem}>
                        <Text style={styles.pName}>
                          💊 {p.medicineName} ({p.dosage})
                        </Text>
                        <Text style={styles.pSub}>
                          {p.frequency} • Duration: {p.duration}
                          {p.instructions ? ` • Instructions: ${p.instructions}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Recommendations */}
                {item.recommendations && item.recommendations.length > 0 && (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionLabel}>Doctor Recommendations:</Text>
                    {item.recommendations.map((r, idx) => (
                      <Text key={idx} style={styles.recItem}>
                        • {r}
                      </Text>
                    ))}
                  </View>
                )}

                {item.followUpDate ? (
                  <Text style={styles.followUpText}>
                    📅 Follow-up Scheduled: {formatDate(item.followUpDate)}
                  </Text>
                ) : null}
              </View>
            )}
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
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  diagTitle: {
    ...typography.header,
    fontSize: 17,
    color: colors.primaryDark,
    fontWeight: '800',
    flex: 1,
  },
  dateText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  notesText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 20,
  },
  sectionWrap: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  pItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pName: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.primaryDark,
  },
  pSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  recItem: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  followUpText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    marginTop: spacing.xs,
  },
});
