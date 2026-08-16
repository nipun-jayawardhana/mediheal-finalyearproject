import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { InfoCard } from '../../components/InfoCard';
import { StatusBadge } from '../../components/StatusBadge';
import { CaregiverLinkCodeCard } from '../../components/CaregiverLinkCodeCard';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { getPatientProfileApi } from '../../services/patientService';
import { PatientProfile } from '../../types/patient';
import { getStoredLanguage, SUPPORTED_LANGUAGES } from '../../utils/languageStorage';

export default function PatientProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLangName, setCurrentLangName] = useState('English');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getPatientProfileApi();
      if (res && res.success) {
        setProfile(res.data.profile);
      }
    } catch (err: any) {
      if (err.statusCode === 404) {
        router.replace('/(patient)/complete-profile');
        return;
      }
      setErrorMsg(err.message || 'Failed to retrieve profile data.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
    const loadLang = async () => {
      const code = await getStoredLanguage();
      const name = SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || 'English';
      setCurrentLangName(name);
    };
    loadLang();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return <LoadingView message="Loading profile details..." />;
  }

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title="Profile & Settings"
        subtitle="Manage your account and preferences"
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchProfile()} />
        ) : null}

        {/* 1. Account Details Card */}
        <InfoCard
          title="Account Details"
          badge={<StatusBadge status="active" label="PATIENT ACCOUNT" />}
        >
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Full Name</Text>
            <Text style={styles.detailValue}>{user?.fullName || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email Address</Text>
            <Text style={styles.detailValue}>{user?.email || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone Number</Text>
            <Text style={styles.detailValue}>{user?.phoneNumber || 'N/A'}</Text>
          </View>
        </InfoCard>

        {/* 2. Patient Caregiver Linking Code Card */}
        {profile?.caregiverLinkCode ? (
          <CaregiverLinkCodeCard
            code={profile.caregiverLinkCode}
            title="MY PATIENT LINKING CODE"
          />
        ) : null}

        {/* 3. Patient Health Details Card */}
        {profile && (
          <InfoCard
            title="Health Details"
            subtitle="Your medical background"
          >
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date of Birth</Text>
              <Text style={styles.detailValue}>{profile.dateOfBirth}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Gender</Text>
              <Text style={styles.detailValue}>{profile.gender.toUpperCase()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Blood Group</Text>
              <Text style={styles.detailValueBold}>{profile.bloodGroup}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Home Address</Text>
              <Text style={styles.detailValue}>{profile.address}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Emergency Contact</Text>
              <Text style={styles.detailValue}>
                {profile.emergencyContactName} ({profile.emergencyContactPhone})
              </Text>
            </View>

            {/* Medical Conditions */}
            <Text style={styles.chipSectionTitle}>Medical Conditions</Text>
            <View style={styles.chipWrap}>
              {profile.medicalConditions && profile.medicalConditions.length > 0 ? (
                profile.medicalConditions.map((cond, idx) => (
                  <View key={idx} style={styles.conditionChip}>
                    <Text style={styles.conditionChipText}>{cond}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noneText}>None recorded</Text>
              )}
            </View>

            {/* Allergies */}
            <Text style={styles.chipSectionTitle}>Allergies</Text>
            <View style={styles.chipWrap}>
              {profile.allergies && profile.allergies.length > 0 ? (
                profile.allergies.map((alg, idx) => (
                  <View key={idx} style={styles.allergyChip}>
                    <Text style={styles.allergyChipText}>{alg}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noneText}>None recorded</Text>
              )}
            </View>

            <AppButton
              title="Edit Profile"
              onPress={() => router.push('/(patient)/edit-profile')}
              variant="outline"
              style={styles.editBtn}
            />
          </InfoCard>
        )}

        {/* 4. Medication Reminders Shortcut */}
        <TouchableOpacity
          style={styles.langSettingCard}
          onPress={() => router.push('/(patient)/medications' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.langSettingIcon}>🔔</Text>
          <View style={styles.langTextCol}>
            <Text style={styles.langTitle}>Medication Reminders</Text>
            <Text style={styles.langSub}>Manage local schedule dose notifications</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        {/* 5. Language Selection Shortcut */}
        <TouchableOpacity
          style={styles.langSettingCard}
          onPress={() => router.push('/language')}
          activeOpacity={0.8}
        >
          <Text style={styles.langSettingIcon}>🌐</Text>
          <View style={styles.langTextCol}>
            <Text style={styles.langTitle}>Language Selection</Text>

            <Text style={styles.langSub}>Current: {currentLangName}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        {/* 5. Sign Out Button */}
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
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  detailLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  detailValueBold: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  chipSectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  conditionChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  conditionChipText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  allergyChip: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  allergyChipText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  noneText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  editBtn: {
    marginTop: spacing.md,
  },
  langSettingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langSettingIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  langTextCol: {
    flex: 1,
  },
  langTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  langSub: {
    ...typography.caption,
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  signOutBtn: {
    marginVertical: spacing.md,
  },
});
