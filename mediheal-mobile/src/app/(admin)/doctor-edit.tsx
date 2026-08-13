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
import { getAdminDoctorById, updateDoctor } from '../../services/adminService';
import { AdminDoctor } from '../../types/admin';

const COMMON_SPECIALIZATIONS = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Gastroenterologist',
  'ENT Specialist',
  'Neurologist',
  'Orthopedic Specialist',
  'Pediatrician',
];

const LANGUAGE_OPTIONS = ['Sinhala', 'Tamil', 'English'];
const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AdminEditDoctorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [doctor, setDoctor] = useState<AdminDoctor | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [slmcNumber, setSlmcNumber] = useState<string>('');
  const [specialization, setSpecialization] = useState<string>('');
  const [hospital, setHospital] = useState<string>('');
  const [yearsOfExperience, setYearsOfExperience] = useState<string>('');
  const [consultationFee, setConsultationFee] = useState<string>('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState<string>('');
  const [biography, setBiography] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDoctorDetails = useCallback(async () => {
    if (!params.id) {
      setErrorMsg('Doctor ID parameter is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getAdminDoctorById(params.id);
      if (res && res.success && res.data) {
        const doc = res.data;
        setDoctor(doc);
        setFullName(doc.userId?.fullName || '');
        setEmail(doc.userId?.email || '');
        setPhoneNumber(doc.userId?.phoneNumber || '');
        setSlmcNumber(doc.slmcNumber || '');
        setSpecialization(doc.specialization || '');
        setHospital(doc.hospital || '');
        setYearsOfExperience(String(doc.yearsOfExperience ?? 0));
        setConsultationFee(String(doc.consultationFee ?? 0));
        setLanguages(doc.languages || ['English']);
        setAvailableDays(doc.availableDays || []);
        setTimeSlots(doc.availableTimeSlots || []);
        setBiography(doc.biography || '');
      } else {
        setErrorMsg('Doctor profile not found.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve doctor details.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const toggleDay = (day: string) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAddTimeSlot = () => {
    const clean = newSlotInput.trim();
    if (!clean) return;
    if (timeSlots.includes(clean)) {
      Alert.alert('Duplicate Time', 'This time slot is already added.');
      return;
    }
    setTimeSlots((prev) => [...prev, clean]);
    setNewSlotInput('');
  };

  const handleRemoveTimeSlot = (slot: string) => {
    setTimeSlots((prev) => prev.filter((s) => s !== slot));
  };

  const handleSubmit = async () => {
    if (!params.id || !doctor) return;

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phoneNumber.trim();
    const cleanSlmc = slmcNumber.trim();
    const cleanSpec = specialization.trim();
    const cleanHosp = hospital.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanSlmc || !cleanSpec || !cleanHosp) {
      Alert.alert('Validation Error', 'Please complete all required fields (*).');
      return;
    }

    const expNum = parseInt(yearsOfExperience, 10);
    const feeNum = parseInt(consultationFee, 10);

    if (isNaN(expNum) || expNum < 0) {
      Alert.alert('Validation Error', 'Years of experience must be 0 or greater.');
      return;
    }

    if (isNaN(feeNum) || feeNum < 0) {
      Alert.alert('Validation Error', 'Consultation fee must be 0 or greater.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await updateDoctor(params.id, {
        fullName: cleanName.startsWith('Dr.') ? cleanName : `Dr. ${cleanName}`,
        email: cleanEmail,
        phoneNumber: cleanPhone,
        slmcNumber: cleanSlmc,
        specialization: cleanSpec,
        hospital: cleanHosp,
        yearsOfExperience: expNum,
        consultationFee: feeNum,
        languages,
        availableDays,
        availableTimeSlots: timeSlots,
        biography: biography.trim(),
      });

      if (res && res.success) {
        Alert.alert(
          'Doctor Updated',
          `Doctor details for ${cleanName} updated successfully.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', res.message || 'Failed to update doctor profile.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unable to update doctor profile.';
      if (errMsg.toLowerCase().includes('email already exists')) {
        Alert.alert('Duplicate Email', 'Another user account with this email address already exists.');
      } else if (errMsg.toLowerCase().includes('slmc number already exists')) {
        Alert.alert('Duplicate SLMC', 'Another doctor with this SLMC registration number already exists.');
      } else {
        Alert.alert('Update Failed', errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading doctor profile details..." />;
  }

  if (errorMsg || !doctor) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Edit Doctor" onBackPress={() => router.back()} />
        <ErrorView message={errorMsg || 'Doctor details unavailable.'} onRetry={fetchDoctorDetails} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Edit Doctor Profile"
        subtitle={`Updating Dr. ${doctor.userId?.fullName || 'Specialist'}`}
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Full Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Full Name *</Text>
          <TextInput
            style={styles.textInput}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email Address *</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Phone Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput
            style={styles.textInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>

        {/* SLMC Registration Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>SLMC Registration Number *</Text>
          <TextInput
            style={styles.textInput}
            value={slmcNumber}
            onChangeText={(val) => setSlmcNumber(val.toUpperCase())}
            autoCapitalize="characters"
          />
        </View>

        {/* Specialization Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Medical Specialization *</Text>
          <View style={styles.chipsWrap}>
            {COMMON_SPECIALIZATIONS.map((spec) => {
              const isSelected = specialization === spec;
              return (
                <TouchableOpacity
                  key={spec}
                  style={[styles.chipOption, isSelected && styles.chipOptionSelected]}
                  onPress={() => setSpecialization(spec)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {spec}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Primary Hospital */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Primary Hospital *</Text>
          <TextInput
            style={styles.textInput}
            value={hospital}
            onChangeText={setHospital}
          />
        </View>

        {/* Experience & Fee */}
        <View style={styles.datesRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Experience (Yrs) *</Text>
            <TextInput
              style={styles.textInput}
              value={yearsOfExperience}
              onChangeText={setYearsOfExperience}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Fee (LKR) *</Text>
            <TextInput
              style={styles.textInput}
              value={consultationFee}
              onChangeText={setConsultationFee}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Spoken Languages */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Spoken Languages</Text>
          <View style={styles.chipsWrap}>
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSelected = languages.includes(lang);
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.chipOption, isSelected && styles.chipOptionSelected]}
                  onPress={() => toggleLanguage(lang)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {isSelected ? '✓ ' : ''}{lang}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Available Days */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Available Days</Text>
          <View style={styles.chipsWrap}>
            {DAY_OPTIONS.map((day) => {
              const isSelected = availableDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.chipOption, isSelected && styles.chipOptionSelected]}
                  onPress={() => toggleDay(day)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Slots Section */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Available Time Slots</Text>
          <View style={styles.timeChipsWrap}>
            {timeSlots.map((slot) => (
              <View key={slot} style={styles.timeChip}>
                <Text style={styles.timeChipText}>⏰ {slot}</Text>
                <TouchableOpacity onPress={() => handleRemoveTimeSlot(slot)}>
                  <Text style={styles.removeChipIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.addTimeRow}>
            <TextInput
              style={styles.timeInput}
              placeholder="e.g. 09:00 AM - 01:00 PM"
              placeholderTextColor={colors.textMuted}
              value={newSlotInput}
              onChangeText={setNewSlotInput}
            />
            <TouchableOpacity style={styles.addTimeBtn} onPress={handleAddTimeSlot}>
              <Text style={styles.addTimeBtnText}>+ Add Slot</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Biography */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Doctor Biography</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={biography}
            onChangeText={setBiography}
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
            title={submitting ? 'Saving Changes...' : 'Update Doctor'}
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
  datesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipOption: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  timeChipsWrap: {
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
    fontSize: 12,
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
