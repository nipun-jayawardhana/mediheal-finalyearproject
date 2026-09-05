import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import {
  getLinkedPatients,
  getCaregiverEmergencyAlerts,
} from '../../services/caregiverService';
import { LinkedPatientItem } from '../../types/caregiver';
import { EmergencyAlert } from '../../types/emergency';

export default function CaregiverDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, colors: themeColors } = useTheme();

  const [patients, setPatients] = useState<LinkedPatientItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDashboardData = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const [patientsRes, alertsRes] = await Promise.all([
        getLinkedPatients(),
        getCaregiverEmergencyAlerts(),
      ]);

      if (patientsRes && patientsRes.success) {
        setPatients(patientsRes.data || []);
        if (patientsRes.data && patientsRes.data.length > 0 && !selectedPatientId) {
          setSelectedPatientId(patientsRes.data[0].patient?._id || null);
        }
      }

      if (alertsRes && alertsRes.success) {
        setAlerts(alertsRes.data || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load caregiver dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatientId]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData(true);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData(true);
  };

  const performSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(
        'Are you sure you want to sign out?'
      );
      if (confirmed) {
        await performSignOut();
      }
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performSignOut,
        },
      ]
    );
  };

  if (loading && patients.length === 0) {
    return <LoadingView message="Loading caregiver dashboard..." />;
  }

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const activePatientItem = patients.find((p) => p.patient?._id === selectedPatientId) || patients[0];

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="MediHeal Caregiver"
        subtitle={`Welcome, ${user?.fullName || 'Caregiver'}`}
        rightComponent={
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={[
                styles.themeToggleBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => { void toggleTheme(); }}
              accessibilityRole="button"
              accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.themeToggleIcon, { color: themeColors.textPrimary }]}>
                {isDark ? '☀️' : '🌙'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.logoutHeaderBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.logoutHeaderText, { color: themeColors.danger }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.primary]}
            tintColor={themeColors.primary}
          />
        }
      >
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchDashboardData(true)} />
        ) : null}

        {/* Emergency SOS Banner (Rule 37) */}
        {activeAlerts.length > 0 ? (
          <TouchableOpacity
            style={[
              styles.sosAlertBanner,
              {
                backgroundColor: isDark ? themeColors.dangerLight : '#FEF2F2',
                borderColor: themeColors.danger,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => router.push('/(caregiver)/alerts' as any)}
          >
            <View style={styles.sosBadgeRow}>
              <Text style={styles.sosIconText}>🚨</Text>
              <Text style={[styles.sosBannerTitle, { color: themeColors.danger }]}>
                ACTIVE EMERGENCY ALERT ({activeAlerts.length})
              </Text>
            </View>
            <Text style={[styles.sosBannerSub, { color: themeColors.textSecondary }]}>
              Tap to view and resolve active emergency alert for linked patient.
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.safeBanner,
              {
                backgroundColor: isDark ? themeColors.successLight : '#F0FDF4',
                borderColor: isDark ? '#047857' : '#BBF7D0',
              },
            ]}
          >
            <Text style={styles.safeIcon}>🛡️</Text>
            <View style={styles.safeTextCol}>
              <Text style={[styles.safeTitle, { color: themeColors.success }]}>No Active Emergency Alerts</Text>
              <Text style={[styles.safeSub, { color: themeColors.textSecondary }]}>All linked patients are currently clear.</Text>
            </View>
          </View>
        )}

        {/* Patients Section */}
        {patients.length === 0 ? (
          /* Empty State - No Patients Linked */
          <View
            style={[
              styles.emptyPatientsCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
          >
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Patients Linked Yet</Text>
            <Text style={[styles.emptyDesc, { color: themeColors.textSecondary }]}>
              Link your family member or patient using their MediHeal caregiver link code to monitor care plans and emergency alerts.
            </Text>
            <AppButton
              title="🔗 Link a Patient"
              onPress={() => router.push('/(caregiver)/link-patient' as any)}
              variant="primary"
              style={styles.linkBtn}
            />
          </View>
        ) : (
          /* Patients Dashboard Section */
          <View style={styles.dashboardSection}>
            {/* Multiple Patients Selector Tabs if > 1 */}
            {patients.length > 1 && (
              <View style={styles.patientsTabsRow}>
                {patients.map((item) => {
                  const isSelected = activePatientItem?.patient?._id === item.patient?._id;
                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={[
                        styles.patientTab,
                        { backgroundColor: themeColors.card, borderColor: themeColors.border },
                        isSelected && {
                          backgroundColor: themeColors.primary,
                          borderColor: themeColors.primary,
                        },
                      ]}
                      onPress={() => setSelectedPatientId(item.patient._id)}
                    >
                      <Text
                        style={[
                          styles.patientTabText,
                          { color: themeColors.textSecondary },
                          isSelected && styles.patientTabTextSelected,
                        ]}
                      >
                        {item.patient?.fullName || 'Patient'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Primary Elder Care Overview Card */}
            {activePatientItem && activePatientItem.patient && (
              <View
                style={[
                  styles.patientCard,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: themeColors.primaryLight,
                        borderColor: themeColors.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: themeColors.primary }]}>
                      {activePatientItem.patient.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .filter(Boolean)
                        .join('')
                        .substring(0, 2)
                        .toUpperCase() || 'PT'}
                    </Text>
                  </View>
                  <View style={styles.patientInfoCol}>
                    <Text style={[styles.patientName, { color: themeColors.textPrimary }]}>
                      {activePatientItem.patient.fullName}
                    </Text>
                    <Text style={[styles.patientRel, { color: themeColors.textMuted }]}>
                      {activePatientItem.relationship || 'Care Recipient'} • Linked
                    </Text>
                  </View>
                </View>

                {/* Primary Quick Actions */}
                <View style={styles.actionsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.actionCard,
                      {
                        backgroundColor: themeColors.surfaceSecondary,
                        borderColor: themeColors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/(caregiver)/patient-overview' as any,
                        params: { id: activePatientItem.patient._id },
                      })
                    }
                  >
                    <Text style={styles.actionIcon}>📋</Text>
                    <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>Care Overview</Text>
                    <Text style={[styles.actionSub, { color: themeColors.textMuted }]}>Vitals, Consults & Notes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionCard,
                      {
                        backgroundColor: themeColors.surfaceSecondary,
                        borderColor: themeColors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/(caregiver)/medication-add' as any,
                        params: { patientId: activePatientItem.patient._id },
                      })
                    }
                  >
                    <Text style={styles.actionIcon}>💊</Text>
                    <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>Add Medication</Text>
                    <Text style={[styles.actionSub, { color: themeColors.textMuted }]}>Prescribe & Schedule</Text>
                  </TouchableOpacity>
                </View>

                {/* Patient Profile Link Code Reference */}
                {activePatientItem.patientProfile?.caregiverLinkCode ? (
                  <View style={styles.linkCodeFooter}>
                    <Text style={[styles.linkCodeLabel, { color: themeColors.textMuted }]}>
                      Link Code: {activePatientItem.patientProfile.caregiverLinkCode}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Quick Action: Link Another Patient */}
            <TouchableOpacity
              style={[
                styles.linkAnotherBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => router.push('/(caregiver)/link-patient' as any)}
            >
              <Text style={[styles.linkAnotherText, { color: themeColors.primary }]}>+ Link Another Patient</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Safety & Alerts Quick Access */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
          activeOpacity={0.8}
          onPress={() => router.push('/(caregiver)/alerts' as any)}
        >
          <Text style={styles.menuIcon}>🚨</Text>
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>Emergency Safety Alerts</Text>
            <Text style={[styles.menuSub, { color: themeColors.textMuted }]}>View and resolve active emergency signals</Text>
          </View>
          <Text style={[styles.menuArrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* Community Health Forum Reuse */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
          activeOpacity={0.8}
          onPress={() => router.push('/(caregiver)/community' as any)}
        >
          <Text style={styles.menuIcon}>💬</Text>
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>Community Health Forum</Text>
            <Text style={[styles.menuSub, { color: themeColors.textMuted }]}>Ask questions & share caregiving support</Text>
          </View>
          <Text style={[styles.menuArrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* Caregiver Account Info */}
        <View
          style={[
            styles.accountCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <Text style={[styles.accountTitle, { color: themeColors.textMuted }]}>Caregiver Account</Text>
          <Text style={[styles.accountDetail, { color: themeColors.textSecondary }]}>Email: {user?.email}</Text>
          <Text style={[styles.accountDetail, { color: themeColors.textSecondary }]}>Phone: {user?.phoneNumber || 'N/A'}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  themeToggleIcon: {
    fontSize: 18,
  },
  logoutHeaderBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  logoutHeaderText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
  },
  sosAlertBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.danger,
    ...shadows.card,
  },
  sosBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sosIconText: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  sosBannerTitle: {
    ...typography.header,
    fontSize: 16,
    color: colors.danger,
    fontWeight: '900',
  },
  sosBannerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
  },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  safeIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  safeTextCol: {
    flex: 1,
  },
  safeTitle: {
    ...typography.subheader,
    fontSize: 15,
    color: colors.success,
    fontWeight: '800',
  },
  safeSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  emptyPatientsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  emptyDesc: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  linkBtn: {
    width: '100%',
    minHeight: 46,
  },
  dashboardSection: {
    marginBottom: spacing.md,
  },
  patientsTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  patientTab: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patientTabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  patientTabText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  patientTabTextSelected: {
    color: '#FFFFFF',
  },
  patientCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    ...typography.header,
    fontSize: 18,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  patientInfoCol: {
    flex: 1,
  },
  patientName: {
    ...typography.header,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  patientRel: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  actionSub: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  linkCodeFooter: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  linkCodeLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  linkAnotherBtn: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkAnotherText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  menuSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  menuArrow: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.primary,
  },
  accountCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountTitle: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 4,
  },
  accountDetail: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
