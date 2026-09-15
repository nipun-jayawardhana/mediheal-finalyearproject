import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { createDoctor } from '../../services/adminService';

const COMMON_SPECIALIZATIONS = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Gastroenterologist',
  'ENT Specialist',
  'Neurologist',
  'Orthopedic Specialist',
  'Pediatrician',
  'Psychiatrist',
  'Endocrinologist',
  'Ophthalmologist',
  'Oncologist',
];

const LANGUAGE_OPTIONS = ['Sinhala', 'Tamil', 'English'];

const DAY_OPTIONS = [
  { key: 'Monday', label: 'Mon' },
  { key: 'Tuesday', label: 'Tue' },
  { key: 'Wednesday', label: 'Wed' },
  { key: 'Thursday', label: 'Thu' },
  { key: 'Friday', label: 'Fri' },
  { key: 'Saturday', label: 'Sat' },
  { key: 'Sunday', label: 'Sun' },
];

const PRESET_SLOTS = [
  '08:00 AM - 12:00 PM',
  '01:00 PM - 04:00 PM',
  '05:00 PM - 08:00 PM',
  '06:00 PM - 09:00 PM',
];

const FEE_PRESETS = [1500, 2000, 2500, 3000, 4000, 5000];
const EXPERIENCE_PRESETS = [2, 5, 8, 10, 15, 20];

interface CreatedDoctorInfo {
  fullName: string;
  email: string;
  password: string;
  slmcNumber: string;
  specialization: string;
  hospital: string;
}

export default function AdminAddDoctorScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Active step (1: Identity & Contact, 2: Practice & Fees, 3: Schedule & Credentials)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form states - Step 1
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [slmcNumber, setSlmcNumber] = useState<string>('');

  // Form states - Step 2
  const [specialization, setSpecialization] = useState<string>('General Physician');
  const [customSpecialization, setCustomSpecialization] = useState<string>('');
  const [isCustomSpecialization, setIsCustomSpecialization] = useState<boolean>(false);
  const [hospital, setHospital] = useState<string>('');
  const [yearsOfExperience, setYearsOfExperience] = useState<string>('5');
  const [consultationFee, setConsultationFee] = useState<string>('2500');
  const [languages, setLanguages] = useState<string[]>(['English', 'Sinhala']);
  const [location, setLocation] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  // Form states - Step 3
  const [availableDays, setAvailableDays] = useState<string[]>([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
  const [timeSlots, setTimeSlots] = useState<string[]>([
    '08:00 AM - 12:00 PM',
    '05:00 PM - 08:00 PM',
  ]);
  const [newSlotInput, setNewSlotInput] = useState<string>('');
  const [biography, setBiography] = useState<string>('');

  // Password generation option
  const [passwordMode, setPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [customPassword, setCustomPassword] = useState<string>('');
  const [showCustomPassword, setShowCustomPassword] = useState<boolean>(false);

  // Status & Validation
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [stepErrors, setStepErrors] = useState<{ [key: string]: string }>({});

  // Success Credential Modal State
  const [createdDoctor, setCreatedDoctor] = useState<CreatedDoctorInfo | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showModalPassword, setShowModalPassword] = useState<boolean>(true);
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  // Helper to copy text to clipboard with fallback
  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(text);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopyFeedback(`${label} copied!`);
      setTimeout(() => setCopyFeedback(''), 2500);
    } catch {
      Alert.alert('Copy Failed', 'Unable to automatically copy to clipboard.');
    }
  };

  const copyAllCredentials = async () => {
    if (!createdDoctor) return;
    const allText = `MediHeal Doctor Portal Credentials\n` +
      `---------------------------------\n` +
      `Doctor Name: ${createdDoctor.fullName}\n` +
      `Specialization: ${createdDoctor.specialization}\n` +
      `Hospital: ${createdDoctor.hospital}\n` +
      `SLMC Number: ${createdDoctor.slmcNumber}\n` +
      `Email (Username): ${createdDoctor.email}\n` +
      `Password: ${createdDoctor.password}\n` +
      `---------------------------------\n` +
      `Login via the MediHeal Mobile App under Sign In.`;

    await copyToClipboard(allText, 'All credentials');
  };

  // Field toggles
  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const toggleDay = (dayKey: string) => {
    setAvailableDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const setAllWeekdays = () => {
    setAvailableDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  };

  const setAllDays = () => {
    setAvailableDays(DAY_OPTIONS.map((d) => d.key));
  };

  const setWeekendOnly = () => {
    setAvailableDays(['Saturday', 'Sunday']);
  };

  const handleAddTimeSlot = (slotToAdd?: string) => {
    const clean = (slotToAdd || newSlotInput).trim();
    if (!clean) return;
    if (timeSlots.includes(clean)) {
      Alert.alert('Duplicate Time', 'This time slot is already in the list.');
      return;
    }
    setTimeSlots((prev) => [...prev, clean]);
    if (!slotToAdd) setNewSlotInput('');
  };

  const handleRemoveTimeSlot = (slot: string) => {
    setTimeSlots((prev) => prev.filter((s) => s !== slot));
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const errors: { [key: string]: string } = {};
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phoneNumber.trim();
    const cleanSlmc = slmcNumber.trim();

    if (!cleanName) {
      errors.fullName = 'Full Name is required.';
    }
    if (!cleanEmail) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      errors.email = 'Please enter a valid email format (name@example.com).';
    }
    if (!cleanPhone) {
      errors.phoneNumber = 'Phone number is required.';
    }
    if (!cleanSlmc) {
      errors.slmcNumber = 'SLMC registration number is required.';
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const errors: { [key: string]: string } = {};
    const targetSpec = isCustomSpecialization ? customSpecialization.trim() : specialization.trim();
    const cleanHosp = hospital.trim();
    const expNum = parseInt(yearsOfExperience, 10);
    const feeNum = parseInt(consultationFee, 10);

    if (!targetSpec) {
      errors.specialization = 'Please select or specify a specialization.';
    }
    if (!cleanHosp) {
      errors.hospital = 'Hospital or clinic affiliation is required.';
    }
    if (isNaN(expNum) || expNum < 0) {
      errors.yearsOfExperience = 'Experience must be 0 or more years.';
    }
    if (isNaN(feeNum) || feeNum < 0) {
      errors.consultationFee = 'Consultation fee must be 0 or higher.';
    }

    if (latitude.trim()) {
      const lat = parseFloat(latitude.trim());
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.latitude = 'Latitude must be between -90 and 90.';
      }
    }
    if (longitude.trim()) {
      const lng = parseFloat(longitude.trim());
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.longitude = 'Longitude must be between -180 and 180.';
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (availableDays.length === 0) {
      errors.availableDays = 'Please select at least one available day.';
    }
    if (timeSlots.length === 0) {
      errors.timeSlots = 'Please add at least one consultation time slot.';
    }
    if (passwordMode === 'custom') {
      if (!customPassword.trim()) {
        errors.customPassword = 'Password cannot be empty when custom password is selected.';
      } else if (customPassword.trim().length < 6) {
        errors.customPassword = 'Password must be at least 6 characters long.';
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setStepErrors({});
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      return;
    }

    const cleanName = fullName.trim();
    const formattedName = cleanName.toLowerCase().startsWith('dr.')
      ? cleanName
      : `Dr. ${cleanName}`;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim();
    const cleanSlmc = slmcNumber.trim();
    const chosenSpec = isCustomSpecialization ? customSpecialization.trim() : specialization.trim();
    const cleanHosp = hospital.trim();
    const expNum = parseInt(yearsOfExperience, 10) || 0;
    const feeNum = parseInt(consultationFee, 10) || 0;

    let latNum: number | undefined = undefined;
    let lngNum: number | undefined = undefined;
    if (latitude.trim()) latNum = parseFloat(latitude.trim());
    if (longitude.trim()) lngNum = parseFloat(longitude.trim());

    setSubmitting(true);

    try {
      const res = await createDoctor({
        fullName: formattedName,
        email: cleanEmail,
        phoneNumber: cleanPhone,
        slmcNumber: cleanSlmc,
        specialization: chosenSpec,
        hospital: cleanHosp,
        yearsOfExperience: expNum,
        consultationFee: feeNum,
        languages,
        availableDays,
        availableTimeSlots: timeSlots,
        biography: biography.trim(),
        location: location.trim(),
        latitude: latNum,
        longitude: lngNum,
        password: passwordMode === 'custom' ? customPassword.trim() : undefined,
      });

      if (res && res.success) {
        const tempPass = res.data?.temporaryPassword || (passwordMode === 'custom' ? customPassword.trim() : '');
        setCreatedDoctor({
          fullName: formattedName,
          email: cleanEmail,
          password: tempPass,
          slmcNumber: cleanSlmc,
          specialization: chosenSpec,
          hospital: cleanHosp,
        });
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to create doctor account.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unable to create doctor profile.';
      if (errMsg.toLowerCase().includes('email already exists')) {
        Alert.alert('Duplicate Email', 'An account with this email address already exists in MediHeal.');
        setCurrentStep(1);
      } else if (errMsg.toLowerCase().includes('slmc number already exists')) {
        Alert.alert('Duplicate SLMC', 'A doctor with this SLMC registration number is already registered.');
        setCurrentStep(1);
      } else {
        Alert.alert('Registration Failed', errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setShowSuccessModal(false);
    setCreatedDoctor(null);
    setCurrentStep(1);
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setSlmcNumber('');
    setHospital('');
    setYearsOfExperience('5');
    setConsultationFee('2500');
    setBiography('');
    setLocation('');
    setLatitude('');
    setLongitude('');
    setCustomPassword('');
    setPasswordMode('auto');
    setStepErrors({});
  };

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Register Doctor"
        subtitle="Step-by-step verified onboarding"
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Step Progress Header */}
        <View style={[styles.stepBarContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stepIndicatorsRow}>
            {/* Step 1 Tab */}
            <TouchableOpacity
              style={[
                styles.stepTab,
                currentStep === 1 && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
              ]}
              onPress={() => setCurrentStep(1)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor:
                      currentStep === 1 ? colors.primary : currentStep > 1 ? colors.success : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepBadgeText,
                    { color: currentStep >= 1 ? colors.textWhite : colors.textMuted },
                  ]}
                >
                  {currentStep > 1 ? '✓' : '1'}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepTabText,
                  { color: currentStep === 1 ? colors.primary : colors.textSecondary },
                ]}
              >
                Identity
              </Text>
            </TouchableOpacity>

            {/* Step 2 Tab */}
            <TouchableOpacity
              style={[
                styles.stepTab,
                currentStep === 2 && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
              ]}
              onPress={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor:
                      currentStep === 2 ? colors.primary : currentStep > 2 ? colors.success : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepBadgeText,
                    { color: currentStep >= 2 ? colors.textWhite : colors.textMuted },
                  ]}
                >
                  {currentStep > 2 ? '✓' : '2'}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepTabText,
                  { color: currentStep === 2 ? colors.primary : colors.textSecondary },
                ]}
              >
                Practice
              </Text>
            </TouchableOpacity>

            {/* Step 3 Tab */}
            <TouchableOpacity
              style={[
                styles.stepTab,
                currentStep === 3 && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
              ]}
              onPress={() => {
                if (validateStep1() && validateStep2()) setCurrentStep(3);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor:
                      currentStep === 3 ? colors.primary : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepBadgeText,
                    { color: currentStep === 3 ? colors.textWhite : colors.textMuted },
                  ]}
                >
                  3
                </Text>
              </View>
              <Text
                style={[
                  styles.stepTabText,
                  { color: currentStep === 3 ? colors.primary : colors.textSecondary },
                ]}
              >
                Schedule & Pass
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ============================================================ */}
          {/* STEP 1: IDENTITY & CONTACT                                    */}
          {/* ============================================================ */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionIcon}>🩺</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      Doctor Identity & Verification
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      Official registration & primary contact information
                    </Text>
                  </View>
                </View>

                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Full Name *</Text>
                    {!fullName.toLowerCase().startsWith('dr.') && (
                      <TouchableOpacity
                        onPress={() => setFullName((prev) => (prev ? `Dr. ${prev}` : 'Dr. '))}
                        style={[styles.prefixBadge, { backgroundColor: colors.primaryLight }]}
                      >
                        <Text style={[styles.prefixBadgeText, { color: colors.primary }]}>+ Add &quot;Dr.&quot;</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: stepErrors.fullName ? colors.danger : colors.border,
                      },
                    ]}
                    placeholder="e.g. Dr. Saman Perera"
                    placeholderTextColor={colors.textMuted}
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      if (stepErrors.fullName) setStepErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                  />
                  {stepErrors.fullName ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.fullName}</Text>
                  ) : null}
                </View>

                {/* SLMC Registration Number */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                      SLMC Registration Number *
                    </Text>
                    <View style={[styles.verifiedTag, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.verifiedTagText, { color: colors.success }]}>Official License</Text>
                    </View>
                  </View>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: stepErrors.slmcNumber ? colors.danger : colors.border,
                      },
                    ]}
                    placeholder="e.g. SLMC-12345"
                    placeholderTextColor={colors.textMuted}
                    value={slmcNumber}
                    onChangeText={(val) => {
                      setSlmcNumber(val.toUpperCase());
                      if (stepErrors.slmcNumber) setStepErrors((prev) => ({ ...prev, slmcNumber: '' }));
                    }}
                    autoCapitalize="characters"
                  />
                  {stepErrors.slmcNumber ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.slmcNumber}</Text>
                  ) : (
                    <Text style={[styles.helperText, { color: colors.textMuted }]}>
                      Must match the doctor&apos;s Sri Lanka Medical Council certificate.
                    </Text>
                  )}
                </View>

                {/* Email Address (Login Username) */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                    Email Address (Doctor Login Username) *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: stepErrors.email ? colors.danger : colors.border,
                      },
                    ]}
                    placeholder="e.g. saman.perera@mediheal.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (stepErrors.email) setStepErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {stepErrors.email ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.email}</Text>
                  ) : (
                    <Text style={[styles.helperText, { color: colors.textMuted }]}>
                      Used by the doctor to sign in on the mobile app.
                    </Text>
                  )}
                </View>

                {/* Phone Number */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                    Contact Phone Number *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: stepErrors.phoneNumber ? colors.danger : colors.border,
                      },
                    ]}
                    placeholder="e.g. +94 77 123 4567"
                    placeholderTextColor={colors.textMuted}
                    value={phoneNumber}
                    onChangeText={(val) => {
                      setPhoneNumber(val);
                      if (stepErrors.phoneNumber) setStepErrors((prev) => ({ ...prev, phoneNumber: '' }));
                    }}
                    keyboardType="phone-pad"
                  />
                  {stepErrors.phoneNumber ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.phoneNumber}</Text>
                  ) : null}
                </View>
              </View>

              {/* Navigation button */}
              <View style={styles.stepButtonRow}>
                <AppButton
                  title="Next: Practice & Fees →"
                  onPress={handleNextStep}
                  variant="primary"
                  style={styles.fullWidthBtn}
                />
              </View>
            </View>
          )}

          {/* ============================================================ */}
          {/* STEP 2: PRACTICE & FEES                                      */}
          {/* ============================================================ */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionIcon}>🏥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      Medical Practice & Clinic
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      Specialty, hospital affiliation, fees, and location
                    </Text>
                  </View>
                </View>

                {/* Specialization */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                    Medical Specialization *
                  </Text>
                  <View style={styles.chipsWrap}>
                    {COMMON_SPECIALIZATIONS.map((spec) => {
                      const isSelected = !isCustomSpecialization && specialization === spec;
                      return (
                        <TouchableOpacity
                          key={spec}
                          style={[
                            styles.chipOption,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => {
                            setIsCustomSpecialization(false);
                            setSpecialization(spec);
                            if (stepErrors.specialization) setStepErrors((prev) => ({ ...prev, specialization: '' }));
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: isSelected ? colors.textWhite : colors.textPrimary },
                            ]}
                          >
                            {isSelected ? '✓ ' : ''}{spec}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Other Custom option */}
                    <TouchableOpacity
                      style={[
                        styles.chipOption,
                        {
                          backgroundColor: isCustomSpecialization ? colors.primary : colors.surfaceSecondary,
                          borderColor: isCustomSpecialization ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setIsCustomSpecialization(true)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isCustomSpecialization ? colors.textWhite : colors.textPrimary },
                        ]}
                      >
                        {isCustomSpecialization ? '✓ ' : '+ '}Other Specialty
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isCustomSpecialization && (
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          color: colors.textPrimary,
                          borderColor: stepErrors.specialization ? colors.danger : colors.border,
                          marginTop: spacing.sm,
                        },
                      ]}
                      placeholder="Type custom medical specialty (e.g. Pulmonologist)"
                      placeholderTextColor={colors.textMuted}
                      value={customSpecialization}
                      onChangeText={(val) => {
                        setCustomSpecialization(val);
                        if (stepErrors.specialization) setStepErrors((prev) => ({ ...prev, specialization: '' }));
                      }}
                    />
                  )}
                  {stepErrors.specialization ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.specialization}</Text>
                  ) : null}
                </View>

                {/* Primary Hospital */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                    Primary Hospital / Clinic Affiliation *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: stepErrors.hospital ? colors.danger : colors.border,
                      },
                    ]}
                    placeholder="e.g. Asiri Central Hospital / Lanka Hospitals"
                    placeholderTextColor={colors.textMuted}
                    value={hospital}
                    onChangeText={(val) => {
                      setHospital(val);
                      if (stepErrors.hospital) setStepErrors((prev) => ({ ...prev, hospital: '' }));
                    }}
                  />
                  {stepErrors.hospital ? (
                    <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.hospital}</Text>
                  ) : null}
                </View>

                {/* Experience & Fee */}
                <View style={styles.datesRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Experience (Yrs) *</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          color: colors.textPrimary,
                          borderColor: stepErrors.yearsOfExperience ? colors.danger : colors.border,
                        },
                      ]}
                      placeholder="e.g. 10"
                      placeholderTextColor={colors.textMuted}
                      value={yearsOfExperience}
                      onChangeText={setYearsOfExperience}
                      keyboardType="numeric"
                    />
                    {/* Experience presets */}
                    <View style={styles.miniChipsRow}>
                      {EXPERIENCE_PRESETS.map((yr) => (
                        <TouchableOpacity
                          key={yr}
                          onPress={() => setYearsOfExperience(String(yr))}
                          style={[
                            styles.miniChip,
                            {
                              backgroundColor:
                                yearsOfExperience === String(yr) ? colors.primaryLight : colors.surfaceSecondary,
                              borderColor:
                                yearsOfExperience === String(yr) ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.miniChipText,
                              { color: yearsOfExperience === String(yr) ? colors.primary : colors.textSecondary },
                            ]}
                          >
                            {yr}y
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Fee (LKR) *</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          color: colors.textPrimary,
                          borderColor: stepErrors.consultationFee ? colors.danger : colors.border,
                        },
                      ]}
                      placeholder="e.g. 2500"
                      placeholderTextColor={colors.textMuted}
                      value={consultationFee}
                      onChangeText={setConsultationFee}
                      keyboardType="numeric"
                    />
                    {/* Fee presets */}
                    <View style={styles.miniChipsRow}>
                      {FEE_PRESETS.slice(0, 3).map((f) => (
                        <TouchableOpacity
                          key={f}
                          onPress={() => setConsultationFee(String(f))}
                          style={[
                            styles.miniChip,
                            {
                              backgroundColor:
                                consultationFee === String(f) ? colors.primaryLight : colors.surfaceSecondary,
                              borderColor:
                                consultationFee === String(f) ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.miniChipText,
                              { color: consultationFee === String(f) ? colors.primary : colors.textSecondary },
                            ]}
                          >
                            {f}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Spoken Languages */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Languages Spoken</Text>
                  <View style={styles.chipsWrap}>
                    {LANGUAGE_OPTIONS.map((lang) => {
                      const isSelected = languages.includes(lang);
                      return (
                        <TouchableOpacity
                          key={lang}
                          style={[
                            styles.chipOption,
                            {
                              backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSecondary,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => toggleLanguage(lang)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: isSelected ? colors.primary : colors.textSecondary },
                            ]}
                          >
                            {isSelected ? '✓ ' : '+ '}{lang}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Location Text & Coordinates */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                    Location / City Area (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="e.g. Colombo 07, Western Province"
                    placeholderTextColor={colors.textMuted}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                <View style={styles.datesRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Latitude (Optional)</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          color: colors.textPrimary,
                          borderColor: stepErrors.latitude ? colors.danger : colors.border,
                        },
                      ]}
                      placeholder="e.g. 6.9271"
                      placeholderTextColor={colors.textMuted}
                      value={latitude}
                      onChangeText={setLatitude}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Longitude (Optional)</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          color: colors.textPrimary,
                          borderColor: stepErrors.longitude ? colors.danger : colors.border,
                        },
                      ]}
                      placeholder="e.g. 79.8612"
                      placeholderTextColor={colors.textMuted}
                      value={longitude}
                      onChangeText={setLongitude}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Navigation buttons */}
              <View style={styles.actionRow}>
                <AppButton
                  title="← Back"
                  onPress={handlePrevStep}
                  variant="outline"
                  style={styles.halfBtn}
                />
                <AppButton
                  title="Next: Schedule →"
                  onPress={handleNextStep}
                  variant="primary"
                  style={styles.halfBtn}
                />
              </View>
            </View>
          )}

          {/* ============================================================ */}
          {/* STEP 3: SCHEDULE & LOGIN CREDENTIALS                         */}
          {/* ============================================================ */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionIcon}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      Available Consultation Days
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      Select days doctor accepts appointments
                    </Text>
                  </View>
                </View>

                {/* Day Quick Presets */}
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity
                    style={[styles.presetBadge, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={setAllWeekdays}
                  >
                    <Text style={[styles.presetBadgeText, { color: colors.primary }]}>Weekdays (Mon-Fri)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetBadge, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={setWeekendOnly}
                  >
                    <Text style={[styles.presetBadgeText, { color: colors.primary }]}>Weekend (Sat-Sun)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetBadge, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={setAllDays}
                  >
                    <Text style={[styles.presetBadgeText, { color: colors.primary }]}>Everyday</Text>
                  </TouchableOpacity>
                </View>

                {/* Day Chips */}
                <View style={styles.dayChipsRow}>
                  {DAY_OPTIONS.map((day) => {
                    const isSelected = availableDays.includes(day.key);
                    return (
                      <TouchableOpacity
                        key={day.key}
                        style={[
                          styles.dayPill,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => toggleDay(day.key)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayPillText,
                            { color: isSelected ? colors.textWhite : colors.textPrimary },
                          ]}
                        >
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {stepErrors.availableDays ? (
                  <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.availableDays}</Text>
                ) : (
                  <Text style={[styles.helperText, { color: colors.textMuted }]}>
                    {availableDays.length} day{availableDays.length === 1 ? '' : 's'} currently selected.
                  </Text>
                )}
              </View>

              {/* Time Slots Card */}
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionIcon}>⏰</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      Available Consultation Hours
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      Time slots shown to patients when booking
                    </Text>
                  </View>
                </View>

                {/* Quick Add Presets */}
                <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Quick Slot Presets:</Text>
                <View style={styles.chipsWrap}>
                  {PRESET_SLOTS.map((slot) => {
                    const alreadyAdded = timeSlots.includes(slot);
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.presetSlotChip,
                          {
                            backgroundColor: alreadyAdded ? colors.successLight : colors.surfaceSecondary,
                            borderColor: alreadyAdded ? colors.success : colors.border,
                          },
                        ]}
                        onPress={() => handleAddTimeSlot(slot)}
                        disabled={alreadyAdded}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.presetSlotText,
                            { color: alreadyAdded ? colors.success : colors.textPrimary },
                          ]}
                        >
                          {alreadyAdded ? '✓ Added: ' : '+ '} {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Active Time Slots */}
                <Text style={[styles.subSectionTitle, { color: colors.textSecondary, marginTop: spacing.md }]}>
                  Active Slots ({timeSlots.length}):
                </Text>
                <View style={styles.timeChipsWrap}>
                  {timeSlots.map((slot) => (
                    <View
                      key={slot}
                      style={[
                        styles.timeChip,
                        { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.timeChipText, { color: colors.primary }]}>⏰ {slot}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveTimeSlot(slot)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.removeChipIcon, { color: colors.primary }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* Custom slot input */}
                <View style={styles.addTimeRow}>
                  <TextInput
                    style={[
                      styles.timeInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        color: colors.textPrimary,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Custom slot (e.g. 02:00 PM - 05:00 PM)"
                    placeholderTextColor={colors.textMuted}
                    value={newSlotInput}
                    onChangeText={setNewSlotInput}
                  />
                  <TouchableOpacity
                    style={[styles.addTimeBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleAddTimeSlot()}
                  >
                    <Text style={styles.addTimeBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
                {stepErrors.timeSlots ? (
                  <Text style={[styles.errorText, { color: colors.danger }]}>{stepErrors.timeSlots}</Text>
                ) : null}
              </View>

              {/* Password Setting Card */}
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionIcon}>🔐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      Doctor Login Password
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      Initial login credentials configuration
                    </Text>
                  </View>
                </View>

                {/* Password mode radio */}
                <TouchableOpacity
                  style={[
                    styles.radioOptionCard,
                    {
                      backgroundColor:
                        passwordMode === 'auto' ? colors.primaryLight : colors.surfaceSecondary,
                      borderColor: passwordMode === 'auto' ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setPasswordMode('auto')}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: passwordMode === 'auto' ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {passwordMode === 'auto' && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>
                        ⚡ Auto-Generate Secure Password (Recommended)
                      </Text>
                      <Text style={[styles.radioDesc, { color: colors.textSecondary }]}>
                        Generates a strong randomized temporary password and displays it on the credential modal with 1-tap copy.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioOptionCard,
                    {
                      backgroundColor:
                        passwordMode === 'custom' ? colors.primaryLight : colors.surfaceSecondary,
                      borderColor: passwordMode === 'custom' ? colors.primary : colors.border,
                      marginTop: spacing.sm,
                    },
                  ]}
                  onPress={() => setPasswordMode('custom')}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: passwordMode === 'custom' ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {passwordMode === 'custom' && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.radioLabel, { color: colors.textPrimary }]}>
                        🔑 Set Custom Initial Password
                      </Text>
                      <Text style={[styles.radioDesc, { color: colors.textSecondary }]}>
                        Manually define an initial password for this doctor account.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {passwordMode === 'custom' && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                      Initial Password (Min 6 chars) *
                    </Text>
                    <View style={styles.passwordInputWrap}>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: colors.surfaceSecondary,
                            color: colors.textPrimary,
                            borderColor: stepErrors.customPassword ? colors.danger : colors.border,
                            flex: 1,
                          },
                        ]}
                        placeholder="Enter doctor password"
                        placeholderTextColor={colors.textMuted}
                        value={customPassword}
                        onChangeText={(val) => {
                          setCustomPassword(val);
                          if (stepErrors.customPassword) setStepErrors((prev) => ({ ...prev, customPassword: '' }));
                        }}
                        secureTextEntry={!showCustomPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowCustomPassword(!showCustomPassword)}
                      >
                        <Text style={styles.eyeIcon}>{showCustomPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>
                    {stepErrors.customPassword ? (
                      <Text style={[styles.errorText, { color: colors.danger }]}>
                        {stepErrors.customPassword}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Biography (Optional) */}
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  Doctor Biography & Qualifications (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.multilineInput,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="e.g. MBBS (Colombo), MD (Cardiology), MRCP (UK). 10+ years specializing in heart care."
                  placeholderTextColor={colors.textMuted}
                  value={biography}
                  onChangeText={setBiography}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Review Summary Box */}
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>📋 Registration Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Doctor:</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                    {fullName.toLowerCase().startsWith('dr.') ? fullName : `Dr. ${fullName || '---'}`}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>SLMC Reg:</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>{slmcNumber || '---'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Specialty:</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                    {isCustomSpecialization ? customSpecialization : specialization}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Hospital:</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>{hospital || '---'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Login Email:</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>{email || '---'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Fee & Exp:</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                    LKR {consultationFee} • {yearsOfExperience} yrs
                  </Text>
                </View>
              </View>

              {/* Form Action Buttons */}
              <View style={styles.actionRow}>
                <AppButton
                  title="← Back"
                  onPress={handlePrevStep}
                  variant="outline"
                  style={styles.halfBtn}
                />
                <AppButton
                  title={submitting ? 'Creating...' : '✓ Complete Registration'}
                  onPress={handleSubmit}
                  variant="primary"
                  disabled={submitting}
                  style={styles.halfBtn}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============================================================ */}
      {/* SUCCESS CREDENTIAL MODAL WITH 1-TAP COPY                     */}
      {/* ============================================================ */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Celebration header */}
            <View style={[styles.modalIconWrap, { backgroundColor: colors.successLight }]}>
              <Text style={styles.modalIconText}>🩺</Text>
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Doctor Account Created!
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Account provisioned successfully. Share these login credentials with the doctor:
            </Text>

            {/* Doctor Profile Mini Badge */}
            {createdDoctor && (
              <View style={[styles.miniDocCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.miniDocName, { color: colors.textPrimary }]}>
                  {createdDoctor.fullName}
                </Text>
                <Text style={[styles.miniDocSub, { color: colors.textSecondary }]}>
                  {createdDoctor.specialization} • {createdDoctor.hospital}
                </Text>
                <Text style={[styles.miniDocSlmc, { color: colors.primary }]}>
                  SLMC: {createdDoctor.slmcNumber}
                </Text>
              </View>
            )}

            {/* Credential 1: Email */}
            <View style={[styles.credBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.credLabel, { color: colors.textMuted }]}>LOGIN EMAIL / USERNAME</Text>
                <Text style={[styles.credValue, { color: colors.textPrimary }]} numberOfLines={1}>
                  {createdDoctor?.email}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: colors.primaryLight }]}
                onPress={() => createdDoctor && copyToClipboard(createdDoctor.email, 'Email')}
                activeOpacity={0.7}
              >
                <Text style={[styles.copyBtnText, { color: colors.primary }]}>📋 Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Credential 2: Password */}
            <View style={[styles.credBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.credLabel, { color: colors.textMuted }]}>TEMPORARY LOGIN PASSWORD</Text>
                <Text
                  style={[
                    styles.credValue,
                    styles.monospacePassword,
                    { color: colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {showModalPassword ? createdDoctor?.password : '••••••••••••'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.revealBtn, { borderColor: colors.border }]}
                onPress={() => setShowModalPassword(!showModalPassword)}
              >
                <Text style={styles.revealIcon}>{showModalPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: colors.primaryLight }]}
                onPress={() => createdDoctor && copyToClipboard(createdDoctor.password, 'Password')}
                activeOpacity={0.7}
              >
                <Text style={[styles.copyBtnText, { color: colors.primary }]}>📋 Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Copy Feedback Toast */}
            {copyFeedback ? (
              <View style={[styles.feedbackBadge, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.feedbackText, { color: colors.success }]}>✓ {copyFeedback}</Text>
              </View>
            ) : null}

            {/* Copy All Button */}
            <TouchableOpacity
              style={[styles.copyAllBtn, { backgroundColor: colors.primary }]}
              onPress={copyAllCredentials}
              activeOpacity={0.8}
            >
              <Text style={styles.copyAllBtnText}>📋 Copy All Credentials for Sharing</Text>
            </TouchableOpacity>

            <Text style={[styles.instructionsText, { color: colors.textMuted }]}>
              The doctor can now sign in on the MediHeal app using this email and password.
            </Text>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={handleResetForm}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>
                  + Add Another Doctor
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.textPrimary }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.replace('/(admin)/doctors');
                }}
              >
                <Text style={styles.modalPrimaryBtnText}>Go to Doctor List →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stepBarContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  stepIndicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stepContainer: {
    gap: spacing.md,
  },
  sectionCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionIcon: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  prefixBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  prefixBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  verifiedTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 70,
  },
  helperText: {
    fontSize: 11,
    marginTop: 2,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  datesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  miniChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  miniChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  presetBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetSlotChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  presetSlotText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    gap: spacing.xs,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeChipIcon: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  addTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 6,
    fontSize: 13,
  },
  addTimeBtn: {
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTimeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  radioOptionCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  radioDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyeBtn: {
    padding: spacing.sm,
  },
  eyeIcon: {
    fontSize: 18,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryKey: {
    fontSize: 12,
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  stepButtonRow: {
    marginTop: spacing.xs,
  },
  fullWidthBtn: {
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  halfBtn: {
    flex: 1,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
    ...shadows.card,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  modalIconText: {
    fontSize: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  miniDocCard: {
    width: '100%',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  miniDocName: {
    fontSize: 15,
    fontWeight: '700',
  },
  miniDocSub: {
    fontSize: 12,
    marginTop: 2,
  },
  miniDocSlmc: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  credBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  credLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  credValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  monospacePassword: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  copyBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  revealBtn: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  revealIcon: {
    fontSize: 14,
  },
  feedbackBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    marginVertical: spacing.xs,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  copyAllBtn: {
    width: '100%',
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  copyAllBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  instructionsText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  modalActionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
