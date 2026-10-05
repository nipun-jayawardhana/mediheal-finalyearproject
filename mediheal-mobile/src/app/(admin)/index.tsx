import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AdminDoctorCard } from '../../components/AdminDoctorCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getAdminDoctors, updateDoctorStatus } from '../../services/adminService';
import { AdminDoctor } from '../../types/admin';
import { confirmAction, showMessage } from '../../utils/dialogs';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors: themeColors, isDark, toggleTheme } = useTheme();

  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showSpecialties, setShowSpecialties] = useState<boolean>(false);

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

  const handleLogout = () => {
    confirmAction({
      title: 'Logout',
      message: 'Are you sure you want to log out of Admin Portal?',
      confirmText: 'Log Out',
      destructive: true,
      onConfirm: async () => {
        await logout();
        router.replace('/(auth)/login');
      },
    });
  };

  const openDoctorList = (params?: { status?: string; specialization?: string }) => {
    router.push({ pathname: '/(admin)/doctors' as any, params });
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

    confirmAction({
      title: `${actionText} Doctor Account`,
      message: isUserActive
        ? `Deactivate ${doctorName}? Patients will no longer be able to book new appointments while the account is inactive.`
        : `Reactivate ${doctorName}? This will allow patients to view and book appointments again.`,
      confirmText: actionText,
      destructive: isUserActive,
      onConfirm: async () => {
        try {
          const res = await updateDoctorStatus(doc._id, { isActive: !isUserActive });
          if (res && res.success) {
            showMessage(
              'Status Updated',
              `Doctor account has been ${!isUserActive ? 'reactivated' : 'deactivated'} successfully.`
            );
            fetchDashboardData(true);
          } else {
            showMessage('Error', res.message || 'Failed to update doctor status.');
          }
        } catch (err: any) {
          showMessage('Error', err.message || 'Unable to update status.');
        }
      },
    });
  };

  // Doctor counts per specialization, most common first
  const specialtyBreakdown = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>();
    doctors.forEach((d) => {
      const name = d.specialization?.trim() || 'Unspecified';
      const entry = counts.get(name) || { total: 0, active: 0 };
      entry.total += 1;
      if (d.userId?.isActive !== false) entry.active += 1;
      counts.set(name, entry);
    });
    return Array.from(counts.entries())
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [doctors]);

  if (loading && doctors.length === 0) {
    return <LoadingView message="Loading admin dashboard..." />;
  }

  // Calculate stats from real data
  const totalDoctors = doctors.length;
  const activeDoctors = doctors.filter((d) => d.userId?.isActive !== false).length;
  const inactiveDoctors = totalDoctors - activeDoctors;
  const distinctSpecializations = specialtyBreakdown.length;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Admin Portal"
        subtitle="Healthcare Network Control"
        rightComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <TouchableOpacity
              style={[
                styles.themeToggleBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => void toggleTheme()}
              accessibilityRole="button"
              accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.logoutHeaderBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={handleLogout}
            >
              <Text style={[styles.logoutHeaderText, { color: themeColors.danger }]}>Logout</Text>
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

        {/* Admin Profile Header Banner */}
        <View
          style={[
            styles.adminBanner,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: themeColors.primaryLight,
                borderColor: themeColors.primary,
              },
            ]}
          >
            <Text style={styles.avatarText}>🛡️</Text>
          </View>
          <View style={styles.adminInfoCol}>
            <Text style={[styles.adminName, { color: themeColors.textPrimary }]}>
              {user?.fullName || 'System Administrator'}
            </Text>
            <Text style={[styles.adminEmail, { color: themeColors.textMuted }]}>
              {user?.email}
            </Text>
            <View style={[styles.roleTag, { backgroundColor: themeColors.primaryDark }]}>
              <Text style={styles.roleTagText}>SYSTEM ADMIN</Text>
            </View>
          </View>
        </View>

        {/* Real Network Stat Cards */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            onPress={() => router.push('/(admin)/doctors' as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: themeColors.primary }]}>{totalDoctors}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Total Doctors</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            onPress={() => openDoctorList({ status: 'active' })}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: themeColors.success }]}>{activeDoctors}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Active Doctors</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            onPress={() => openDoctorList({ status: 'inactive' })}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: themeColors.danger }]}>{inactiveDoctors}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Inactive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            onPress={() => setShowSpecialties(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statVal, { color: themeColors.accent }]}>{distinctSpecializations}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Specialties</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Navigation Buttons */}
        <TouchableOpacity
          style={[
            styles.actionBanner,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/doctors' as any)}
        >
          <Text style={styles.actionIcon}>🩺</Text>
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>
              Manage Specialist Directory
            </Text>
            <Text style={[styles.actionSub, { color: themeColors.textMuted }]}>
              View all registered doctors, edit profiles, toggle active status
            </Text>
          </View>
          <Text style={[styles.actionArrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBanner,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/doctor-add' as any)}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>
              Register New Doctor Account
            </Text>
            <Text style={[styles.actionSub, { color: themeColors.textMuted }]}>
              Create doctor user credentials and SLMC medical profile
            </Text>
          </View>
          <Text style={[styles.actionArrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* Recent Registered Doctors Queue */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Registered Specialists ({totalDoctors})
          </Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/doctors' as any)}>
            <Text style={[styles.viewAllText, { color: themeColors.primary }]}>View All →</Text>
          </TouchableOpacity>
        </View>

        {doctors.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
              No doctors registered in the network yet.
            </Text>
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

      {/* Specialties Breakdown Sheet */}
      <Modal
        visible={showSpecialties}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpecialties(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setShowSpecialties(false)}>
          <Pressable
            style={[
              styles.sheetCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>
                Specialties ({distinctSpecializations})
              </Text>
              <TouchableOpacity onPress={() => setShowSpecialties(false)}>
                <Text style={[styles.sheetClose, { color: themeColors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetSubtitle, { color: themeColors.textMuted }]}>
              Tap a specialty to view its doctors
            </Text>

            {specialtyBreakdown.length === 0 ? (
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                No specialties yet. Register a doctor to get started.
              </Text>
            ) : (
              <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                {specialtyBreakdown.map((spec) => (
                  <TouchableOpacity
                    key={spec.name}
                    style={[styles.specRow, { borderBottomColor: themeColors.border }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowSpecialties(false);
                      openDoctorList({ specialization: spec.name });
                    }}
                  >
                    <View style={styles.actionTextCol}>
                      <Text style={[styles.specName, { color: themeColors.textPrimary }]}>
                        🩺 {spec.name}
                      </Text>
                      <Text style={[styles.specMeta, { color: themeColors.textMuted }]}>
                        {spec.active} active
                        {spec.total - spec.active > 0 ? ` · ${spec.total - spec.active} inactive` : ''}
                      </Text>
                    </View>
                    <View style={[styles.specCountPill, { backgroundColor: themeColors.primaryLight }]}>
                      <Text style={[styles.specCountText, { color: themeColors.primaryDark }]}>
                        {spec.total}
                      </Text>
                    </View>
                    <Text style={[styles.actionArrow, { color: themeColors.primary }]}>→</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  themeToggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheetCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...shadows.card,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    ...typography.subheader,
    fontSize: 17,
  },
  sheetClose: {
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  sheetList: {
    flexGrow: 0,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  specName: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  specMeta: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  specCountPill: {
    minWidth: 28,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  specCountText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
  },
});
