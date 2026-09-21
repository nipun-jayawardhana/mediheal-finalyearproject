import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AdminDoctor } from '../types/admin';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface AdminDoctorCardProps {
  doctor: AdminDoctor;
  onEdit: (doctor: AdminDoctor) => void;
  onToggleStatus: (doctor: AdminDoctor) => void;
}

export const AdminDoctorCard: React.FC<AdminDoctorCardProps> = ({
  doctor,
  onEdit,
  onToggleStatus,
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const doctorName = doctor.userId?.fullName
    ? doctor.userId.fullName.startsWith('Dr.')
      ? doctor.userId.fullName
      : `Dr. ${doctor.userId.fullName}`
    : 'Doctor';

  const initials =
    doctor.userId?.fullName
      .replace(/^Dr\.\s*/i, '')
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'DOC';

  const isUserActive = doctor.userId?.isActive !== false;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: themeColors.card, borderColor: themeColors.border },
      ]}
    >
      {/* Top Doctor Info Row */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.avatarCircle,
            {
              backgroundColor: themeColors.primaryLight,
              borderColor: themeColors.primary,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: themeColors.primaryDark }]}>{initials}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={[styles.doctorName, { color: themeColors.textPrimary }]}>{doctorName}</Text>
          <Text style={[styles.specializationText, { color: themeColors.primary }]}>
            🩺 {doctor.specialization}
          </Text>
          <Text style={[styles.hospitalText, { color: themeColors.textSecondary }]}>
            🏥 {doctor.hospital}
          </Text>
        </View>

        {/* Status Badges */}
        <View style={styles.badgesCol}>
          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: isUserActive ? themeColors.successLight : themeColors.dangerLight,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isUserActive ? themeColors.success : themeColors.danger },
              ]}
            >
              {isUserActive ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
          {doctor.isAvailable ? (
            <View
              style={[
                styles.availBadge,
                {
                  backgroundColor: themeColors.primaryLight,
                },
              ]}
            >
              <Text style={[styles.availText, { color: themeColors.primaryDark }]}>AVAILABLE</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Meta Details Row */}
      <View
        style={[
          styles.metaRow,
          {
            backgroundColor: themeColors.surfaceSecondary,
            borderColor: themeColors.border,
          },
        ]}
      >
        <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
          SLMC: {doctor.slmcNumber}
        </Text>

        {doctor.consultationFee ? (
          <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
            Fee: LKR {doctor.consultationFee.toLocaleString()}
          </Text>
        ) : null}

        {doctor.yearsOfExperience !== undefined ? (
          <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
            {doctor.yearsOfExperience} Yrs Exp
          </Text>
        ) : null}
      </View>

      {/* Actions Row */}
      <View style={[styles.actionsRow, { borderTopColor: themeColors.border }]}>
        <TouchableOpacity
          style={[
            styles.editBtn,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
          onPress={() => onEdit(doctor)}
          activeOpacity={0.8}
        >
          <Text style={[styles.editBtnText, { color: themeColors.primary }]}>✏️ Edit Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusBtn,
            {
              backgroundColor: isUserActive ? themeColors.dangerLight : themeColors.successLight,
              borderColor: isUserActive ? themeColors.danger : themeColors.success,
              borderWidth: 1,
            },
          ]}
          onPress={() => onToggleStatus(doctor)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.statusBtnText,
              { color: isUserActive ? themeColors.danger : themeColors.success },
            ]}
          >
            {isUserActive ? '⛔ Deactivate' : '✅ Reactivate'}
          </Text>
        </TouchableOpacity>
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
    marginBottom: spacing.xs,
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
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  doctorName: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  specializationText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 2,
  },
  hospitalText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badgePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  inactiveBadge: {
    backgroundColor: colors.dangerLight,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
  },
  activeText: {
    color: colors.success,
  },
  inactiveText: {
    color: colors.danger,
  },
  availBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  availText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  deactBtn: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  reactBtn: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusBtnText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '800',
  },
  deactBtnText: {
    color: colors.danger,
  },
  reactBtnText: {
    color: colors.success,
  },
});
