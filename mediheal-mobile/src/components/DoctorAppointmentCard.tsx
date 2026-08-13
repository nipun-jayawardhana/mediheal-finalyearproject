import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DoctorAppointment } from '../types/doctorPortal';
import { StatusBadge } from './StatusBadge';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';

interface DoctorAppointmentCardProps {
  appointment: DoctorAppointment;
  onConfirm?: (appointment: DoctorAppointment) => void;
  onStartConsultation?: (appointment: DoctorAppointment) => void;
  onViewHistory?: (appointment: DoctorAppointment) => void;
}

export const DoctorAppointmentCard: React.FC<DoctorAppointmentCardProps> = ({
  appointment,
  onConfirm,
  onStartConsultation,
  onViewHistory,
}) => {
  const patientName =
    typeof appointment.patientId === 'object' && appointment.patientId?.fullName
      ? appointment.patientId.fullName
      : 'Patient';

  const initials =
    patientName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'PT';

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

  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.patientCol}>
          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.timeText}>
            📅 {formatDate(appointment.appointmentDate)} at {appointment.timeSlot}
          </Text>
        </View>

        <StatusBadge status={appointment.status} label={appointment.status.toUpperCase()} />
      </View>

      {/* Reason Box */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>Reason for Visit:</Text>
        <Text style={styles.reasonText}>{appointment.reason}</Text>
      </View>

      {/* Dynamic Actions Row */}
      <View style={styles.actionsRow}>
        {appointment.status === 'pending' && onConfirm && (
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onConfirm(appointment)}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>✓ Confirm Appointment</Text>
          </TouchableOpacity>
        )}

        {appointment.status === 'confirmed' && onStartConsultation && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => onStartConsultation(appointment)}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>🩺 Start Consultation</Text>
          </TouchableOpacity>
        )}

        {(appointment.status === 'completed' || appointment.status === 'confirmed') &&
          onViewHistory && (
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => onViewHistory(appointment)}
              activeOpacity={0.8}
            >
              <Text style={styles.historyBtnText}>📑 View Patient History</Text>
            </TouchableOpacity>
          )}
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  patientCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  patientName: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  timeText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  reasonText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
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
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  confirmBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  startBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  startBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  historyBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
});
