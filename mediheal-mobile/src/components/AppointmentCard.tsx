import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Appointment } from '../types/appointment';
import { StatusBadge } from './StatusBadge';
import { AppButton } from './AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { getAppointmentStatusTranslationKey, getSpecializationTranslationKey } from '../utils/displayMappers';
import { useTheme } from '../context/ThemeContext';

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (appointment: Appointment) => void;
  onViewSummary?: (appointment: Appointment) => void;
  cancellingId?: string | null;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onCancel,
  onViewSummary,
  cancellingId,
}) => {
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const doctorNameRaw = appointment.doctorId?.fullName || 'Medical Specialist';
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

  // Format date cleanly e.g., "15 Aug 2026"
  const formatDate = (rawDate: string) => {
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return rawDate;
    }
  };

  const isCancellable =
    (appointment.status === 'pending' || appointment.status === 'confirmed') &&
    !!onCancel;

  const isCompletedWithSummary =
    appointment.status === 'completed' && !!onViewSummary;

  const isCurrentlyCancelling = cancellingId === appointment._id;

  const statusKey = getAppointmentStatusTranslationKey(appointment.status);
  const statusLocalized = t(statusKey).toUpperCase();

  const specKey = getSpecializationTranslationKey(appointment.specialization);
  const specLocalized = typeof specKey === 'string' && specKey in t ? t(specKey as any) : (appointment.specialization || 'Medical Specialist');

  return (
    <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Top Doctor Header Row & Status Badge */}
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

        <StatusBadge
          status={appointment.status}
          label={statusLocalized}
        />
      </View>

      {/* Appointment Meta Details */}
      <View style={[styles.detailsContainer, { borderTopColor: themeColors.border }]}>
        {/* Hospital */}
        {appointment.hospital ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🏥</Text>
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {appointment.hospital}
            </Text>
          </View>
        ) : null}

        {/* Date & Time */}
        <View style={[styles.dateTimeRow, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📅</Text>
            <Text style={[styles.metaVal, { color: themeColors.primary }]}>{formatDate(appointment.appointmentDate)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>⏰</Text>
            <Text style={[styles.metaVal, { color: themeColors.primary }]}>{appointment.timeSlot}</Text>
          </View>
        </View>

        {/* Reason for Visit */}
        {appointment.reason ? (
          <View style={[styles.reasonBox, { backgroundColor: themeColors.surfaceSecondary }]}>
            <Text style={[styles.reasonLabel, { color: themeColors.textMuted }]}>{t('reasonForVisit')}:</Text>
            <Text style={[styles.reasonText, { color: themeColors.textSecondary }]} numberOfLines={2}>
              {appointment.reason}
            </Text>
          </View>
        ) : null}

        {/* Cancellation Reason if Cancelled */}
        {appointment.status === 'cancelled' && appointment.cancellationReason ? (
          <View style={[styles.cancelledBox, { backgroundColor: themeColors.dangerLight }]}>
            <Text style={[styles.cancelledText, { color: themeColors.danger }]}>
              {t('cancelAppointment')}: {appointment.cancellationReason}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action Footer */}
      {isCancellable && (
        <View style={styles.actionFooter}>
          <AppButton
            title={isCurrentlyCancelling ? '...' : t('cancelAppointmentBtn')}
            onPress={() => onCancel && onCancel(appointment)}
            variant="danger"
            disabled={isCurrentlyCancelling}
            style={styles.cancelBtn}
          />
        </View>
      )}

      {isCompletedWithSummary && (
        <View style={styles.actionFooter}>
          <AppButton
            title={t('consultationSummary')}
            onPress={() => onViewSummary && onViewSummary(appointment)}
            variant="secondary"
            style={styles.cancelBtn}
          />
        </View>
      )}
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.subheader,
    fontSize: 16,
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
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
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
  metaVal: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primaryDark,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonBox: {
    marginTop: spacing.xs,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  reasonLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  reasonText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  cancelledBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.dangerLight,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelledText: {
    ...typography.caption,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  actionFooter: {
    marginTop: spacing.md,
  },
  cancelBtn: {
    minHeight: 40,
  },
  summaryBtn: {
    minHeight: 40,
  },
});
