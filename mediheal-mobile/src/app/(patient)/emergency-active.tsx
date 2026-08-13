import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getEmergencyAlertById, cancelEmergencyAlert, getActiveEmergencyAlert } from '../../services/emergencyService';
import { EmergencyAlert } from '../../types/emergency';

export default function EmergencyActiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [alertData, setAlertData] = useState<EmergencyAlert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchAlert = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      let targetId = params.id;

      // If no ID in route params, fetch the patient's active emergency
      if (!targetId) {
        const active = await getActiveEmergencyAlert();
        if (active) {
          setAlertData(active);
          setLoading(false);
          return;
        } else {
          setErrorMsg('No active emergency alert record found.');
          setLoading(false);
          return;
        }
      }

      const res = await getEmergencyAlertById(targetId);
      if (res && res.success && res.data) {
        setAlertData(res.data);
      } else {
        setErrorMsg('Failed to load emergency alert details.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve emergency alert.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const handleCancelAlert = () => {
    if (!alertData) return;

    Alert.alert(
      'Cancel Emergency Alert',
      'Are you sure you want to cancel this emergency alert?',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel Emergency Alert',
          style: 'destructive',
          onPress: performCancellation,
        },
      ]
    );
  };

  const performCancellation = async () => {
    if (!alertData) return;
    setCancelling(true);

    try {
      const res = await cancelEmergencyAlert(alertData._id, 'Cancelled by patient from mobile app');
      if (res && res.success) {
        Alert.alert('Alert Cancelled', 'Your emergency alert has been cancelled.');
        router.replace('/(patient)' as any);
      } else {
        Alert.alert('Error', res.message || 'Failed to cancel emergency alert.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to process emergency cancellation.');
    } finally {
      setCancelling(false);
    }
  };

  // Format creation timestamp cleanly
  const formatTime = (isoStr?: string) => {
    if (!isoStr) return 'Just now';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ` on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    } catch (e) {
      return isoStr;
    }
  };

  if (loading) {
    return <LoadingView message="Loading emergency alert details..." />;
  }

  if (errorMsg || !alertData) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Emergency SOS" onBackPress={() => router.replace('/(patient)' as any)} />
        <ErrorView message={errorMsg || 'Emergency record not found.'} onRetry={fetchAlert} />
      </ScreenContainer>
    );
  }

  const isStillActive = alertData.status === 'active';

  return (
    <ScreenContainer backgroundColor="#FDF2F2">
      <AppHeader
        title="Emergency SOS Active"
        subtitle="Live Alert Status"
        onBackPress={() => router.replace('/(patient)' as any)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Large Emergency Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBadge}>
            <Text style={styles.heroIconText}>🚨</Text>
          </View>
          <Text style={styles.heroTitle}>
            {isStillActive ? 'EMERGENCY ALERT ACTIVE' : `ALERT ${alertData.status.toUpperCase()}`}
          </Text>
          <Text style={styles.heroSub}>
            {isStillActive
              ? 'Your emergency alert has been registered and sent to your linked caregivers.'
              : `This emergency alert is marked as ${alertData.status}.`}
          </Text>
        </View>

        {/* Emergency Alert Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Alert Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isStillActive ? colors.dangerLight : colors.successLight },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: isStillActive ? colors.danger : colors.success },
                ]}
              >
                {alertData.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Activated At:</Text>
            <Text style={styles.infoValue}>{formatTime(alertData.createdAt)}</Text>
          </View>

          {alertData.message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageLabel}>Alert Message:</Text>
              <Text style={styles.messageText}>{alertData.message}</Text>
            </View>
          ) : null}

          {/* Emergency Contact Information */}
          {alertData.emergencyContactName ? (
            <View style={styles.contactBox}>
              <Text style={styles.contactHeader}>Registered Emergency Contact</Text>
              <Text style={styles.contactName}>👤 {alertData.emergencyContactName}</Text>
              {alertData.emergencyContactPhone ? (
                <Text style={styles.contactPhone}>📞 {alertData.emergencyContactPhone}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Linked Caregivers count */}
          {alertData.caregiverIds && alertData.caregiverIds.length > 0 ? (
            <View style={styles.caregiverNotice}>
              <Text style={styles.caregiverNoticeText}>
                👥 Shared with {alertData.caregiverIds.length} linked caregiver(s)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Actions Section */}
        {isStillActive && (
          <View style={styles.actionsContainer}>
            <AppButton
              title={cancelling ? 'Cancelling Alert...' : 'Cancel Emergency Alert'}
              onPress={handleCancelAlert}
              variant="danger"
              disabled={cancelling}
              style={styles.cancelAlertBtn}
            />

            <TouchableOpacity
              style={styles.returnHomeBtn}
              onPress={() => router.replace('/(patient)' as any)}
            >
              <Text style={styles.returnHomeText}>Return to Home Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.danger,
    ...shadows.card,
  },
  heroIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroIconText: {
    fontSize: 32,
  },
  heroTitle: {
    ...typography.header,
    fontSize: 20,
    color: colors.danger,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  heroSub: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 12,
  },
  messageBox: {
    marginTop: spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  messageText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  contactBox: {
    marginTop: spacing.md,
    backgroundColor: '#FFF5F5',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FEB2B2',
  },
  contactHeader: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  contactName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  contactPhone: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  caregiverNotice: {
    marginTop: spacing.md,
    backgroundColor: '#EFF6FF',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  caregiverNoticeText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  actionsContainer: {
    marginTop: spacing.sm,
  },
  cancelAlertBtn: {
    minHeight: 48,
    borderRadius: borderRadius.md,
  },
  returnHomeBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  returnHomeText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
