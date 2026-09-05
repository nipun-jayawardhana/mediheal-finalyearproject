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
  Modal,
  Pressable,
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
import { useLanguage } from '../../context/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../../utils/languageStorage';
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
  const { language, setLanguage, t } = useLanguage();

  const [patients, setPatients] = useState<LinkedPatientItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [langModalVisible, setLangModalVisible] = useState<boolean>(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState<boolean>(false);

  const currentLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const HEADER_LANGUAGE_LABELS: Record<LanguageCode, string> = {
    en: 'EN',
    si: 'සිං',
    ta: 'TA',
  };

  const handleSelectLanguage = async (code: LanguageCode) => {
    setLangModalVisible(false);
    await setLanguage(code);
  };

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
      setErrorMsg(err.message || t('unableToLoadCaregiverDashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatientId, t]);

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
        t('signOutConfirmMsg')
      );
      if (confirmed) {
        await performSignOut();
      }
      return;
    }

    Alert.alert(
      t('signOutConfirmTitle'),
      t('signOutConfirmMsg'),
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

  if (loading && patients.length === 0) {
    return <LoadingView message={t('loadingCaregiverDashboard')} />;
  }

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const activePatientItem = patients.find((p) => p.patient?._id === selectedPatientId) || patients[0];

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('caregiverDashboardTitle')}
        subtitle={`${t('welcomeCaregiver')}, ${user?.fullName || t('caregiver')}`}
        rightComponent={
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={[
                styles.langBtnCompact,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => setLangModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Current language ${currentLangOption.name}. Tap to change language`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.langTextCompact, { color: themeColors.primary }]} numberOfLines={1}>
                {HEADER_LANGUAGE_LABELS[language] || 'EN'}
              </Text>
            </TouchableOpacity>

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
                styles.userIconBtn,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => setAccountMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('caregiverAccount')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.userIcon, { color: themeColors.textPrimary }]}>👤</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLangModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>{t('selectLanguageTitle')}</Text>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { backgroundColor: themeColors.background }]}
                onPress={() => setLangModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close language selection"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.modalCloseText, { color: themeColors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptionsList}>
              {SUPPORTED_LANGUAGES.map((item) => {
                const isSelected = language === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    activeOpacity={0.8}
                    onPress={() => handleSelectLanguage(item.code)}
                    style={[
                      styles.langOptionCard,
                      { backgroundColor: themeColors.card, borderColor: themeColors.border },
                      isSelected && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.nativeName}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.langOptionLeft}>
                      <Text style={styles.langOptionFlag}>{item.flag}</Text>
                      <View style={styles.langOptionTextCol}>
                        <Text
                          style={[
                            styles.langOptionNative,
                            { color: themeColors.textPrimary },
                            isSelected && { color: themeColors.primaryDark },
                          ]}
                        >
                          {item.nativeName}
                        </Text>
                        <Text style={[styles.langOptionEnglish, { color: themeColors.textSecondary }]}>{item.name}</Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <View style={[styles.checkBadge, { backgroundColor: themeColors.primary }]}>
                        <Text style={styles.checkBadgeText}>✓</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Account Menu Dropdown / Popover Modal */}
      <Modal
        visible={accountMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountMenuVisible(false)}
      >
        <Pressable
          style={styles.accountMenuOverlay}
          onPress={() => setAccountMenuVisible(false)}
        >
          <Pressable
            style={[
              styles.accountMenuDropdown,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.accountMenuHeader}>
              <Text style={[styles.accountMenuName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {user?.fullName || t('caregiver')}
              </Text>
              <Text style={[styles.accountMenuRole, { color: themeColors.textMuted }]} numberOfLines={1}>
                {t('caregiverAccount')}
              </Text>
              {user?.email ? (
                <Text style={[styles.accountMenuEmail, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>

            <View style={[styles.accountMenuDivider, { backgroundColor: themeColors.border }]} />

            <TouchableOpacity
              style={styles.accountMenuItem}
              onPress={() => {
                setAccountMenuVisible(false);
                setTimeout(() => {
                  void handleLogout();
                }, 50);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('signOut')}
              activeOpacity={0.7}
            >
              <Text style={[styles.accountMenuLogoutText, { color: themeColors.danger }]}>
                🚪 {t('signOut')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
                {t('activeEmergencyAlert')} ({activeAlerts.length})
              </Text>
            </View>
            <Text style={[styles.sosBannerSub, { color: themeColors.textSecondary }]}>
              {t('activeEmergencyAlertSub')}
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
              <Text style={[styles.safeTitle, { color: themeColors.success }]}>{t('noActiveEmergencyAlerts')}</Text>
              <Text style={[styles.safeSub, { color: themeColors.textSecondary }]}>{t('allLinkedPatientsClear')}</Text>
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
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{t('noPatientsLinkedYet')}</Text>
            <Text style={[styles.emptyDesc, { color: themeColors.textSecondary }]}>
              {t('noPatientsLinkedDesc')}
            </Text>
            <AppButton
              title={t('linkPatientBtn')}
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
                        {item.patient?.fullName || t('careRecipient')}
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
                      {activePatientItem.relationship || t('familyCaregiver')} • {t('linked')}
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
                    <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>{t('careOverview')}</Text>
                    <Text style={[styles.actionSub, { color: themeColors.textMuted }]}>{t('careOverviewSub')}</Text>
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
                    <Text style={[styles.actionTitle, { color: themeColors.textPrimary }]}>{t('addMedication')}</Text>
                    <Text style={[styles.actionSub, { color: themeColors.textMuted }]}>{t('addMedicationSub')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Patient Profile Link Code Reference */}
                {activePatientItem.patientProfile?.caregiverLinkCode ? (
                  <View style={styles.linkCodeFooter}>
                    <Text style={[styles.linkCodeLabel, { color: themeColors.textMuted }]}>
                      {t('linkCode')}: {activePatientItem.patientProfile.caregiverLinkCode}
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
              <Text style={[styles.linkAnotherText, { color: themeColors.primary }]}>{t('linkAnotherPatient')}</Text>
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
            <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>{t('emergencySafetyAlerts')}</Text>
            <Text style={[styles.menuSub, { color: themeColors.textMuted }]}>{t('emergencySafetyAlertsSub')}</Text>
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
            <Text style={[styles.menuTitle, { color: themeColors.textPrimary }]}>{t('communityHealthForum')}</Text>
            <Text style={[styles.menuSub, { color: themeColors.textMuted }]}>{t('communityHealthForumSub')}</Text>
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
          <Text style={[styles.accountTitle, { color: themeColors.textMuted }]}>{t('caregiverAccount')}</Text>
          <Text style={[styles.accountDetail, { color: themeColors.textSecondary }]}>{t('email')}: {user?.email}</Text>
          <Text style={[styles.accountDetail, { color: themeColors.textSecondary }]}>{t('phone')}: {user?.phoneNumber || 'N/A'}</Text>
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
  userIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  userIcon: {
    fontSize: 18,
  },
  accountMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'web' ? 70 : 85,
    paddingRight: spacing.md,
  },
  accountMenuDropdown: {
    width: 230,
    maxWidth: '85%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.card,
    elevation: 8,
  },
  accountMenuHeader: {
    marginBottom: spacing.xs,
  },
  accountMenuName: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  accountMenuRole: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  accountMenuEmail: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  accountMenuDivider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  accountMenuLogoutText: {
    ...typography.bodyBold,
    fontSize: 14,
    fontWeight: '700',
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
  langBtnCompact: {
    height: 36,
    minWidth: 42,
    maxWidth: 48,
    paddingHorizontal: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  langTextCompact: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.subheader,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalOptionsList: {
    gap: spacing.sm,
  },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 60,
  },
  langOptionCardSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  langOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  langOptionFlag: {
    fontSize: 28,
  },
  langOptionTextCol: {},
  langOptionNative: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  langOptionEnglish: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '800',
  },
});
