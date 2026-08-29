import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Consultation } from '../types/consultation';
import { AppButton } from './AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { getSpecializationTranslationKey } from '../utils/displayMappers';
import { useTheme } from '../context/ThemeContext';

interface ConsultationCardProps {
  consultation: Consultation;
  onPress: () => void;
}

export const ConsultationCard: React.FC<ConsultationCardProps> = ({
  consultation,
  onPress,
}) => {
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

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

  const specKey = getSpecializationTranslationKey(consultation.specialization);
  const specLocalized = typeof specKey === 'string' && specKey in t ? t(specKey as any) : (consultation.specialization || t('medicalConsultation'));

  return (
    <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Header Row: Doctor Avatar & Identity */}
      <View style={styles.headerRow}>
        <View style={[styles.avatarCircle, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]}>
          <Text style={[styles.avatarText, { color: themeColors.primary }]}>{initials}</Text>
        </View>

        <View style={styles.headerTextCol}>
          <Text style={[styles.doctorName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {doctorName}
          </Text>
          <Text style={[styles.specializationText, { color: themeColors.primary }]} numberOfLines={1}>
            {specLocalized}
          </Text>
        </View>

        {completedDateStr ? (
          <Text style={[styles.dateText, { color: themeColors.textMuted }]}>{completedDateStr}</Text>
        ) : null}
      </View>

      {/* Diagnosis Banner */}
      <View style={[styles.diagnosisBox, { backgroundColor: themeColors.primaryLight, borderLeftColor: themeColors.primary }]}>
        <Text style={[styles.diagnosisLabel, { color: themeColors.primaryDark }]}>{t('diagnosis').toUpperCase()}</Text>
        <Text style={[styles.diagnosisTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
          {consultation.diagnosis}
        </Text>
      </View>

      {/* Prescriptions & Follow-up Summary */}
      <View style={styles.metaRow}>
        {consultation.prescriptions && consultation.prescriptions.length > 0 ? (
          <View style={[styles.badge, { backgroundColor: themeColors.surfaceSecondary }]}>
            <Text style={[styles.badgeText, { color: themeColors.textSecondary }]}>
              💊 {consultation.prescriptions.length} {t('prescribedMeds')}
            </Text>
          </View>
        ) : null}

        {followUpDateStr ? (
          <View style={[styles.badge, styles.followUpBadge, { backgroundColor: themeColors.infoLight }]}>
            <Text style={[styles.followUpBadgeText, { color: themeColors.info }]}>
              📅 {t('followUp')}: {followUpDateStr}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action Footer */}
      <View style={styles.actionFooter}>
        <AppButton
          title={t('viewSummary')}
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
