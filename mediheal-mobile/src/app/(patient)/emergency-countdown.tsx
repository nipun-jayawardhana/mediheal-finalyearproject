import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { colors, spacing, typography, shadows } from '../../constants/theme';
import { createEmergencyAlert, getActiveEmergencyAlert } from '../../services/emergencyService';
import { useTheme } from '../../context/ThemeContext';

export default function EmergencyCountdownScreen() {
  const router = useRouter();
  const { isDark, colors: themeColors } = useTheme();

  const [count, setCount] = useState<number>(5);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);

  // Check if an active emergency already exists on mount
  useEffect(() => {
    let isMounted = true;

    const checkExistingActive = async () => {
      try {
        const activeAlert = await getActiveEmergencyAlert();
        if (activeAlert && activeAlert.status === 'active' && isMounted) {
          // Redirect immediately to Active screen
          router.replace({
            pathname: '/(patient)/emergency-active' as any,
            params: { id: activeAlert._id },
          });
        }
      } catch (e) {
        // Continue with countdown if check fails
      }
    };

    checkExistingActive();

    return () => {
      isMounted = false;
    };
  }, []);

  // 5-second countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // When count reaches 0, trigger real emergency alert creation
  useEffect(() => {
    if (count === 0 && !hasTriggeredRef.current && !isActivating) {
      hasTriggeredRef.current = true;
      triggerEmergencyAlert();
    }
  }, [count]);

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.replace('/(patient)' as any);
  };

  const triggerEmergencyAlert = async () => {
    setIsActivating(true);
    setErrorMsg('');

    try {
      const res = await createEmergencyAlert({
        message: 'Emergency SOS triggered by patient from mobile app',
      });

      if (res && res.success && res.data?._id) {
        // Navigate to Emergency SOS Active screen with returned alert ID
        router.replace({
          pathname: '/(patient)/emergency-active' as any,
          params: { id: res.data._id },
        });
      } else {
        setErrorMsg(res.message || "We couldn't activate the MediHeal emergency alert.");
        setIsActivating(false);
      }
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Network error: Failed to connect to MediHeal emergency service.'
      );
      setIsActivating(false);
    }
  };

  return (
    <ScreenContainer backgroundColor={isDark ? '#180E10' : '#FDF2F2'}>
      {/* Top Header: Cancel Exit Button & Red Emergency Title */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={handleCancel}
          disabled={isActivating}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency SOS</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.mainContent}>
        {isActivating ? (
          <View style={styles.activatingContainer}>
            <ActivityIndicator size="large" color={colors.danger} />
            <Text style={styles.activatingText}>Activating emergency alert...</Text>
            <Text style={styles.activatingSub}>Notifying your emergency contact & caregivers</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Activation Failed</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                hasTriggeredRef.current = false;
                triggerEmergencyAlert();
              }}
            >
              <Text style={styles.retryBtnText}>Retry Activation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.returnBtn} onPress={handleCancel}>
              <Text style={styles.returnBtnText}>Return Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Warning Message */}
            <View style={styles.warningContainer}>
              <Text style={styles.warningTitle}>
                Emergency alert will be sent in{' '}
                <Text style={styles.countdownDigit}>{count}</Text> seconds...
              </Text>
              <Text style={styles.warningSubtitle}>
                Tap CANCEL below if this was a mistake.
              </Text>
            </View>

            {/* Large Red Elderly-Friendly CANCEL Circle Button */}
            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                style={styles.cancelCircleBtn}
                activeOpacity={0.8}
                onPress={handleCancel}
              >
                <View style={styles.cancelInnerRing}>
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.danger,
  },
  headerTitle: {
    ...typography.header,
    fontSize: 22,
    color: colors.danger,
    fontWeight: '900',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  warningContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  warningTitle: {
    ...typography.header,
    fontSize: 24,
    color: colors.danger,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
  },
  countdownDigit: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.danger,
    textDecorationLine: 'underline',
  },
  warningSubtitle: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  buttonWrapper: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCircleBtn: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    ...shadows.card,
    elevation: 8,
  },
  cancelInnerRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.header,
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 2,
  },
  activatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activatingText: {
    ...typography.header,
    fontSize: 20,
    color: colors.danger,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  activatingSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    ...typography.header,
    fontSize: 22,
    color: colors.danger,
    fontWeight: '800',
  },
  errorText: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 25,
    marginBottom: spacing.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  returnBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  returnBtnText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
});
