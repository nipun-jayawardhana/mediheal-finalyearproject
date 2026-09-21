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
import { DoctorAppointmentCard } from '../../components/DoctorAppointmentCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import {
  getDoctorAppointments,
  updateAppointmentStatusByDoctor,
} from '../../services/doctorPortalService';
import { DoctorAppointment } from '../../types/doctorPortal';

export default function DoctorDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors: themeColors, isDark, toggleTheme } = useTheme();

  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDashboardData = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getDoctorAppointments();
      if (res && res.success) {
        setAppointments(res.data || []);
      } else {
        setErrorMsg(res.message || 'Failed to load doctor appointments.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve assigned appointments.');
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
    Alert.alert('Logout', 'Are you sure you want to log out of Doctor Portal?', [
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

  const handleConfirmAppointment = async (appt: DoctorAppointment) => {
    try {
      const res = await updateAppointmentStatusByDoctor(appt._id, 'confirmed');
      if (res && res.success) {
        Alert.alert('Confirmed', 'Appointment confirmed successfully.');
        fetchDashboardData(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to confirm appointment.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to confirm appointment.');
    }
  };

  const handleStartConsultation = (appt: DoctorAppointment) => {
    router.push({
      pathname: '/(doctor)/active-consultation' as any,
      params: { appointmentId: appt._id },
    });
  };

  const handleViewHistory = (appt: DoctorAppointment) => {
    const patientId = typeof appt.patientId === 'object' ? appt.patientId._id : appt.patientId;
    router.push({
      pathname: '/(doctor)/patient-history' as any,
      params: { patientId },
    });
  };

  if (loading && appointments.length === 0) {
    return <LoadingView message="Loading doctor portal dashboard..." />;
  }

  // Calculate stats from real appointment data
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;
  const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((a) => {
    try {
      const apptDateStr = new Date(a.appointmentDate).toISOString().split('T')[0];
      return apptDateStr === todayStr;
    } catch (e) {
      return false;
    }
  });

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title="Doctor Portal"
        subtitle={`Welcome, Dr. ${user?.fullName || 'Doctor'}`}
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
                styles.profileHeaderBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => router.push('/(doctor)/profile' as any)}
              accessibilityRole="button"
              accessibilityLabel="View doctor profile"
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>👤</Text>
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

        {/* Doctor Summary Header Card */}
        <TouchableOpacity
          style={[
            styles.doctorHeaderCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
          onPress={() => router.push('/(doctor)/profile' as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Doctor profile card. Tap to view profile"
        >
          <View
            style={[
              styles.doctorAvatarCircle,
              {
                backgroundColor: themeColors.primaryLight,
                borderColor: themeColors.primary,
              },
            ]}
          >
            <Text style={styles.doctorAvatarText}>🩺</Text>
          </View>
          <View style={styles.doctorInfoCol}>
            <Text style={[styles.doctorName, { color: themeColors.textPrimary }]}>
              Dr. {user?.fullName || 'Medical Specialist'}
            </Text>
            <Text style={[styles.doctorEmail, { color: themeColors.textMuted }]}>
              {user?.email}
            </Text>
          </View>
          <Text style={[styles.doctorCardArrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* Dashboard Real Stat Counters */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(doctor)/appointments' as any,
                params: { filter: 'pending' },
              })
            }
          >
            <Text style={[styles.statVal, { color: themeColors.warning }]}>{pendingCount}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Pending</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(doctor)/appointments' as any,
                params: { filter: 'confirmed' },
              })
            }
          >
            <Text style={[styles.statVal, { color: themeColors.primary }]}>{confirmedCount}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Confirmed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(doctor)/appointments' as any,
                params: { filter: 'completed' },
              })
            }
          >
            <Text style={[styles.statVal, { color: themeColors.success }]}>{completedCount}</Text>
            <Text style={[styles.statLbl, { color: themeColors.textSecondary }]}>Completed</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Menu Button */}
        <TouchableOpacity
          style={[
            styles.menuBanner,
            { backgroundColor: themeColors.card, borderColor: themeColors.primary },
          ]}
          activeOpacity={0.8}
          onPress={() => router.push('/(doctor)/appointments' as any)}
        >
          <Text style={styles.menuIcon}>📅</Text>
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>
              View All Assigned Appointments
            </Text>
            <Text style={[styles.menuSub, { color: themeColors.textMuted }]}>
              Manage bookings, confirm, or start consultations
            </Text>
          </View>
          <Text style={[styles.menuArrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* Today's Appointments Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Today's Consultations ({todayAppointments.length})
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(doctor)/appointments' as any)}
          >
            <Text style={[styles.viewAllText, { color: themeColors.primary }]}>View All →</Text>
          </TouchableOpacity>
        </View>

        {todayAppointments.length === 0 ? (
          <View
            style={[
              styles.noTodayBox,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.noTodayText, { color: themeColors.textMuted }]}>
              No consultations scheduled for today.
            </Text>
          </View>
        ) : (
          todayAppointments.map((appt) => (
            <DoctorAppointmentCard
              key={appt._id}
              appointment={appt}
              onConfirm={handleConfirmAppointment}
              onStartConsultation={handleStartConsultation}
              onViewHistory={handleViewHistory}
            />
          ))
        )}

        {/* Recent Assigned Appointments Section */}
        {appointments.length > 0 && todayAppointments.length === 0 && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Recent Assigned Appointments
            </Text>
            {appointments.slice(0, 5).map((appt) => (
              <DoctorAppointmentCard
                key={appt._id}
                appointment={appt}
                onConfirm={handleConfirmAppointment}
                onStartConsultation={handleStartConsultation}
                onViewHistory={handleViewHistory}
              />
            ))}
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
  themeToggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeaderBtn: {
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
  doctorHeaderCard: {
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
  doctorAvatarCircle: {
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
  doctorAvatarText: {
    fontSize: 24,
  },
  doctorInfoCol: {
    flex: 1,
  },
  doctorName: {
    ...typography.header,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  doctorEmail: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  doctorCardArrow: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  statVal: {
    ...typography.header,
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
  noTodayBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noTodayText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  sectionContainer: {
    marginTop: spacing.md,
  },
});
