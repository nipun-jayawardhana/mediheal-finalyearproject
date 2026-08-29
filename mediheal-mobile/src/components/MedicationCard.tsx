import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Medication, MedicationLog } from '../types/medication';
import { AppButton } from './AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface MedicationCardProps {
  medication: Medication;
  todayLogs: MedicationLog[];
  todayIso: string; // YYYY-MM-DD
  onMarkTaken: (medication: Medication, timeSlot: string) => void;
  markingKey?: string | null; // "medicationId_timeSlot"
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  todayLogs,
  todayIso,
  onMarkTaken,
  markingKey,
}) => {
  const { colors: themeColors } = useTheme();

  // Format 24-hour time "08:00" to "8:00 AM" or "20:00" to "8:00 PM"
  const formatTimeSlot = (timeStr: string) => {
    try {
      const [hStr, mStr] = timeStr.split(':');
      let hour = parseInt(hStr, 10);
      const minute = mStr || '00';
      if (isNaN(hour)) return timeStr;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour}:${minute} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  // Check if a dose is already taken for a specific time slot today
  const isDoseTakenToday = (timeSlot: string) => {
    const cleanSlot = timeSlot.trim();
    return todayLogs.some((log) => {
      const logMedId = typeof log.medicationId === 'object' ? log.medicationId?._id : log.medicationId;
      if (logMedId !== medication._id) return false;
      if (log.scheduledTime.trim() !== cleanSlot) return false;
      return log.status === 'taken';
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Top Header: Pill Icon & Medicine Identity */}
      <View style={styles.headerRow}>
        <View style={[styles.pillIconCircle, { backgroundColor: themeColors.successLight, borderColor: themeColors.success }]}>
          <Text style={styles.pillIcon}>💊</Text>
        </View>

        <View style={styles.headerTextCol}>
          <Text style={[styles.medicineName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {medication.medicineName}
          </Text>
          <Text style={[styles.dosageText, { color: themeColors.textSecondary }]}>
            {medication.dosage} • {medication.frequency}
          </Text>
        </View>
      </View>

      {/* Instructions if available */}
      {medication.instructions ? (
        <View style={[styles.instructionsBox, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
          <Text style={[styles.instructionsText, { color: themeColors.textSecondary }]}>
            ℹ️ {medication.instructions}
          </Text>
        </View>
      ) : null}

      {/* Time Slots & Mark as Taken Section */}
      <View style={[styles.slotsContainer, { borderTopColor: themeColors.border }]}>
        <Text style={[styles.slotsHeaderLabel, { color: themeColors.textMuted }]}>Today's Schedule & Action</Text>

        {medication.timeSlots && medication.timeSlots.length > 0 ? (
          medication.timeSlots.map((slot, idx) => {
            const taken = isDoseTakenToday(slot);
            const currentKey = `${medication._id}_${slot}`;
            const isSubmitting = markingKey === currentKey;

            return (
              <View key={idx} style={[styles.slotRow, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
                <View style={styles.slotTimeCol}>
                  <Text style={[styles.slotTimeText, { color: themeColors.primary }]}>⏰ {formatTimeSlot(slot)}</Text>
                  <Text style={[styles.slotRawText, { color: themeColors.textMuted }]}>({slot})</Text>
                </View>

                <View style={styles.slotActionCol}>
                  {taken ? (
                    <View style={[styles.takenBadge, { backgroundColor: themeColors.successLight, borderColor: themeColors.success }]}>
                      <Text style={[styles.takenCheckIcon, { color: themeColors.success }]}>✓</Text>
                      <Text style={[styles.takenBadgeText, { color: themeColors.success }]}>Taken</Text>
                    </View>
                  ) : (
                    <AppButton
                      title={isSubmitting ? 'Marking...' : 'Mark as Taken'}
                      onPress={() => onMarkTaken(medication, slot)}
                      variant="primary"
                      disabled={isSubmitting}
                      style={styles.markBtn}
                    />
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={[styles.noSlotsText, { color: themeColors.textMuted }]}>No time slots configured</Text>
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
  pillIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.successLight,
    borderWidth: 2,
    borderColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  pillIcon: {
    fontSize: 24,
  },
  headerTextCol: {
    flex: 1,
  },
  medicineName: {
    ...typography.header,
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  dosageText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  instructionsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
  },
  slotsContainer: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  slotsHeaderLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotTimeCol: {
    flexDirection: 'column',
  },
  slotTimeText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.primaryDark,
  },
  slotRawText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  slotActionCol: {
    minWidth: 120,
    alignItems: 'flex-end',
  },
  takenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.success,
  },
  takenCheckIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.success,
    marginRight: 4,
  },
  takenBadgeText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.success,
    fontSize: 13,
  },
  markBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  noSlotsText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
