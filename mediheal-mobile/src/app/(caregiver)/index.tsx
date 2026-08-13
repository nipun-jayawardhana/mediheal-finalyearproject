import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import {
  getLinkedPatients,
  getCaregiverEmergencyAlerts,
} from '../../services/caregiverService';
import { LinkedPatientItem } from '../../types/caregiver';
import { EmergencyAlert } from '../../types/emergency';

export default function CaregiverDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

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

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out of MediHeal Caregiver?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading && patients.length === 0) {
    return <LoadingView message="Loading caregiver dashboard..." />;
  }

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const activePatientItem = patients.find((p) => p.patient?._id === selectedPatientId) || patients[0];

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="MediHeal Caregiver"
        subtitle={`Welcome, ${user?.fullName || 'Caregiver'}`}
        rightComponent={
          <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleLogout}>
            <Text style={styles.logoutHeaderText}>Logout</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchDashboardData(true)} />
        ) : null}

        {/* Emergency SOS Banner (Rule 37) */}
        {activeAlerts.length > 0 ? (
          <TouchableOpacity
            style={styles.sosAlertBanner}
            activeOpacity={0.85}
            onPress={() => router.push('/(caregiver)/alerts' as any)}
          >
            <View style={styles.sosBadgeRow}>
              <Text style={styles.sosIconText}>🚨</Text>
              <Text style={styles.sosBannerTitle}>
                ACTIVE EMERGENCY ALERT ({activeAlerts.length})
              </Text>
            </View>
            <Text style={styles.sosBannerSub}>
              Tap to view and resolve active emergency alert for linked patient.
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.safeBanner}>
            <Text style={styles.safeIcon}>🛡️</Text>
            <View style={styles.safeTextCol}>
              <Text style={styles.safeTitle}>No Active Emergency Alerts</Text>
              <Text style={styles.safeSub}>All linked patients are currently clear.</Text>
            </View>
          </View>
        )}

        {/* Patients Section */}
        {patients.length === 0 ? (
          /* Empty State - No Patients Linked */
          <View style={styles.emptyPatientsCard}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyTitle}>No Patients Linked Yet</Text>
            <Text style={styles.emptyDesc}>
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
                      style={[styles.patientTab, isSelected && styles.patientTabSelected]}
                      onPress={() => setSelectedPatientId(item.patient._id)}
                    >
                      <Text
                        style={[
                          styles.patientTabText,
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
              <View style={styles.patientCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
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
                    <Text style={styles.patientName}>{activePatientItem.patient.fullName}</Text>
                    <Text style={styles.patientRel}>
                      {activePatientItem.relationship || 'Care Recipient'} • Linked
                    </Text>
                  </View>
                </View>

                {/* Primary Quick Actions */}
                <View style={styles.actionsGrid}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/(caregiver)/patient-overview' as any,
                        params: { id: activePatientItem.patient._id },
                      })
                    }
                  >
                    <Text style={styles.actionIcon}>📋</Text>
                    <Text style={styles.actionTitle}>Care Overview</Text>
                    <Text style={styles.actionSub}>Vitals, Consults & Notes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/(caregiver)/medication-add' as any,
                        params: { patientId: activePatientItem.patient._id },
                      })
                    }
                  >
                    <Text style={styles.actionIcon}>💊</Text>
                    <Text style={styles.actionTitle}>Add Medication</Text>
                    <Text style={styles.actionSub}>Prescribe & Schedule</Text>
                  </TouchableOpacity>
                </View>

                {/* Patient Profile Link Code Reference */}
                {activePatientItem.patientProfile?.caregiverLinkCode ? (
                  <View style={styles.linkCodeFooter}>
                    <Text style={styles.linkCodeLabel}>
                      Link Code: {activePatientItem.patientProfile.caregiverLinkCode}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Quick Action: Link Another Patient */}
            <TouchableOpacity
              style={styles.linkAnotherBtn}
              onPress={() => router.push('/(caregiver)/link-patient' as any)}
            >
              <Text style={styles.linkAnotherText}>+ Link Another Patient</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Safety & Alerts Quick Access */}
        <TouchableOpacity
          style={styles.menuCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(caregiver)/alerts' as any)}
        >
          <Text style={styles.menuIcon}>🚨</Text>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>Emergency Safety Alerts</Text>
            <Text style={styles.menuSub}>View and resolve active emergency signals</Text>
          </View>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        {/* Community Health Forum Reuse */}
        <TouchableOpacity
          style={[styles.menuCard, { borderColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={() => router.push('/(caregiver)/community' as any)}
        >
          <Text style={styles.menuIcon}>💬</Text>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuTitle}>Community Health Forum</Text>
            <Text style={styles.menuSub}>Ask questions & share caregiving support</Text>
          </View>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        {/* Caregiver Account Info */}
        <View style={styles.accountCard}>
          <Text style={styles.accountTitle}>Caregiver Account</Text>
          <Text style={styles.accountDetail}>Email: {user?.email}</Text>
          <Text style={styles.accountDetail}>Phone: {user?.phoneNumber || 'N/A'}</Text>
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
  logoutHeaderBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutHeaderText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.danger,
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
