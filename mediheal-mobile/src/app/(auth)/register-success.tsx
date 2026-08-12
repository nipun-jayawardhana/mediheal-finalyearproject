import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppButton } from '../../components/AppButton';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function RegisterSuccessScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const handleContinue = () => {
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    switch (user.role) {
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
        router.replace('/(auth)/login');
    }
  };

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>

          <Text style={styles.title}>Account Created!</Text>
          <Text style={styles.subtitle}>
            Welcome to MediHeal. Your account has been registered and activated successfully.
          </Text>

          {user && (
            <View style={styles.userBox}>
              <Text style={styles.userName}>{user.fullName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={styles.badgeWrapper}>
                <StatusBadge status="active" label={`ROLE: ${user.role.toUpperCase()}`} />
              </View>
            </View>
          )}

          <AppButton
            title="Continue to App"
            onPress={handleContinue}
            style={styles.continueBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  userBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userName: {
    ...typography.subheader,
    color: colors.textPrimary,
  },
  userEmail: {
    ...typography.caption,
    marginTop: 2,
  },
  badgeWrapper: {
    marginTop: spacing.sm,
  },
  continueBtn: {
    width: '100%',
  },
});
