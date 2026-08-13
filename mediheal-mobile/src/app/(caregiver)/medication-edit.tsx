import React, { useState, useEffect, useCallback } from 'react';
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
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import {
  getPatientMedications,
  updateMedication,
  deactivateMedication,
} from '../../services/caregiverService';

export default function CaregiverEditMedicationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; patientId?: string }>();

  const [medicineName, setMedicineName] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [newTimeInput, setNewTimeInput] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deactivating, setDeactivating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchMedication = useCallback(async () => {
    if (!params.id || !params.patientId) {
      setErrorMsg('Medication ID or Patient ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getPatientMedications(params.patientId);
      if (res && res.success && Array.isArray(res.data)) {
        const med = res.data.find((m) => m._id === params.id);
        if (med) {
          setMedicineName(med.medicineName);
          setDosage(med.dosage);
          setFrequency(med.frequency);
          setTimeSlots(med.timeSlots || []);
          setStartDate(med.startDate ? med.startDate.split('T')[0] : '');
          setEndDate(med.endDate ? med.endDate.split('T')[0] : '');
          setInstructions(med.instructions || '');
        } else {
          setErrorMsg('Medication record not found.');
        }
      } else {
        setErrorMsg('Failed to load medication details.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve medication record.');
    } finally {
      setLoading(false);
    }
  }, [params.id, params.patientId]);

  useEffect(() => {
    fetchMedication();
  }, [fetchMedication]);

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
    if (!params.id) return;

    const cleanName = medicineName.trim();
    const cleanDosage = dosage.trim();
    const cleanFreq = frequency.trim();

    if (!cleanName || !cleanDosage || !cleanFreq || timeSlots.length === 0) {
      Alert.alert('Validation Error', 'Please complete all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await updateMedication(params.id, {
        medicineName: cleanName,
        dosage: cleanDosage,
        frequency: cleanFreq,
        timeSlots,
        startDate,
        endDate,
        instructions: instructions.trim(),
      });

      if (res && res.success) {
        Alert.alert('Medication Updated', 'Medication details saved successfully.');
        router.back();
      } else {
        Alert.alert('Error', res.message || 'Failed to update medication.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update medication record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = () => {
    if (!params.id) return;

    Alert.alert(
      'Deactivate Medication',
      'Are you sure you want to stop this medication schedule? It will be marked as inactive for the patient.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: performDeactivation,
        },
      ]
    );
  };

  const performDeactivation = async () => {
    if (!params.id) return;
    setDeactivating(true);

    try {
      const res = await deactivateMedication(params.id);
      if (res && res.success) {
        Alert.alert('Medication Deactivated', 'The medication schedule has been stopped.');
        router.back();
      } else {
        Alert.alert('Error', res.message || 'Failed to deactivate medication.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to deactivate medication.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading medication details..." />;
  }

  if (errorMsg) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Edit Medication" onBackPress={() => router.back()} />
        <ErrorView message={errorMsg} onRetry={fetchMedication} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Edit Medication"
        subtitle="Modify Prescription Schedule"
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Medicine Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Medication Name *</Text>
          <TextInput
            style={styles.textInput}
            value={medicineName}
            onChangeText={setMedicineName}
          />
        </View>

        {/* Dosage */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Dosage *</Text>
          <TextInput
            style={styles.textInput}
            value={dosage}
            onChangeText={setDosage}
          />
        </View>

        {/* Frequency */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Frequency / Schedule *</Text>
          <TextInput
            style={styles.textInput}
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
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>End Date *</Text>
            <TextInput
              style={styles.textInput}
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
            title={submitting ? 'Saving...' : 'Save Changes'}
            onPress={handleSubmit}
            variant="primary"
            disabled={submitting || deactivating}
            style={styles.saveBtn}
          />
        </View>

        {/* Deactivate Action */}
        <TouchableOpacity
          style={styles.deactivateBtn}
          onPress={handleDeactivate}
          disabled={deactivating || submitting}
        >
          <Text style={styles.deactivateBtnText}>
            {deactivating ? 'Deactivating...' : '⛔ Deactivate Medication Schedule'}
          </Text>
        </TouchableOpacity>
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
    marginTop: spacing.md,
  },
  saveBtn: {
    minHeight: 46,
  },
  deactivateBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    backgroundColor: colors.dangerLight,
  },
  deactivateBtnText: {
    ...typography.bodyBold,
    color: colors.danger,
    fontSize: 14,
  },
});
