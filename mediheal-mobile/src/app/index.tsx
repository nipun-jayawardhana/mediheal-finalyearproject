import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { checkBackendHealth } from '../services/healthService';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/env';

export default function SplashScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const testBackendConnection = async () => {
    setHealthStatus('checking');
    setErrorMessage('');
    try {
      const res = await checkBackendHealth();
      if (res && res.success) {
        setHealthStatus('connected');
      } else {
        setHealthStatus('failed');
        setErrorMessage(res.message || 'Health check returned unexpected response');
      }
    } catch (err: any) {
      setHealthStatus('failed');
      setErrorMessage(err.message || 'Unable to connect to backend server');
    }
  };

  useEffect(() => {
    testBackendConnection();
  }, []);

  // Session auto-routing if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
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
      }
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <ScreenContainer backgroundColor={colors.primary}>
      <View style={styles.content}>
        {/* Top Logo / Icon Area */}
        <View style={styles.brandSection}>
          <View style={styles.iconCircle}>
            <Text style={styles.brandIcon}>🩺</Text>
          </View>
          <Text style={styles.appName}>MediHeal</Text>
          <Text style={styles.tagline}>
            Smart Healthcare Navigation for Senior Citizens & Caregivers
          </Text>
        </View>

        {/* Backend Connection Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>Backend Service Connection</Text>
          <Text style={styles.apiUrlText}>Endpoint: {API_URL}/health</Text>

          {healthStatus === 'checking' && (
            <View style={styles.statusRow}>
              <StatusBadge status="pending" label="CONNECTING..." />
              <Text style={styles.statusText}>Checking API server status...</Text>
            </View>
          )}

          {healthStatus === 'connected' && (
            <View style={styles.statusRow}>
              <StatusBadge status="confirmed" label="CONNECTED" />
              <Text style={[styles.statusText, { color: colors.success }]}>
                Backend server is online and responding.
              </Text>
            </View>
          )}

          {healthStatus === 'failed' && (
            <View style={styles.statusColumn}>
              <View style={styles.statusRow}>
                <StatusBadge status="emergency" label="FAILED" />
                <Text style={[styles.statusText, { color: colors.danger }]}>
                  Unable to connect
                </Text>
              </View>
              <Text style={styles.errorDetail}>{errorMessage}</Text>
              <AppButton
                title="Retry Connection"
                onPress={testBackendConnection}
                variant="outline"
                style={styles.retryBtn}
              />
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <AppButton
            title="Sign In to MediHeal"
            onPress={() => router.push('/(auth)/login')}
            variant="secondary"
            style={styles.signInBtn}
          />

          <AppButton
            title="Select Language"
            onPress={() => router.push('/language')}
            variant="outline"
            textStyle={styles.langBtnText}
            style={styles.langBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  brandIcon: {
    fontSize: 48,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 1,
  },
  tagline: {
    ...typography.body,
    color: '#DBEAFE',
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.lg,
  },
  statusCardTitle: {
    ...typography.subheader,
    color: colors.textPrimary,
  },
  apiUrlText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusColumn: {
    marginTop: spacing.xs,
  },
  statusText: {
    ...typography.body,
    marginLeft: spacing.sm,
    flex: 1,
  },
  errorDetail: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  retryBtn: {
    marginTop: spacing.sm,
    height: 42,
  },
  actionSection: {
    marginBottom: spacing.sm,
  },
  signInBtn: {
    backgroundColor: colors.textWhite,
  },
  langBtn: {
    borderColor: colors.textWhite,
    marginTop: spacing.xs,
  },
  langBtnText: {
    color: colors.textWhite,
  },
});
