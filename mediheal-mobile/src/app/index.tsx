import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { checkBackendHealth } from '../services/healthService';
import { API_URL } from '../config/env';

export default function SplashScreen() {
  const router = useRouter();
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

        {/* Action Button */}
        <View style={styles.actionSection}>
          <AppButton
            title="Get Started / Select Language"
            onPress={() => router.push('/language')}
            variant="secondary"
            style={styles.continueBtn}
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
  continueBtn: {
    backgroundColor: colors.textWhite,
  },
});
