import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { InfoCard } from '../../components/InfoCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../constants/theme';

export default function AdminPlaceholderScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader title="Admin Portal" subtitle="Placeholder Screen" />

      <View style={styles.content}>
        <InfoCard
          title={`Welcome, ${user?.fullName || 'Administrator'}!`}
          subtitle={`Email: ${user?.email || 'N/A'}`}
          badge={<StatusBadge status="warning" label="ADMIN ROLE" />}
        >
          <Text style={styles.infoText}>
            Phone: {user?.phoneNumber || 'N/A'}
          </Text>
        </InfoCard>

        <View style={styles.placeholderCard}>
          <Text style={styles.icon}>⚙️</Text>
          <Text style={styles.title}>Admin Module Ready</Text>
          <Text style={styles.description}>
            Authentication and role-based routing passed successfully. System management and doctor creation features will be connected in future modules.
          </Text>
        </View>

        <AppButton
          title="Log Out"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutBtn}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  placeholderCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.subheader,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  logoutBtn: {
    marginTop: spacing.md,
  },
});
