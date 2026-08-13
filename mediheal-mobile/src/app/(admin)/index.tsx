import React, { useState, useCallback } from 'react';
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
import { AdminDoctorCard } from '../../components/AdminDoctorCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getAdminDoctors, updateDoctorStatus } from '../../services/adminService';
import { AdminDoctor } from '../../types/admin';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDashboardData = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getAdminDoctors();
      if (res && res.success) {
        setDoctors(res.data || []);
      } else {
        setErrorMsg(res.message || 'Failed to load doctor profiles.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve administrator data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    Alert.alert('Logout', 'Are you sure you want to log out of Admin Portal?', [
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

  const handleEditDoctor = (doc: AdminDoctor) => {
    router.push({
      pathname: '/(admin)/doctor-edit' as any,
      params: { id: doc._id },
    });
  };

  const handleToggleStatus = async (doc: AdminDoctor) => {
    const isUserActive = doc.userId?.isActive !== false;
    const actionText = isUserActive ? 'Deactivate' : 'Reactivate';
    const doctorName = doc.userId?.fullName || 'this doctor';

    Alert.alert(
      `${actionText} Doctor Account`,
      isUserActive
        ? `Deactivate ${doctorName}? Patients will no longer be able to book new appointments while the account is inactive.`
        : `Reactivate ${doctorName}? This will allow patients to view and book appointments again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isUserActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = await updateDoctorStatus(doc._id, { isActive: !isUserActive });
              if (res && res.success) {
                Alert.alert(
                  'Status Updated',
                  `Doctor account has been ${!isUserActive ? 'reactivated' : 'deactivated'} successfully.`
                );
                fetchDashboardData(true);
              } else {
                Alert.alert('Error', res.message || 'Failed to update doctor status.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to update status.');
            }
          },
        },
      ]
    );
  };

  if (loading && doctors.length === 0) {
    return <LoadingView message="Loading admin dashboard..." />;
  }

  // Calculate stats from real data
  const totalDoctors = doctors.length;
  const activeDoctors = doctors.filter((d) => d.userId?.isActive !== false).length;
  const inactiveDoctors = totalDoctors - activeDoctors;
  const distinctSpecializations = new Set(doctors.map((d) => d.specialization)).size;

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Admin Portal"
        subtitle="Healthcare Network Control"
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

        {/* Admin Profile Header Banner */}
        <View style={styles.adminBanner}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>🛡️</Text>
          </View>
          <View style={styles.adminInfoCol}>
            <Text style={styles.adminName}>{user?.fullName || 'System Administrator'}</Text>
            <Text style={styles.adminEmail}>{user?.email}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>SYSTEM ADMIN</Text>
            </View>
          </View>
        </View>

        {/* Real Network Stat Cards */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(admin)/doctors' as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: colors.primary }]}>{totalDoctors}</Text>
            <Text style={styles.statLbl}>Total Doctors</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(admin)/doctors' as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: colors.success }]}>{activeDoctors}</Text>
            <Text style={styles.statLbl}>Active Doctors</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(admin)/doctors' as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: colors.danger }]}>{inactiveDoctors}</Text>
            <Text style={styles.statLbl}>Inactive</Text>
          </TouchableOpacity>

          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: colors.accent }]}>{distinctSpecializations}</Text>
            <Text style={styles.statLbl}>Specialties</Text>
          </View>
        </View>

        {/* Quick Action Navigation Buttons */}
        <TouchableOpacity
          style={styles.actionBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/doctors' as any)}
        >
          <Text style={styles.actionIcon}>🩺</Text>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>Manage Specialist Directory</Text>
            <Text style={styles.actionSub}>View all registered doctors, edit profiles, toggle active status</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/doctor-add' as any)}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>Register New Doctor Account</Text>
            <Text style={styles.actionSub}>Create doctor user credentials and SLMC medical profile</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        {/* Recent Registered Doctors Queue */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Registered Specialists ({totalDoctors})</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/doctors' as any)}>
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {doctors.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No doctors registered in the network yet.</Text>
          </View>
        ) : (
          doctors.slice(0, 5).map((doc) => (
            <AdminDoctorCard
              key={doc._id}
              doctor={doc}
              onEdit={handleEditDoctor}
              onToggleStatus={handleToggleStatus}
            />
          ))
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
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
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
    fontSize: 24,
  },
  adminInfoCol: {
    flex: 1,
  },
  adminName: {
    ...typography.header,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  adminEmail: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: colors.primaryDark,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  roleTagText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  statVal: {
    ...typography.header,
    fontSize: 20,
    fontWeight: '900',
  },
  statLbl: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  actionSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionArrow: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 17,
    color: colors.textPrimary,
  },
  viewAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
