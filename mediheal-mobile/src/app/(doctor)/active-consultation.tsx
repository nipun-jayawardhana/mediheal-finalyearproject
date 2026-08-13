import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import {
  getAppointmentById,
  createConsultation,
} from '../../services/doctorPortalService';
import {
  DoctorAppointment,
  PrescriptionItemInput,
} from '../../types/doctorPortal';

export default function ActiveConsultationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId?: string }>();

  const [appointment, setAppointment] = useState<DoctorAppointment | null>(null);
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionItemInput[]>([
    { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' },
  ]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [newRecInput, setNewRecInput] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchAppointment = useCallback(async () => {
    if (!params.appointmentId) {
      setErrorMsg('Appointment ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getAppointmentById(params.appointmentId);
      if (res && res.success && res.data) {
        setAppointment(res.data);
      } else {
        setErrorMsg('Failed to load appointment for consultation.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve appointment details.');
    } finally {
      setLoading(false);
    }
  }, [params.appointmentId]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleAddPrescriptionRow = () => {
    setPrescriptions((prev) => [
      ...prev,
      { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' },
    ]);
  };

  const handleRemovePrescriptionRow = (index: number) => {
    setPrescriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePrescriptionField = (
    index: number,
    field: keyof PrescriptionItemInput,
    value: string
  ) => {
    setPrescriptions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddRecommendation = () => {
    const clean = newRecInput.trim();
    if (!clean) return;
    setRecommendations((prev) => [...prev, clean]);
    setNewRecInput('');
  };

  const handleRemoveRecommendation = (index: number) => {
    setRecommendations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!params.appointmentId || !appointment) return;

    const cleanDiagnosis = diagnosis.trim();
    if (!cleanDiagnosis) {
      Alert.alert('Validation Error', 'Diagnosis is required.');
      return;
    }

    // Filter valid prescription rows
    const validPrescriptions = prescriptions.filter(
      (p) => p.medicineName.trim() && p.dosage.trim() && p.frequency.trim() && p.duration.trim()
    );

    // Validate partial prescription rows
    const partialPrescriptions = prescriptions.filter(
      (p) =>
        (p.medicineName.trim() || p.dosage.trim() || p.frequency.trim() || p.duration.trim()) &&
        (!p.medicineName.trim() || !p.dosage.trim() || !p.frequency.trim() || !p.duration.trim())
    );

    if (partialPrescriptions.length > 0) {
      Alert.alert(
        'Validation Error',
        'Each prescription item must include Medicine Name, Dosage, Frequency, and Duration.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await createConsultation({
        appointmentId: params.appointmentId,
        diagnosis: cleanDiagnosis,
        clinicalNotes: clinicalNotes.trim(),
        prescriptions: validPrescriptions,
        recommendations,
        followUpDate: followUpDate.trim() || undefined,
      });

      if (res && res.success) {
        Alert.alert(
          'Consultation Completed',
          'The consultation has been completed and saved to the patient record.'
        );
        router.replace('/(doctor)/appointments' as any);
      } else {
        Alert.alert('Error', res.message || 'Failed to save consultation.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unable to save consultation.';
      if (errMsg.toLowerCase().includes('already been recorded') || errMsg.toLowerCase().includes('duplicate')) {
        Alert.alert(
          'Duplicate Consultation',
          'A consultation has already been completed for this appointment.'
        );
      } else {
        Alert.alert('Consultation Error', errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading active consultation session..." />;
  }

  if (errorMsg || !appointment) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Active Consultation" onBackPress={() => router.back()} />
        <ErrorView message={errorMsg || 'Appointment details unavailable.'} onRetry={fetchAppointment} />
      </ScreenContainer>
    );
  }

  const patientName =
    typeof appointment.patientId === 'object' && appointment.patientId?.fullName
      ? appointment.patientId.fullName
      : 'Patient';

  const patientId =
    typeof appointment.patientId === 'object' ? appointment.patientId._id : appointment.patientId;

  const initials =
    patientName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'PT';

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Active Consultation"
        subtitle="Clinical Notes & Diagnosis"
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Patient Context Card */}
          <View style={styles.patientCard}>
            <View style={styles.patientHeaderRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.patientCol}>
                <Text style={styles.patientName}>{patientName}</Text>
                <Text style={styles.appointmentMeta}>
                  Reason: {appointment.reason}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() =>
                  router.push({
                    pathname: '/(doctor)/patient-history' as any,
                    params: { patientId },
                  })
                }
              >
                <Text style={styles.historyBtnText}>📑 Patient History</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Diagnosis Section (Required) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Diagnosis *</Text>
            <TextInput
              style={[styles.textInput, styles.diagnosisInput]}
              placeholder="Enter official medical diagnosis (e.g. Acute Bronchitis)"
              placeholderTextColor={colors.textMuted}
              value={diagnosis}
              onChangeText={setDiagnosis}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Clinical Notes Section */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Clinical Notes & Observations</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Start typing clinical findings, observations, and exam notes..."
              placeholderTextColor={colors.textMuted}
              value={clinicalNotes}
              onChangeText={setClinicalNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Prescriptions Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Prescriptions ({prescriptions.length})</Text>
            <TouchableOpacity style={styles.addRowBtn} onPress={handleAddPrescriptionRow}>
              <Text style={styles.addRowText}>+ Add Medication</Text>
            </TouchableOpacity>
          </View>

          {prescriptions.map((p, index) => (
            <View key={index} style={styles.prescriptionBox}>
              <View style={styles.pHeaderRow}>
                <Text style={styles.pRowTitle}>Medication Item #{index + 1}</Text>
                {prescriptions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemovePrescriptionRow(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeRowText}>🗑️ Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={styles.pInput}
                placeholder="Medicine Name (e.g. Amoxicillin 500mg)"
                placeholderTextColor={colors.textMuted}
                value={p.medicineName}
                onChangeText={(val) => handleUpdatePrescriptionField(index, 'medicineName', val)}
              />

              <View style={styles.pSubRow}>
                <TextInput
                  style={[styles.pInput, { flex: 1 }]}
                  placeholder="Dosage (e.g. 500mg)"
                  placeholderTextColor={colors.textMuted}
                  value={p.dosage}
                  onChangeText={(val) => handleUpdatePrescriptionField(index, 'dosage', val)}
                />
                <TextInput
                  style={[styles.pInput, { flex: 1 }]}
                  placeholder="Frequency (e.g. 3x Daily)"
                  placeholderTextColor={colors.textMuted}
                  value={p.frequency}
                  onChangeText={(val) => handleUpdatePrescriptionField(index, 'frequency', val)}
                />
              </View>

              <View style={styles.pSubRow}>
                <TextInput
                  style={[styles.pInput, { flex: 1 }]}
                  placeholder="Duration (e.g. 5 days)"
                  placeholderTextColor={colors.textMuted}
                  value={p.duration}
                  onChangeText={(val) => handleUpdatePrescriptionField(index, 'duration', val)}
                />
                <TextInput
                  style={[styles.pInput, { flex: 1 }]}
                  placeholder="Instructions (e.g. After meals)"
                  placeholderTextColor={colors.textMuted}
                  value={p.instructions}
                  onChangeText={(val) => handleUpdatePrescriptionField(index, 'instructions', val)}
                />
              </View>
            </View>
          ))}

          {/* Lifestyle Recommendations Section */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Lifestyle & General Recommendations</Text>
            
            {recommendations.map((rec, i) => (
              <View key={i} style={styles.recItem}>
                <Text style={styles.recText}>• {rec}</Text>
                <TouchableOpacity onPress={() => handleRemoveRecommendation(i)}>
                  <Text style={styles.removeRecText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addRecRow}>
              <TextInput
                style={styles.recInput}
                placeholder="e.g. Drink 2L warm water daily, avoid cold beverages"
                placeholderTextColor={colors.textMuted}
                value={newRecInput}
                onChangeText={setNewRecInput}
              />
              <TouchableOpacity style={styles.addRecBtn} onPress={handleAddRecommendation}>
                <Text style={styles.addRecBtnText}>+ Add Advice</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Follow-up Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Follow-up Date (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD (e.g. 2026-08-22)"
              placeholderTextColor={colors.textMuted}
              value={followUpDate}
              onChangeText={setFollowUpDate}
            />
          </View>

          {/* Submit Actions */}
          <AppButton
            title={submitting ? 'Saving Consultation...' : 'Complete & Save Consultation'}
            onPress={handleSubmit}
            variant="primary"
            disabled={submitting}
            style={styles.saveBtn}
          />

          <AppButton
            title="Discard Session"
            onPress={() => router.back()}
            variant="outline"
            disabled={submitting}
            style={styles.discardBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  patientCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  patientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  patientCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  patientName: {
    ...typography.header,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  appointmentMeta: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyBtnText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.bodyBold,
    fontSize: 15,
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
  diagnosisInput: {
    minHeight: 50,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 100,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 17,
    color: colors.textPrimary,
  },
  addRowBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  addRowText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  prescriptionBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  pRowTitle: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  removeRowText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  pInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  pSubRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  removeRecText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
  addRecRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  recInput: {
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
  addRecBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRecBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  saveBtn: {
    minHeight: 50,
    marginTop: spacing.md,
  },
  discardBtn: {
    minHeight: 46,
    marginTop: spacing.sm,
  },
});
