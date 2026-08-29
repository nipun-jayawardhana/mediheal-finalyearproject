import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { ErrorView } from '../../components/ErrorView';
import { CaregiverLinkCodeCard } from '../../components/CaregiverLinkCodeCard';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { createPatientProfileApi } from '../../services/patientService';
import { BloodGroupType, GenderType } from '../../types/patient';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const BLOOD_GROUPS: BloodGroupType[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  // Field Errors
  const [dobError, setDobError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [emergNameError, setEmergNameError] = useState('');
  const [emergPhoneError, setEmergPhoneError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;
    setDobError('');
    setAddressError('');
    setEmergNameError('');
    setEmergPhoneError('');
    setErrorMsg('');

    // DOB Validation (YYYY-MM-DD)
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateOfBirth.trim()) {
      setDobError('Date of birth is required (YYYY-MM-DD)');
      isValid = false;
    } else if (!dobRegex.test(dateOfBirth.trim())) {
      setDobError('Please use YYYY-MM-DD format (e.g. 1955-08-10)');
      isValid = false;
    } else {
      const parsedDate = new Date(dateOfBirth.trim());
      if (isNaN(parsedDate.getTime())) {
        setDobError('Invalid date format');
        isValid = false;
      } else if (parsedDate > new Date()) {
        setDobError('Date of birth cannot be in the future');
        isValid = false;
      }
    }

    if (!address.trim()) {
      setAddressError('Address is required');
      isValid = false;
    }

    if (!emergencyContactName.trim()) {
      setEmergNameError('Emergency contact name is required');
      isValid = false;
    }

    if (!emergencyContactPhone.trim()) {
      setEmergPhoneError('Emergency contact phone is required');
      isValid = false;
    }

    return isValid;
  };

  const handleCreateProfile = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      // Parse comma-separated conditions and allergies
      const medicalConditions = medicalConditionsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const allergies = allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await createPatientProfileApi({
        dateOfBirth: dateOfBirth.trim(),
        gender,
        bloodGroup,
        address: address.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        medicalConditions,
        allergies,
      });

      if (res && res.data?.profile?.caregiverLinkCode) {
        setCreatedCode(res.data.profile.caregiverLinkCode);
      } else {
        router.replace('/(patient)');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create patient profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success Screen View after creation
  if (createdCode) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <View style={styles.successContainer}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Profile Completed!</Text>
          <Text style={styles.successSub}>
            Your health profile is active. Use your unique Caregiver Linking Code below to connect your family caregiver.
          </Text>

          <CaregiverLinkCodeCard code={createdCode} />

          <AppButton
            title="Go to Home Dashboard"
            onPress={() => router.replace('/(patient)')}
            style={styles.goHomeBtn}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title={t('completeYourProfile')}
        subtitle={t('completeProfileSub')}
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView
            message={errorMsg}
            onRetry={() => setErrorMsg('')}
            retryText={t('dismiss')}
          />
        ) : null}

        <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>{t('personalInformation')}</Text>

          <AppInput
            label="Date of Birth (YYYY-MM-DD) *"
            placeholder="e.g. 1955-08-10"
            keyboardType="numbers-and-punctuation"
            value={dateOfBirth}
            onChangeText={(val) => {
              setDateOfBirth(val);
              if (dobError) setDobError('');
            }}
            error={dobError}
          />

          {/* Gender Selector */}
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>Gender *</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                activeOpacity={0.8}
                onPress={() => setGender(item.value)}
                style={[
                  styles.genderChip,
                  { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
                  gender === item.value && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select gender ${item.label}`}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    { color: themeColors.textSecondary },
                    gender === item.value && { color: themeColors.primary },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Blood Group Selector */}
          <Text style={[styles.fieldLabel, { color: themeColors.textPrimary }]}>Blood Group *</Text>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                activeOpacity={0.8}
                onPress={() => setBloodGroup(bg)}
                style={[
                  styles.bloodChip,
                  { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
                  bloodGroup === bg && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select blood group ${bg}`}
              >
                <Text
                  style={[
                    styles.bloodChipText,
                    { color: themeColors.textSecondary },
                    bloodGroup === bg && { color: themeColors.primary },
                  ]}
                >
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <AppInput
            label="Home Address *"
            placeholder="e.g. 45 Temple Road, Kandy"
            value={address}
            onChangeText={(val) => {
              setAddress(val);
              if (addressError) setAddressError('');
            }}
            error={addressError}
          />

          <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>Emergency Contact</Text>

          <AppInput
            label="Emergency Contact Name *"
            placeholder="e.g. Kamal Jayasinghe (Son)"
            value={emergencyContactName}
            onChangeText={(val) => {
              setEmergencyContactName(val);
              if (emergNameError) setEmergNameError('');
            }}
            error={emergNameError}
          />

          <AppInput
            label="Emergency Contact Phone *"
            placeholder="e.g. 0771122334"
            keyboardType="phone-pad"
            value={emergencyContactPhone}
            onChangeText={(val) => {
              setEmergencyContactPhone(val);
              if (emergPhoneError) setEmergPhoneError('');
            }}
            error={emergPhoneError}
          />

          <Text style={[styles.sectionHeader, { color: themeColors.primary }]}>Health Background</Text>

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
            title="Save & Generate Caregiver Code"
            onPress={handleCreateProfile}
            loading={loading}
            style={styles.submitBtn}
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
  submitBtn: {
    marginTop: spacing.lg,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    borderColor: colors.success,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkIcon: {
    fontSize: 40,
    color: colors.success,
    fontWeight: '800',
  },
  successTitle: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  successSub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  goHomeBtn: {
    width: '100%',
    marginTop: spacing.lg,
  },
});
