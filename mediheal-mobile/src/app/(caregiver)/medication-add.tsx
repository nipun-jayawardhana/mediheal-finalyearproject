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
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { addMedicationForPatient } from '../../services/caregiverService';

export default function CaregiverAddMedicationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const { isDark, colors: themeColors } = useTheme();
  const { t } = useLanguage();

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
      Alert.alert(t('duplicateTimeTitle'), t('duplicateTimeMsg'));
      return;
    }
    setTimeSlots((prev) => [...prev, clean]);
    setNewTimeInput('');
  };

  const handleRemoveTimeSlot = (slotToRemove: string) => {
    if (timeSlots.length <= 1) {
      Alert.alert(t('error'), t('atLeastOneTimeSlot'));
      return;
    }
    setTimeSlots((prev) => prev.filter((s) => s !== slotToRemove));
  };

  const handleSubmit = async () => {
    if (!params.patientId) {
      Alert.alert(t('error'), t('patientIdMissing'));
      return;
    }

    const cleanName = medicineName.trim();
    const cleanDosage = dosage.trim();
    const cleanFreq = frequency.trim();

    if (!cleanName) {
      Alert.alert(t('error'), t('medNameRequired'));
      return;
    }
    if (!cleanDosage) {
      Alert.alert(t('error'), t('dosageRequired'));
      return;
    }
    if (!cleanFreq) {
      Alert.alert(t('error'), t('frequencyRequired'));
      return;
    }
    if (timeSlots.length === 0) {
      Alert.alert(t('error'), t('atLeastOneTimeSlot'));
      return;
    }
    if (!startDate) {
      Alert.alert(t('error'), t('startDateRequired'));
      return;
    }
    if (!endDate) {
      Alert.alert(t('error'), t('endDateRequired'));
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
        Alert.alert(t('medicationSavedTitle'), t('medicationSavedSuccess').replace('{name}', cleanName));
        router.back();
      } else {
        Alert.alert(t('error'), res.message || 'Failed to add medication.');
      }
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Unable to save medication record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('addMedicationTitle')}
        subtitle={t('prescriptionDoseSchedule')}
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Medicine Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('medicationNameLabel')}</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: themeColors.surfaceSecondary,
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
              },
            ]}
            placeholder={t('medNamePlaceholder')}
            placeholderTextColor={themeColors.textMuted}
            value={medicineName}
            onChangeText={setMedicineName}
          />
        </View>

        {/* Dosage */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('dosageLabel')}</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: themeColors.surfaceSecondary,
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
              },
            ]}
            placeholder={t('dosagePlaceholder')}
            placeholderTextColor={themeColors.textMuted}
            value={dosage}
            onChangeText={setDosage}
          />
        </View>

        {/* Frequency */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('frequencyScheduleLabel')}</Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: themeColors.surfaceSecondary,
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
              },
            ]}
            placeholder={t('freqPlaceholder')}
            placeholderTextColor={themeColors.textMuted}
            value={frequency}
            onChangeText={setFrequency}
          />
        </View>

        {/* Time Slots Section */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('doseScheduleTimesLabel')}</Text>
          
          <View style={styles.timeSlotsRow}>
            {timeSlots.map((slot) => (
              <View
                key={slot}
                style={[
                  styles.timeChip,
                  {
                    backgroundColor: themeColors.primaryLight,
                    borderColor: themeColors.primary,
                  },
                ]}
              >
                <Text style={[styles.timeChipText, { color: themeColors.primary }]}>⏰ {slot}</Text>
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
              style={[
                styles.timeInput,
                {
                  backgroundColor: themeColors.surfaceSecondary,
                  color: themeColors.textPrimary,
                  borderColor: themeColors.border,
                },
              ]}
              placeholder={t('timePlaceholder')}
              placeholderTextColor={themeColors.textMuted}
              value={newTimeInput}
              onChangeText={setNewTimeInput}
            />
            <TouchableOpacity
              style={[styles.addTimeBtn, { backgroundColor: themeColors.primary }]}
              onPress={handleAddTimeSlot}
            >
              <Text style={styles.addTimeBtnText}>{t('addTimeBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Start & End Dates */}
        <View style={styles.datesRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('startDateLabel')}</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: themeColors.surfaceSecondary,
                  color: themeColors.textPrimary,
                  borderColor: themeColors.border,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={themeColors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('endDateLabel')}</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: themeColors.surfaceSecondary,
                  color: themeColors.textPrimary,
                  borderColor: themeColors.border,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={themeColors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>{t('specialInstructionsLabel')}</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.multilineInput,
              {
                backgroundColor: themeColors.surfaceSecondary,
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
              },
            ]}
            placeholder={t('instructionsPlaceholder')}
            placeholderTextColor={themeColors.textMuted}
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
            title={t('cancel')}
            onPress={() => router.back()}
            variant="outline"
            style={styles.cancelBtn}
          />
          <AppButton
            title={submitting ? t('saving') : t('saveMedicationBtn')}
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
