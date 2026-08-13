import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Consultation } from '../types/consultation';
import { AppButton } from './AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';

interface ConsultationCardProps {
  consultation: Consultation;
  onPress: () => void;
}

export const ConsultationCard: React.FC<ConsultationCardProps> = ({
  consultation,
  onPress,
}) => {
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
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return String(rawDate);
    }
  };

  const completedDateStr = formatDate(consultation.completedAt || consultation.createdAt);
  const followUpDateStr = formatDate(consultation.followUpDate);

  return (
    <View style={styles.card}>
      {/* Header Row: Doctor Avatar & Identity */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.headerTextCol}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {doctorName}
          </Text>
          {consultation.specialization ? (
            <Text style={styles.specializationText} numberOfLines={1}>
              {consultation.specialization}
            </Text>
          ) : (
            <Text style={styles.specializationText}>Medical Consultation</Text>
          )}
        </View>

        {completedDateStr ? (
          <Text style={styles.dateText}>{completedDateStr}</Text>
        ) : null}
      </View>

      {/* Diagnosis Banner */}
      <View style={styles.diagnosisBox}>
        <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
        <Text style={styles.diagnosisTitle} numberOfLines={2}>
          {consultation.diagnosis}
        </Text>
      </View>

      {/* Prescriptions & Follow-up Summary */}
      <View style={styles.metaRow}>
        {consultation.prescriptions && consultation.prescriptions.length > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              💊 {consultation.prescriptions.length} Prescribed Med(s)
            </Text>
          </View>
        ) : null}

        {followUpDateStr ? (
          <View style={[styles.badge, styles.followUpBadge]}>
            <Text style={styles.followUpBadgeText}>
              📅 Follow-up: {followUpDateStr}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action Footer */}
      <View style={styles.actionFooter}>
        <AppButton
          title="View Summary"
          onPress={onPress}
          variant="outline"
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.subheader,
    fontSize: 15,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  headerTextCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  doctorName: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  specializationText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  dateText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  diagnosisBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  diagnosisLabel: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  diagnosisTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  badge: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  followUpBadge: {
    backgroundColor: colors.infoLight,
  },
  followUpBadgeText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.info,
  },
  actionFooter: {
    marginTop: spacing.sm,
  },
  actionBtn: {
    minHeight: 40,
  },
});
