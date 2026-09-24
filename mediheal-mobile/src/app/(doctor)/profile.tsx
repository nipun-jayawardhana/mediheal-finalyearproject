import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { InfoCard } from '../../components/InfoCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { getDoctorById } from '../../services/doctorService';
import { DoctorProfile } from '../../types/doctor';

export default function DoctorProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors: themeColors, isDark } = useTheme();

  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDoctorProfile = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // Look up doctor profile using the authenticated doctor's User ID
      const res = await getDoctorById(user._id);
      if (res && res.success && res.data) {
        setProfile(res.data);
      }
    } catch (err: any) {
      // If 404, the doctor user exists but extended profile may not yet be filled
      if (err.statusCode !== 404) {
        setErrorMsg(err.message || 'Unable to retrieve extended doctor profile.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchDoctorProfile();
  }, [fetchDoctorProfile]);

  const performSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleSignOut = () => {
    const title = 'Log Out';
    const message = 'Are you sure you want to log out of Doctor Portal?';

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        void performSignOut();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: performSignOut,
      },
    ]);
  };

  if (loading) {
    return <LoadingView message="Loading doctor profile details..." />;
  }

  const doctorInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'DR';

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title="Doctor Profile"
        subtitle="Professional Details & Account"
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchDoctorProfile} />
        ) : null}

        {/* Doctor Identity Header Card */}
        <View
          style={[
            styles.doctorHeroCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View
            style={[
              styles.avatarLargeCircle,
              {
                backgroundColor: themeColors.primaryLight,
                borderColor: themeColors.primary,
              },
            ]}
          >
            <Text style={[styles.avatarLargeText, { color: themeColors.primaryDark }]}>
              {doctorInitials}
            </Text>
          </View>
          <Text style={[styles.doctorHeroName, { color: themeColors.textPrimary }]}>
            Dr. {user?.fullName || 'Medical Specialist'}
          </Text>
          <Text style={[styles.doctorHeroSub, { color: themeColors.primary }]}>
            {profile?.specialization || 'Medical Specialist'}
          </Text>
          <View style={styles.badgeRow}>
            <StatusBadge status="active" label="VERIFIED DOCTOR" />
          </View>
        </View>

        {/* 1. Account & Contact Details Card */}
        <InfoCard
          title="Account Details"
          badge={<StatusBadge status="active" label="DOCTOR ACCOUNT" />}
        >
          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Full Name</Text>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
              Dr. {user?.fullName || 'N/A'}
            </Text>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Email Address</Text>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
              {user?.email || 'N/A'}
            </Text>
          </View>

          {user?.phoneNumber ? (
            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Phone Number</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                {user.phoneNumber}
              </Text>
            </View>
          ) : null}

          {user?._id ? (
            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Doctor ID</Text>
              <Text style={[styles.detailValue, { color: themeColors.textMuted }]}>
                {user._id}
              </Text>
            </View>
          ) : null}
        </InfoCard>

        {/* 2. Medical Credentials & Affiliation Card (if profile available) */}
        {profile ? (
          <InfoCard
            title="Clinical Credentials"
            subtitle="Hospital Affiliation & Practice Information"
          >
            {profile.slmcNumber ? (
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>SLMC Registration</Text>
                <Text style={[styles.detailValueBold, { color: themeColors.primary }]}>
                  {profile.slmcNumber}
                </Text>
              </View>
            ) : null}

            {profile.hospital ? (
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Hospital / Clinic</Text>
                <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                  🏥 {profile.hospital}
                </Text>
              </View>
            ) : null}

            {profile.specialization ? (
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Specialization</Text>
                <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                  🩺 {profile.specialization}
                </Text>
              </View>
            ) : null}

            {profile.yearsOfExperience !== undefined && profile.yearsOfExperience > 0 ? (
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Experience</Text>
                <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                  {profile.yearsOfExperience} years
                </Text>
              </View>
            ) : null}

            {profile.consultationFee !== undefined && profile.consultationFee > 0 ? (
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Consultation Fee</Text>
                <Text style={[styles.detailValueBold, { color: themeColors.success }]}>
                  Rs. {profile.consultationFee.toLocaleString()}
                </Text>
              </View>
            ) : null}

            {profile.location ? (
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>Location</Text>
                <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                  📍 {profile.location}
                </Text>
              </View>
            ) : null}

            {/* Languages spoken */}
            {profile.languages && profile.languages.length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[styles.chipSectionTitle, { color: themeColors.textPrimary }]}>
                  Languages Spoken
                </Text>
                <View style={styles.chipWrap}>
                  {profile.languages.map((lang, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.infoChip,
                        { backgroundColor: themeColors.primaryLight },
                      ]}
                    >
                      <Text style={[styles.infoChipText, { color: themeColors.primary }]}>
                        {lang}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Available Days */}
            {profile.availableDays && profile.availableDays.length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[styles.chipSectionTitle, { color: themeColors.textPrimary }]}>
                  Available Days
                </Text>
                <View style={styles.chipWrap}>
                  {profile.availableDays.map((day, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.infoChip,
                        { backgroundColor: themeColors.surfaceSecondary },
                      ]}
                    >
                      <Text style={[styles.infoChipText, { color: themeColors.textPrimary }]}>
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Biography */}
            {profile.biography ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[styles.chipSectionTitle, { color: themeColors.textPrimary }]}>
                  About Doctor
                </Text>
                <Text style={[styles.bioText, { color: themeColors.textSecondary }]}>
                  {profile.biography}
                </Text>
              </View>
            ) : null}
          </InfoCard>
        ) : null}

        <AppButton
          title="⚙️ Manage Availability & Slot Duration"
          onPress={() => router.push('/(doctor)/availability' as any)}
          variant="secondary"
          style={{ marginTop: spacing.lg }}
        />

        {/* 3. Sign Out Button */}
        <AppButton
          title="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          style={styles.signOutBtn}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  doctorHeroCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarLargeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    borderWidth: 2.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarLargeText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  doctorHeroName: {
    ...typography.header,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  doctorHeroSub: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  badgeRow: {
    marginTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
    flex: 1.5,
  },
  detailValueBold: {
    ...typography.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    flex: 1.5,
  },
  chipSectionTitle: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  infoChip: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  infoChipText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  bioText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  signOutBtn: {
    marginTop: spacing.xl,
  },
});
