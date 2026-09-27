import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppInput } from '../../components/AppInput';
import { PasswordInput } from '../../components/PasswordInput';
import { AppButton } from '../../components/AppButton';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

type LoginRole = 'patient' | 'doctor' | 'caregiver';

export default function LoginScreen() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const { colors: themeColors, isDark } = useTheme();
  const { t } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<LoginRole>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setErrorMsg('');

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setEmailError('Please enter your email address');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter your password');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const loggedUser = await login({
        email: email.trim(),
        password,
        role: selectedRole,
      });

      // Role Selection Validation: Role selection is a filter, reject if mismatch (admin exempt)
      if (loggedUser.role !== 'admin' && loggedUser.role !== selectedRole) {
        await logout();
        setErrorMsg(t('wrongAccountType'));
        return;
      }

      // Route based on role
      switch (loggedUser.role) {
        case 'patient':
          router.replace('/(patient)');
          break;
        case 'caregiver':
          router.replace('/(caregiver)');
          break;
        case 'doctor':
          router.replace('/(doctor)');
          break;
        case 'admin':
          router.replace('/(admin)');
          break;
        default:
          router.replace('/(patient)');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader title="Sign In" subtitle="Welcome back to MediHeal" />

      <View style={styles.content}>
        {/* Brand Banner */}
        <View style={styles.brandBox}>
          <Text style={styles.brandIcon}>🩺</Text>
          <Text style={[styles.brandTitle, { color: themeColors.primary }]}>MediHeal Account</Text>
        </View>

        {errorMsg ? (
          <ErrorView
            message={errorMsg}
            onRetry={() => setErrorMsg('')}
            retryText="Dismiss"
          />
        ) : null}

        {/* Login Form */}
        <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          {/* Role Selection Toggle */}
          <View style={styles.roleToggleContainer}>
            <Text style={[styles.roleToggleLabel, { color: themeColors.textSecondary }]}>
              {t('selectAccountType')}
            </Text>
            <View
              style={[
                styles.roleToggleRow,
                { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.roleToggleBtn,
                  selectedRole === 'patient' && [
                    styles.roleToggleBtnActive,
                    { backgroundColor: themeColors.primary },
                  ],
                ]}
                onPress={() => setSelectedRole('patient')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.roleToggleBtnText,
                    { color: themeColors.textSecondary },
                    selectedRole === 'patient' && styles.roleToggleBtnTextActive,
                  ]}
                >
                  👤 {t('patient')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleToggleBtn,
                  selectedRole === 'doctor' && [
                    styles.roleToggleBtnActive,
                    { backgroundColor: themeColors.primary },
                  ],
                ]}
                onPress={() => setSelectedRole('doctor')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.roleToggleBtnText,
                    { color: themeColors.textSecondary },
                    selectedRole === 'doctor' && styles.roleToggleBtnTextActive,
                  ]}
                >
                  👨‍⚕️ {t('doctor')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleToggleBtn,
                  selectedRole === 'caregiver' && [
                    styles.roleToggleBtnActive,
                    { backgroundColor: themeColors.primary },
                  ],
                ]}
                onPress={() => setSelectedRole('caregiver')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.roleToggleBtnText,
                    { color: themeColors.textSecondary },
                    selectedRole === 'caregiver' && styles.roleToggleBtnTextActive,
                  ]}
                >
                  🤝 {t('caregiver')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <AppInput
            label="Email Address"
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

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (passwordError) setPasswordError('');
            }}
            error={passwordError}
          />

          <AppButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.signInBtn}
          />
        </View>

        {/* Links for Registration */}
        <View style={styles.registerSection}>
          <Text style={[styles.registerPrompt, { color: themeColors.textSecondary }]}>Don't have a MediHeal account?</Text>

          <TouchableOpacity
            style={[styles.regOptionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('/(auth)/register-patient')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Register as Patient"
          >
            <Text style={styles.regOptionIcon}>👤</Text>
            <View style={styles.regOptionTextCol}>
              <Text style={[styles.regOptionTitle, { color: themeColors.primary }]}>Register as Patient</Text>
              <Text style={[styles.regOptionSub, { color: themeColors.textSecondary }]}>For personal medical navigation & care</Text>
            </View>
            <Text style={[styles.arrow, { color: themeColors.primary }]}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.regOptionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('/(auth)/register-caregiver')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Register as Caregiver"
          >
            <Text style={styles.regOptionIcon}>🤝</Text>
            <View style={styles.regOptionTextCol}>
              <Text style={[styles.regOptionTitle, { color: themeColors.primary }]}>Register as Caregiver</Text>
              <Text style={[styles.regOptionSub, { color: themeColors.textSecondary }]}>For family members & senior caregivers</Text>
            </View>
            <Text style={[styles.arrow, { color: themeColors.primary }]}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.sm,
  },
  brandBox: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  brandIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  brandTitle: {
    ...typography.header,
    color: colors.primary,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signInBtn: {
    marginTop: spacing.md,
  },
  registerSection: {
    marginTop: spacing.lg,
  },
  registerPrompt: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  regOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regOptionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  regOptionTextCol: {
    flex: 1,
  },
  regOptionTitle: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  regOptionSub: {
    ...typography.caption,
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  roleToggleContainer: {
    marginBottom: spacing.md,
  },
  roleToggleLabel: {
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  roleToggleRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  roleToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleToggleBtnActive: {
    ...shadows.card,
  },
  roleToggleBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },
  roleToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
