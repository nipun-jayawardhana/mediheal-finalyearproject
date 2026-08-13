import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getConsultationById } from '../../services/consultationService';
import { Consultation } from '../../types/consultation';

export default function ConsultationSummaryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchConsultation = useCallback(async () => {
    if (!id) {
      setErrorMsg('No consultation ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getConsultationById(id);
      if (res && res.success && res.data) {
        setConsultation(res.data);
      } else {
        setErrorMsg('Consultation summary not found.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve consultation details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConsultation();
  }, [fetchConsultation]);

  if (loading) {
    return <LoadingView message="Loading consultation summary..." />;
  }

  if (errorMsg || !consultation) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Consultation Summary" onBackPress={() => router.back()} />
        <ErrorView
          message={errorMsg || 'Consultation details unavailable.'}
          onRetry={fetchConsultation}
        />
      </ScreenContainer>
    );
  }

  const doctorNameRaw = consultation.doctorId?.fullName || 'Medical Specialist';
  const doctorName = doctorNameRaw.toLowerCase().startsWith('dr.')
    ? doctorNameRaw
    : `Dr. ${doctorNameRaw}`;

  const initials = doctorNameRaw
    .replace(/^dr\.\s*/i, '')
    .trim()
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'DR';

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

  const completedDateStr = formatDate(consultation.completedAt || consultation.createdAt);
  const followUpDateStr = formatDate(consultation.followUpDate);

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader title="Consultation Summary" onBackPress={() => router.back()} />

      <View style={styles.container}>
        {/* Doctor Identity Header Card */}
        <View style={styles.doctorCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.doctorName}>{doctorName}</Text>
          
          {consultation.specialization ? (
            <Text style={styles.specializationBadge}>
              {consultation.specialization.toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.specializationBadge}>GENERAL PHYSICIAN</Text>
          )}

          {completedDateStr ? (
            <View style={styles.dateRow}>
              <Text style={styles.dateIcon}>📅</Text>
              <Text style={styles.dateText}>{completedDateStr}</Text>
            </View>
          ) : null}
        </View>

        {/* Diagnosis Hero Banner */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderIcon}>📊</Text>
          <Text style={styles.sectionHeaderText}>Diagnosis</Text>
        </View>

        <View style={styles.diagnosisHeroCard}>
          <Text style={styles.diagnosisTitle}>{consultation.diagnosis}</Text>
        </View>

        {/* Clinical / Doctor's Notes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderIcon}>📑</Text>
          <Text style={styles.sectionHeaderText}>Doctor's Notes</Text>
        </View>

        <View style={styles.cardBox}>
          <Text style={styles.bodyText}>
            {consultation.clinicalNotes || 'No clinical notes provided for this consultation.'}
          </Text>
        </View>

        {/* Prescribed Medications Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderIcon}>💊</Text>
          <Text style={styles.sectionHeaderText}>Prescribed Medications</Text>
        </View>

        {consultation.prescriptions && consultation.prescriptions.length > 0 ? (
          <View style={styles.prescriptionList}>
            {consultation.prescriptions.map((item, idx) => (
              <View key={idx} style={styles.prescriptionCard}>
                <View style={styles.prescriptionTextCol}>
                  <Text style={styles.medicineName}>
                    {item.medicineName} {item.dosage ? `(${item.dosage})` : ''}
                  </Text>
                  
                  <Text style={styles.medicineDetails}>
                    {item.frequency} • {item.duration}
                  </Text>

                  {item.instructions ? (
                    <Text style={styles.medicineInstructions}>
                      Instructions: {item.instructions}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.prescribedCheckCircle}>
                  <Text style={styles.prescribedCheckIcon}>✓</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cardBox}>
            <Text style={styles.bodyText}>
              No prescribed medications for this consultation.
            </Text>
          </View>
        )}

        {/* Recommendations Section */}
        {consultation.recommendations && consultation.recommendations.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderIcon}>💡</Text>
              <Text style={styles.sectionHeaderText}>Recommendations</Text>
            </View>

            <View style={styles.recommendationsCard}>
              {consultation.recommendations.map((rec, idx) => (
                <View key={idx} style={styles.recommendationItem}>
                  <Text style={styles.recBullet}>•</Text>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Follow-up Date Banner */}
        {followUpDateStr ? (
          <View style={styles.followUpBanner}>
            <Text style={styles.followUpIcon}>📅</Text>
            <View style={styles.followUpTextCol}>
              <Text style={styles.followUpTitle}>Follow-up Recommended</Text>
              <Text style={styles.followUpSub}>
                Scheduled for <Text style={styles.followUpHighlight}>{followUpDateStr}</Text>
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xl,
  },
  doctorCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    ...typography.title,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  doctorName: {
    ...typography.header,
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  specializationBadge: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  dateIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionHeaderIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  sectionHeaderText: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
  },
  diagnosisHeroCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.xs,
    ...shadows.card,
  },
  diagnosisTitle: {
    ...typography.header,
    color: colors.textWhite,
    fontSize: 20,
    fontWeight: '700',
  },
  cardBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  prescriptionList: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  prescriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  prescriptionTextCol: {
    flex: 1,
  },
  medicineName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  medicineDetails: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medicineInstructions: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  prescribedCheckCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.successLight,
    borderWidth: 1.5,
    borderColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  prescribedCheckIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.success,
  },
  recommendationsCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: spacing.xs,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  recBullet: {
    fontSize: 16,
    color: colors.success,
    marginRight: spacing.sm,
    fontWeight: '800',
  },
  recText: {
    ...typography.body,
    color: '#065F46',
    flex: 1,
    lineHeight: 22,
    fontWeight: '500',
  },
  followUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.info,
  },
  followUpIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  followUpTextCol: {
    flex: 1,
  },
  followUpTitle: {
    ...typography.bodyBold,
    color: colors.info,
  },
  followUpSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  followUpHighlight: {
    fontWeight: '700',
    color: colors.info,
  },
});
