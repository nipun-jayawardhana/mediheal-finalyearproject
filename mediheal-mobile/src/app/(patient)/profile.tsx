import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
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
import { SUPPORTED_LANGUAGES } from '../../utils/languageStorage';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

export default function PatientProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const currentLangName = currentLangObj ? `${currentLangObj.flag} ${currentLangObj.nativeName} (${currentLangObj.name})` : 'English';

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
  }, [fetchProfile]);

  const performSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleSignOut = () => {
    const title = t('signOutConfirmTitle');
    const message = t('signOutConfirmMsg');

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        void performSignOut();
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: performSignOut,
        },
      ]
    );
  };

  if (loading) {
    return <LoadingView message="Loading profile details..." />;
  }

  return (
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title={t('profileSettings')}
        subtitle={t('manageAccountPreferences')}
        onBackPress={() => router.back()}
      />

      <View style={styles.content}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchProfile()} />
        ) : null}

        {/* 1. Account Details Card */}
        <InfoCard
          title={t('accountDetails')}
          badge={<StatusBadge status="active" label={t('patientAccount')} />}
        >
          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('fullName')}</Text>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{user?.fullName || 'N/A'}</Text>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('emailAddress')}</Text>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{user?.email || 'N/A'}</Text>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('phoneNumber')}</Text>
            <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{user?.phoneNumber || 'N/A'}</Text>
          </View>
        </InfoCard>

        {/* 2. Patient Caregiver Linking Code Card */}
        {profile?.caregiverLinkCode ? (
          <CaregiverLinkCodeCard
            code={profile.caregiverLinkCode}
            title={t('myPatientLinkingCode')}
          />
        ) : null}

        {/* 3. Patient Health Details Card */}
        {profile && (
          <InfoCard
            title={t('healthDetails')}
            subtitle={t('medicalBackground')}
          >
            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('dateOfBirth')}</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{profile.dateOfBirth}</Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('gender')}</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                {profile.gender === 'male' ? t('male') : profile.gender === 'female' ? t('female') : profile.gender.toUpperCase()}
              </Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('bloodGroup')}</Text>
              <Text style={[styles.detailValueBold, { color: themeColors.primary }]}>{profile.bloodGroup}</Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('homeAddress')}</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{profile.address}</Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{t('emergencyContact')}</Text>
              <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>
                {profile.emergencyContactName} ({profile.emergencyContactPhone})
              </Text>
            </View>

            {/* Medical Conditions */}
            <Text style={[styles.chipSectionTitle, { color: themeColors.textPrimary }]}>{t('medicalConditions')}</Text>
            <View style={styles.chipWrap}>
              {profile.medicalConditions && profile.medicalConditions.length > 0 ? (
                profile.medicalConditions.map((cond, idx) => (
                  <View key={idx} style={[styles.conditionChip, { backgroundColor: themeColors.primaryLight }]}>
                    <Text style={[styles.conditionChipText, { color: themeColors.primary }]}>{cond}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.noneText, { color: themeColors.textMuted }]}>{t('noneRecorded')}</Text>
              )}
            </View>

            {/* Allergies */}
            <Text style={[styles.chipSectionTitle, { color: themeColors.textPrimary }]}>{t('allergies')}</Text>
            <View style={styles.chipWrap}>
              {profile.allergies && profile.allergies.length > 0 ? (
                profile.allergies.map((alg, idx) => (
                  <View key={idx} style={[styles.allergyChip, { backgroundColor: themeColors.dangerLight }]}>
                    <Text style={[styles.allergyChipText, { color: themeColors.danger }]}>{alg}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.noneText, { color: themeColors.textMuted }]}>{t('noneRecorded')}</Text>
              )}
            </View>

            <AppButton
              title={t('editProfile')}
              onPress={() => router.push('/(patient)/edit-profile')}
              variant="outline"
              style={styles.editBtn}
            />
          </InfoCard>
        )}

        {/* 4. Medication Reminders Shortcut */}
        <TouchableOpacity
          style={[styles.langSettingCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
          onPress={() => router.push('/(patient)/medications' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.langSettingIcon}>🔔</Text>
          <View style={styles.langTextCol}>
            <Text style={[styles.langTitle, { color: themeColors.textPrimary }]}>{t('medicationReminders')}</Text>
            <Text style={[styles.langSub, { color: themeColors.textSecondary }]}>{t('manageDoseNotifications')}</Text>
          </View>
          <Text style={[styles.arrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* 5. Language Selection Shortcut */}
        <TouchableOpacity
          style={[styles.langSettingCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
          onPress={() => router.push('/language')}
          activeOpacity={0.8}
        >
          <Text style={styles.langSettingIcon}>🌐</Text>
          <View style={styles.langTextCol}>
            <Text style={[styles.langTitle, { color: themeColors.textPrimary }]}>{t('languageSelection')}</Text>
            <Text style={[styles.langSub, { color: themeColors.textSecondary }]}>{t('currentLanguage')}: {currentLangName}</Text>
          </View>
          <Text style={[styles.arrow, { color: themeColors.primary }]}>→</Text>
        </TouchableOpacity>

        {/* 6. Sign Out Button */}
        <AppButton
          title={t('signOut')}
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
