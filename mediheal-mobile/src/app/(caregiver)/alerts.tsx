import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import {
  getCaregiverEmergencyAlerts,
  resolveEmergencyAlert,
} from '../../services/caregiverService';
import { EmergencyAlert } from '../../types/emergency';

export default function CaregiverAlertsScreen() {
  const router = useRouter();
  const { isDark, colors: themeColors } = useTheme();

  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchAlerts = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getCaregiverEmergencyAlerts();
      if (res && res.success) {
        setAlerts(res.data || []);
      } else {
        setErrorMsg(res.message || 'Failed to load emergency alerts.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve emergency alerts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlerts(true);
  };

  const handleResolveAlert = (alertItem: EmergencyAlert) => {
    const patientName =
      typeof alertItem.patientId === 'object' && alertItem.patientId?.fullName
        ? alertItem.patientId.fullName
        : 'the patient';

    Alert.alert(
      'Resolve Emergency Alert',
      `Mark emergency alert for ${patientName} as resolved? This updates the MediHeal alert status.`,
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Resolve Alert',
          style: 'default',
          onPress: () => performResolveAlert(alertItem._id),
        },
      ]
    );
  };

  const performResolveAlert = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      const res = await resolveEmergencyAlert(alertId);
      if (res && res.success) {
        Alert.alert('Alert Resolved', 'The emergency alert status has been set to resolved.');
        fetchAlerts(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to resolve emergency alert.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to resolve emergency alert.');
    } finally {
      setResolvingId(null);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return (
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
        ` on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      );
    } catch (e) {
      return isoStr;
    }
  };

  if (loading && alerts.length === 0) {
    return <LoadingView message="Loading emergency alerts..." />;
  }

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const pastAlerts = alerts.filter((a) => a.status !== 'active');

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Emergency Alerts"
        subtitle="Linked Patient Safety Monitoring"
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchAlerts(true)} />
        ) : null}

        {!errorMsg && alerts.length === 0 && (
          <EmptyState
            icon="🚨"
            title="No Emergency Alerts"
            description="Your linked patients currently have no active or historical emergency alerts."
          />
        )}

        {!errorMsg && alerts.length > 0 && (
          <FlatList
            data={[{ key: 'content' }]}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[themeColors.danger]}
                tintColor={themeColors.danger}
              />
            }
            renderItem={() => (
              <View style={styles.listSection}>
                {/* Active Emergency Alerts Section */}
                {activeAlerts.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitleActive, { color: themeColors.danger }]}>
                      🚨 Active Emergency Alerts ({activeAlerts.length})
                    </Text>
                    {activeAlerts.map((alertItem) => {
                      const patientName =
                        typeof alertItem.patientId === 'object' && alertItem.patientId?.fullName
                          ? alertItem.patientId.fullName
                          : 'Linked Patient';

                      const isResolving = resolvingId === alertItem._id;

                      return (
                        <View
                          key={alertItem._id}
                          style={[
                            styles.activeAlertCard,
                            {
                              backgroundColor: isDark ? themeColors.dangerLight : '#FEF2F2',
                              borderColor: themeColors.danger,
                            },
                          ]}
                        >
                          <View style={styles.alertHeaderRow}>
                            <Text style={[styles.patientName, { color: themeColors.danger }]}>👤 {patientName}</Text>
                            <View style={[styles.activeBadge, { backgroundColor: themeColors.danger }]}>
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          </View>

                          <Text style={[styles.alertTime, { color: themeColors.textSecondary }]}>
                            ⏰ Triggered: {formatDate(alertItem.createdAt)}
                          </Text>

                          <View
                            style={[
                              styles.messageBox,
                              {
                                backgroundColor: themeColors.card,
                                borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
                              },
                            ]}
                          >
                            <Text style={[styles.messageLabel, { color: themeColors.textMuted }]}>Message:</Text>
                            <Text style={[styles.messageText, { color: themeColors.textPrimary }]}>{alertItem.message}</Text>
                          </View>

                          {alertItem.emergencyContactName ? (
                            <Text style={[styles.contactInfo, { color: themeColors.textSecondary }]}>
                              Emergency Contact: {alertItem.emergencyContactName} (
                              {alertItem.emergencyContactPhone || 'N/A'})
                            </Text>
                          ) : null}

                          <AppButton
                            title={isResolving ? 'Resolving...' : 'Resolve Alert'}
                            onPress={() => handleResolveAlert(alertItem)}
                            variant="primary"
                            disabled={isResolving}
                            style={styles.resolveBtn}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Past / Resolved Alerts Section */}
                {pastAlerts.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      Alert History ({pastAlerts.length})
                    </Text>
                    {pastAlerts.map((alertItem) => {
                      const patientName =
                        typeof alertItem.patientId === 'object' && alertItem.patientId?.fullName
                          ? alertItem.patientId.fullName
                          : 'Linked Patient';

                      return (
                        <View
                          key={alertItem._id}
                          style={[
                            styles.pastAlertCard,
                            {
                              backgroundColor: themeColors.card,
                              borderColor: themeColors.border,
                            },
                          ]}
                        >
                          <View style={styles.alertHeaderRow}>
                            <Text style={[styles.pastPatientName, { color: themeColors.textPrimary }]}>
                              {patientName}
                            </Text>
                            <View
                              style={[
                                styles.pastBadge,
                                { backgroundColor: themeColors.primaryLight },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pastBadgeText,
                                  { color: themeColors.primary },
                                ]}
                              >
                                {alertItem.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.pastTime, { color: themeColors.textMuted }]}>
                            {formatDate(alertItem.createdAt)}
                          </Text>
                          <Text style={[styles.pastMessage, { color: themeColors.textSecondary }]}>
                            {alertItem.message}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  listSection: {
    paddingBottom: spacing.xl,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitleActive: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.danger,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  activeAlertCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.danger,
    ...shadows.card,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patientName: {
    ...typography.header,
    fontSize: 18,
    color: colors.danger,
    fontWeight: '800',
  },
  activeBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  activeBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  alertTime: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  messageBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#FCA5A5',
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
  contactInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  resolveBtn: {
    marginTop: spacing.xs,
    minHeight: 42,
  },
  pastAlertCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pastPatientName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  pastBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  pastBadgeText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  pastTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  pastMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
