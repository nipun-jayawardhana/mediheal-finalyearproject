import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import {
  getPatientProfileApi,
  updatePatientProfileApi,
} from '../../services/patientService';
import { BloodGroupType, GenderType } from '../../types/patient';
import { useLanguage } from '../../context/LanguageContext';

const BLOOD_GROUPS: BloodGroupType[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

export default function EditPatientProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const GENDER_OPTIONS: { label: string; value: GenderType }[] = [
    { label: t('male'), value: 'male' },
    { label: t('female'), value: 'female' },
    { label: t('other'), value: 'other' },
  ];

  // Form State
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<GenderType>('male');
  const [bloodGroup, setBloodGroup] = useState<BloodGroupType>('B+');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [medicalConditionsInput, setMedicalConditionsInput] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');

  // UI State
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingInitial(true);
      setErrorMsg('');
      try {
        const res = await getPatientProfileApi();
        if (res && res.success && res.data.profile) {
          const p = res.data.profile;
          setDateOfBirth(p.dateOfBirth || '');
          setGender(p.gender || 'male');
          setBloodGroup(p.bloodGroup || 'B+');
          setAddress(p.address || '');
          setEmergencyContactName(p.emergencyContactName || '');
          setEmergencyContactPhone(p.emergencyContactPhone || '');
          setMedicalConditionsInput((p.medicalConditions || []).join(', '));
          setAllergiesInput((p.allergies || []).join(', '));
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load profile for editing.');
      } finally {
        setLoadingInitial(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      const medicalConditions = medicalConditionsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const allergies = allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updatePatientProfileApi({
        dateOfBirth: dateOfBirth.trim(),
        gender,
        bloodGroup,
        address: address.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        medicalConditions,
        allergies,
      });

      router.back();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return <LoadingView message="Fetching profile details..." />;
  }

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title={t('editProfile')}
        subtitle={t('manageAccountPreferences')}
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView
            message={errorMsg}
            onRetry={() => setErrorMsg('')}
            retryText={t('dismiss')}
          />
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.sectionHeader}>{t('personalInformation')}</Text>

          <AppInput
            label="Date of Birth (YYYY-MM-DD)"
            placeholder="e.g. 1955-08-10"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
          />

          {/* Gender Selector */}
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                activeOpacity={0.8}
                onPress={() => setGender(item.value)}
                style={[
                  styles.genderChip,
                  gender === item.value && styles.genderChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    gender === item.value && styles.genderChipTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Blood Group Selector */}
          <Text style={styles.fieldLabel}>Blood Group</Text>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                activeOpacity={0.8}
                onPress={() => setBloodGroup(bg)}
                style={[
                  styles.bloodChip,
                  bloodGroup === bg && styles.bloodChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.bloodChipText,
                    bloodGroup === bg && styles.bloodChipTextSelected,
                  ]}
                >
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <AppInput
            label="Home Address"
            placeholder="e.g. 45 Temple Road, Kandy"
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.sectionHeader}>Emergency Contact</Text>

          <AppInput
            label="Emergency Contact Name"
            placeholder="e.g. Kamal Jayasinghe"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
          />

          <AppInput
            label="Emergency Contact Phone"
            placeholder="e.g. 0771122334"
            keyboardType="phone-pad"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
          />

          <Text style={styles.sectionHeader}>Health Background</Text>

          <AppInput
            label="Medical Conditions (Comma separated)"
            placeholder="e.g. Diabetes, Hypertension"
            value={medicalConditionsInput}
            onChangeText={setMedicalConditionsInput}
          />

          <AppInput
            label="Allergies (Comma separated)"
            placeholder="e.g. Penicillin, Dust"
            value={allergiesInput}
            onChangeText={setAllergiesInput}
          />

          <AppButton
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    ...typography.subheader,
    color: colors.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  genderChip: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  genderChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  genderChipText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  genderChipTextSelected: {
    color: colors.primary,
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  bloodChip: {
    width: '22%',
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '1.5%',
  },
  bloodChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  bloodChipText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  bloodChipTextSelected: {
    color: colors.primary,
  },
  saveBtn: {
    marginTop: spacing.lg,
  },
});
