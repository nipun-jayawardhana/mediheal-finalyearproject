import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DoctorProfile } from '../types/doctor';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { AppButton } from './AppButton';
import { useLanguage } from '../context/LanguageContext';
import { getSpecializationTranslationKey } from '../utils/displayMappers';
import { useTheme } from '../context/ThemeContext';

interface DoctorCardProps {
  doctor: DoctorProfile;
  onPress: () => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onPress }) => {
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const rawName = doctor.userId?.fullName || 'Medical Specialist';
  const doctorName = rawName.toLowerCase().startsWith('dr.')
    ? rawName
    : `Dr. ${rawName}`;

  // Generate initials for avatar placeholder
  const initials = rawName
    .replace(/^dr\.\s*/i, '')
    .trim()
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'DR';

  // Availability summary text
  const availableSlotsCount = doctor.availableTimeSlots?.length || 0;
  const availableDaysText = doctor.availableDays?.join(', ') || '';

  const specKey = getSpecializationTranslationKey(doctor.specialization);
  const specLocalized = typeof specKey === 'string' && specKey in t ? t(specKey as any) : doctor.specialization;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Top Header Row with Avatar & Name Info */}
      <View style={styles.headerRow}>
        <View style={[styles.avatarCircle, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]}>
          <Text style={[styles.avatarText, { color: themeColors.primary }]}>{initials}</Text>
        </View>

        <View style={styles.headerTextCol}>
          <Text style={[styles.doctorName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {doctorName}
          </Text>
          
          <Text style={[styles.specialization, { color: themeColors.primary }]} numberOfLines={1}>
            {specLocalized}
          </Text>

          {doctor.slmcNumber ? (
            <Text style={[styles.slmcText, { color: themeColors.textMuted }]}>{t('slmcNumber')}: {doctor.slmcNumber}</Text>
          ) : null}
        </View>
      </View>

      {/* Doctor Meta Info */}
      <View style={[styles.metaContainer, { borderTopColor: themeColors.border }]}>
        {/* Hospital Location */}
        {doctor.hospital ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🏥</Text>
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {doctor.hospital}
              {doctor.location ? `, ${doctor.location}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Experience & Fee */}
        <View style={styles.statsRow}>
          {doctor.yearsOfExperience > 0 ? (
            <View style={[styles.statBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
              <Text style={styles.statIcon}>👨‍⚕️</Text>
              <Text style={[styles.statText, { color: themeColors.textPrimary }]}>
                {doctor.yearsOfExperience} {t('yearsExp')}
              </Text>
            </View>
          ) : null}

          <View style={[styles.statBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
            <Text style={styles.statIcon}>💵</Text>
            <Text style={[styles.statText, { color: themeColors.textPrimary }]}>
              LKR {doctor.consultationFee ? doctor.consultationFee.toLocaleString() : '0'}
            </Text>
          </View>
        </View>

        {/* Availability Badge */}
        <View style={styles.availabilityRow}>
          {doctor.isAvailable ? (
            <View style={[styles.availBadge, { backgroundColor: themeColors.successLight }]}>
              <View style={[styles.activeDot, { backgroundColor: themeColors.success }]} />
              <Text style={[styles.availTextActive, { color: themeColors.success }]}>
                {availableSlotsCount > 0
                  ? `${t('available')} (${availableSlotsCount})`
                  : t('available')}
              </Text>
            </View>
          ) : (
            <View style={[styles.availBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
              <View style={[styles.inactiveDot, { backgroundColor: themeColors.textMuted }]} />
              <Text style={[styles.availTextInactive, { color: themeColors.textMuted }]}>{t('currentlyUnavailable')}</Text>
            </View>
          )}

          {availableDaysText ? (
            <Text style={[styles.availableDaysText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {availableDaysText}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actionRow}>
        <AppButton
          title={t('viewDetails')}
          onPress={onPress}
          variant="primary"
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.subheader,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  headerTextCol: {
    flex: 1,
  },
  doctorName: {
    ...typography.subheader,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  specialization: {
    ...typography.bodyBold,
    color: colors.primary,
    marginTop: 2,
  },
  slmcText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  metaContainer: {
    marginVertical: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  metaIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginRight: spacing.xs,
  },
  statIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  availBadgeActive: {
    backgroundColor: colors.successLight,
  },
  availBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    marginRight: 6,
  },
  availTextActive: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.success,
  },
  availTextInactive: {
    ...typography.caption,
    color: colors.textMuted,
  },
  availableDaysText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionRow: {
    marginTop: spacing.md,
  },
  actionBtn: {
    minHeight: 44,
  },
});
