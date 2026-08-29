import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { PasswordInput } from '../../components/PasswordInput';
import { AppButton } from '../../components/AppButton';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getStoredLanguage } from '../../utils/languageStorage';
import { useTheme } from '../../context/ThemeContext';

export default function RegisterPatientScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { colors: themeColors } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Field errors
  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  useEffect(() => {
    const loadLanguagePreference = async () => {
      const code = await getStoredLanguage();
      if (code === 'si') setPreferredLanguage('Sinhala');
      else if (code === 'ta') setPreferredLanguage('Tamil');
      else setPreferredLanguage('English');
    };
    loadLanguagePreference();
  }, []);

  const validateForm = (): boolean => {
    let isValid = true;
    setFullNameError('');
    setEmailError('');
    setPhoneError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setErrorMsg('');

    if (!fullName.trim()) {
      setFullNameError('Full name is required');
      isValid = false;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Email address is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!phoneNumber.trim()) {
      setPhoneError('Phone number is required');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
        role: 'patient',
        preferredLanguage,
      });

      router.replace('/(auth)/register-success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Patient registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title="Patient Registration"
        subtitle="Create your MediHeal patient account"
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView
            message={errorMsg}
            onRetry={() => setErrorMsg('')}
            retryText="Dismiss"
          />
        ) : null}

        <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <AppInput
            label="Full Name *"
            placeholder="e.g. Sunil Jayasinghe"
            value={fullName}
            onChangeText={(val) => {
              setFullName(val);
              if (fullNameError) setFullNameError('');
            }}
            error={fullNameError}
          />

          <AppInput
            label="Email Address *"
            placeholder="e.g. sunil@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (emailError) setEmailError('');
            }}
            error={emailError}
          />

          <AppInput
            label="Phone Number *"
            placeholder="e.g. +94779876543"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={(val) => {
              setPhoneNumber(val);
              if (phoneError) setPhoneError('');
            }}
            error={phoneError}
          />

          <PasswordInput
            label="Password *"
            placeholder="Minimum 6 characters"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (passwordError) setPasswordError('');
            }}
            error={passwordError}
          />

          <PasswordInput
            label="Confirm Password *"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={(val) => {
              setConfirmPassword(val);
              if (confirmPasswordError) setConfirmPasswordError('');
            }}
            error={confirmPasswordError}
          />

          <View style={[styles.langInfoBox, { backgroundColor: themeColors.primaryLight }]}>
            <Text style={[styles.langInfoLabel, { color: themeColors.primary }]}>Preferred Language:</Text>
            <Text style={[styles.langInfoValue, { color: themeColors.primaryDark }]}>{preferredLanguage}</Text>
          </View>

          <AppButton
            title="Create Patient Account"
            onPress={handleRegister}
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
  langInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  langInfoLabel: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  langInfoValue: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
});
