import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { addMedicationForPatient } from '../../services/caregiverService';

export default function CaregiverAddMedicationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();

  // Default dates
  const defaultToday = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  }, []);

  const [medicineName, setMedicineName] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('Daily');
  const [timeSlots, setTimeSlots] = useState<string[]>(['08:00', '20:00']);
  const [newTimeInput, setNewTimeInput] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(defaultToday);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [instructions, setInstructions] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleAddTimeSlot = () => {
    const clean = newTimeInput.trim();
    if (!clean) return;
    if (timeSlots.includes(clean)) {
      Alert.alert('Duplicate Time', 'This time slot is already in the schedule.');
      return;
    }
    setTimeSlots((prev) => [...prev, clean]);
    setNewTimeInput('');
  };

  const handleRemoveTimeSlot = (slotToRemove: string) => {
    if (timeSlots.length <= 1) {
      Alert.alert('Validation Error', 'At least one time slot is required.');
      return;
    }
    setTimeSlots((prev) => prev.filter((s) => s !== slotToRemove));
  };

  const handleSubmit = async () => {
    if (!params.patientId) {
      Alert.alert('Error', 'Patient ID reference is missing.');
      return;
    }

    const cleanName = medicineName.trim();
    const cleanDosage = dosage.trim();
    const cleanFreq = frequency.trim();

    if (!cleanName) {
      Alert.alert('Validation Error', 'Medicine name is required.');
      return;
    }
    if (!cleanDosage) {
      Alert.alert('Validation Error', 'Dosage is required.');
      return;
    }
    if (!cleanFreq) {
      Alert.alert('Validation Error', 'Frequency is required.');
      return;
    }
    if (timeSlots.length === 0) {
      Alert.alert('Validation Error', 'At least one time slot is required.');
      return;
    }
    if (!startDate) {
      Alert.alert('Validation Error', 'Start date is required.');
      return;
    }
    if (!endDate) {
      Alert.alert('Validation Error', 'End date is required by backend contract.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await addMedicationForPatient({
        patientId: params.patientId,
        medicineName: cleanName,
        dosage: cleanDosage,
        frequency: cleanFreq,
        timeSlots,
        startDate,
        endDate,
        instructions: instructions.trim(),
      });

      if (res && res.success) {
        Alert.alert('Medication Saved', `Prescription for ${cleanName} has been added successfully.`);
        router.back();
      } else {
        Alert.alert('Error', res.message || 'Failed to add medication.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save medication record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Add Medication"
        subtitle="Prescription & Dose Schedule"
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Medicine Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Medication Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Amlodipine or Lisinopril"
            placeholderTextColor={colors.textMuted}
            value={medicineName}
            onChangeText={setMedicineName}
          />
        </View>

        {/* Dosage */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Dosage *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 5mg - 1 Tablet"
            placeholderTextColor={colors.textMuted}
            value={dosage}
            onChangeText={setDosage}
          />
        </View>

        {/* Frequency */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Frequency / Schedule *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Daily / Twice Daily"
            placeholderTextColor={colors.textMuted}
            value={frequency}
            onChangeText={setFrequency}
          />
        </View>

        {/* Time Slots Section */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Dose Schedule Times (24h format) *</Text>
          
          <View style={styles.timeSlotsRow}>
            {timeSlots.map((slot) => (
              <View key={slot} style={styles.timeChip}>
                <Text style={styles.timeChipText}>⏰ {slot}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveTimeSlot(slot)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeChipIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.addTimeRow}>
            <TextInput
              style={styles.timeInput}
              placeholder="e.g. 14:00"
              placeholderTextColor={colors.textMuted}
              value={newTimeInput}
              onChangeText={setNewTimeInput}
            />
            <TouchableOpacity style={styles.addTimeBtn} onPress={handleAddTimeSlot}>
              <Text style={styles.addTimeBtnText}>+ Add Time</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Start & End Dates */}
        <View style={styles.datesRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Start Date *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>End Date *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Special Instructions</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            placeholder="e.g. Blood Pressure - Take after breakfast with warm water"
            placeholderTextColor={colors.textMuted}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Form Action Buttons */}
        <View style={styles.actionRow}>
          <AppButton
            title="Cancel"
            onPress={() => router.back()}
            variant="outline"
            style={styles.cancelBtn}
          />
          <AppButton
            title={submitting ? 'Saving...' : 'Save Medication'}
            onPress={handleSubmit}
            variant="primary"
            disabled={submitting}
            style={styles.saveBtn}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 80,
  },
  timeSlotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: spacing.xs,
  },
  timeChipText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.primaryDark,
    fontSize: 13,
  },
  removeChipIcon: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.danger,
  },
  addTimeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  timeInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 14,
  },
  addTimeBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTimeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  datesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
  },
  saveBtn: {
    flex: 1,
    minHeight: 46,
  },
});
