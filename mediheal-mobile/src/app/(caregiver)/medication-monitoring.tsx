import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getCaregiverMissedMedications,
  getCaregiverPatientTodayMedications,
} from '../../services/medicationReminderService';
import { getLinkedPatients } from '../../services/caregiverService';
import {
  CaregiverMissedMedicationItem,
  CaregiverPatientTodayMedicationTask,
} from '../../types/medicationReminder';
import { LinkedPatientItem } from '../../types/caregiver';

export default function CaregiverMedicationMonitoringScreen() {
  const router = useRouter();
  const { colors: themeColors, isDark } = useTheme();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'missed' | 'today'>('missed');
  const [missedList, setMissedList] = useState<CaregiverMissedMedicationItem[]>([]);
  const [patients, setPatients] = useState<LinkedPatientItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientTodayTasks, setPatientTodayTasks] = useState<
    CaregiverPatientTodayMedicationTask[]
  >([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Contact Modal State
  const [contactModalVisible, setContactModalVisible] = useState<boolean>(false);
  const [contactTarget, setContactTarget] = useState<CaregiverMissedMedicationItem | null>(null);

  const fetchData = useCallback(async () => {
    setErrorMsg('');
    try {
      const [missedRes, patientsRes] = await Promise.all([
        getCaregiverMissedMedications(),
        getLinkedPatients(),
      ]);

      if (missedRes && missedRes.success) {
        setMissedList(missedRes.data || []);
      }

      if (patientsRes && patientsRes.success && Array.isArray(patientsRes.data)) {
        setPatients(patientsRes.data);
        if (patientsRes.data.length > 0 && !selectedPatientId) {
          const firstId = patientsRes.data[0].patient?._id;
          if (firstId) setSelectedPatientId(firstId);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load medication monitoring data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatientId]);

  // Load today's schedule for selected patient when activeTab is 'today'
  const fetchPatientTodaySchedule = useCallback(async (pId: string) => {
    try {
      const res = await getCaregiverPatientTodayMedications(pId);
      if (res && res.success) {
        setPatientTodayTasks(res.data || []);
      } else {
        setPatientTodayTasks([]);
      }
    } catch {
      setPatientTodayTasks([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedPatientId && activeTab === 'today') {
      fetchPatientTodaySchedule(selectedPatientId);
    }
  }, [selectedPatientId, activeTab, fetchPatientTodaySchedule]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    if (selectedPatientId && activeTab === 'today') {
      fetchPatientTodaySchedule(selectedPatientId);
    }
  }, [fetchData, selectedPatientId, activeTab, fetchPatientTodaySchedule]);

  const handleOpenContactModal = (item: CaregiverMissedMedicationItem) => {
    setContactTarget(item);
    setContactModalVisible(true);
  };

  const handleCallPatient = (phone?: string) => {
    if (!phone) {
      Alert.alert('Phone Not Available', 'This patient has not provided a phone number.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Call Not Supported', `Please dial ${phone} manually.`);
        }
      })
      .catch(() => {
        Alert.alert('Call Error', `Unable to initiate call to ${phone}.`);
      });
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading medication monitoring..." />;
  }

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('patientMedicationMonitoring')}
        subtitle={
          missedList.length > 0
            ? `${missedList.length} ${t('missedMedication')} alert(s)`
            : t('allDosesOnTrack')
        }
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {/* Tab Switcher */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'missed' && {
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={() => setActiveTab('missed')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                {
                  color:
                    activeTab === 'missed' ? '#FFFFFF' : themeColors.textSecondary,
                },
                activeTab === 'missed' && styles.tabBtnTextActive,
              ]}
            >
              ⚠️ {t('missedMedication')} {missedList.length > 0 ? `(${missedList.length})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'today' && {
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={() => setActiveTab('today')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                {
                  color:
                    activeTab === 'today' ? '#FFFFFF' : themeColors.textSecondary,
                },
                activeTab === 'today' && styles.tabBtnTextActive,
              ]}
            >
              📋 Today's Prescriptions
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? <ErrorView message={errorMsg} onRetry={fetchData} /> : null}

        {/* TAB 1: MISSED MEDICATIONS */}
        {activeTab === 'missed' && (
          <FlatList
            data={missedList}
            keyExtractor={(item, idx) => `${item.recordId}_${idx}`}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeColors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !errorMsg ? (
                <EmptyState
                  icon="🛡️"
                  title={t('noMissedMedications')}
                  description={t('allDosesOnTrack')}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.missedCard,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.danger,
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.warningBadgeCircle,
                      {
                        backgroundColor: isDark
                          ? 'rgba(239, 68, 68, 0.25)'
                          : '#FEE2E2',
                      },
                    ]}
                  >
                    <Text style={styles.warningIcon}>⚠️</Text>
                  </View>

                  <View style={styles.cardHeaderInfo}>
                    <Text
                      style={[
                        styles.missedBannerTitle,
                        { color: themeColors.danger },
                      ]}
                    >
                      {t('missedMedication')}
                    </Text>
                    <Text
                      style={[
                        styles.patientNameLabel,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      Patient: <Text style={{ fontWeight: '700' }}>{item.patientName}</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isDark
                          ? 'rgba(239, 68, 68, 0.2)'
                          : '#FEF2F2',
                        borderColor: themeColors.danger,
                      },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: themeColors.danger }]}>
                      MISSED
                    </Text>
                  </View>
                </View>

                {/* Details Section */}
                <View
                  style={[
                    styles.detailsBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.03)'
                        : '#F9FAFB',
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <View style={styles.detailItemRow}>
                    <Text
                      style={[
                        styles.detailItemLabel,
                        { color: themeColors.textSecondary },
                      ]}
                    >
                      Medicine:
                    </Text>
                    <Text
                      style={[
                        styles.detailItemValue,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      {item.medicine} {item.dosage ? `(${item.dosage})` : ''}
                    </Text>
                  </View>

                  <View style={styles.detailItemRow}>
                    <Text
                      style={[
                        styles.detailItemLabel,
                        { color: themeColors.textSecondary },
                      ]}
                    >
                      Time:
                    </Text>
                    <Text
                      style={[
                        styles.detailItemValue,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      {item.time} ({item.scheduledDate})
                    </Text>
                  </View>
                </View>

                {/* Action Button: Contact Patient */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.contactBtn,
                      { backgroundColor: themeColors.primary },
                    ]}
                    onPress={() => handleOpenContactModal(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.contactBtnText}>
                      📞 {t('contactPatient')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        {/* TAB 2: TODAY'S PATIENT SCHEDULE */}
        {activeTab === 'today' && (
          <View style={styles.todayTabContainer}>
            {/* Patient Selector Tabs if > 1 */}
            {patients.length > 1 && (
              <View style={styles.patientSelectorRow}>
                {patients.map((p) => {
                  const pId = p.patient?._id;
                  const isSelected = selectedPatientId === pId;
                  return (
                    <TouchableOpacity
                      key={p._id}
                      style={[
                        styles.patientSelectBtn,
                        {
                          backgroundColor: isSelected
                            ? themeColors.primary
                            : themeColors.card,
                          borderColor: isSelected
                            ? themeColors.primary
                            : themeColors.border,
                        },
                      ]}
                      onPress={() => pId && setSelectedPatientId(pId)}
                    >
                      <Text
                        style={[
                          styles.patientSelectBtnText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : themeColors.textSecondary,
                          },
                        ]}
                      >
                        {p.patient?.fullName || 'Patient'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <FlatList
              data={patientTodayTasks}
              keyExtractor={(item) => item._id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={themeColors.primary}
                />
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <EmptyState
                  icon="💊"
                  title="No Scheduled Doses Today"
                  description="This patient has no active prescribed doses scheduled for today."
                />
              }
              renderItem={({ item }) => {
                const isTaken = item.status === 'TAKEN';
                const isMissed = item.status === 'MISSED';

                return (
                  <View
                    style={[
                      styles.todayTaskCard,
                      {
                        backgroundColor: themeColors.card,
                        borderColor: isTaken
                          ? themeColors.success
                          : isMissed
                          ? themeColors.danger
                          : themeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.todayTaskRow}>
                      <Text style={styles.todayTaskIcon}>
                        {isTaken ? '✓' : isMissed ? '⚠️' : '💊'}
                      </Text>
                      <View style={styles.todayTaskTextCol}>
                        <Text
                          style={[
                            styles.todayTaskName,
                            { color: themeColors.textPrimary },
                          ]}
                        >
                          {item.medicineName} ({item.dosage})
                        </Text>
                        <Text
                          style={[
                            styles.todayTaskTime,
                            { color: themeColors.textSecondary },
                          ]}
                        >
                          Scheduled: {item.scheduledTimeFormatted}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: isTaken
                              ? themeColors.successLight
                              : isMissed
                              ? themeColors.dangerLight
                              : isDark
                              ? 'rgba(234, 179, 8, 0.2)'
                              : '#FEF3C7',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            {
                              color: isTaken
                                ? themeColors.success
                                : isMissed
                                ? themeColors.danger
                                : isDark
                                ? '#FDE047'
                                : '#B45309',
                            },
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Contact Patient Information Modal */}
      <Modal
        visible={contactModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContactModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setContactModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: themeColors.border },
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: themeColors.textPrimary },
                ]}
              >
                📞 {t('contactPatient')}
              </Text>
              <TouchableOpacity
                onPress={() => setContactModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.modalCloseText,
                    { color: themeColors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text
                style={[
                  styles.modalPrompt,
                  { color: themeColors.textSecondary },
                ]}
              >
                Contact details for{' '}
                <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>
                  {contactTarget?.patientName}
                </Text>{' '}
                regarding missed dose of{' '}
                <Text style={{ fontWeight: '700', color: themeColors.danger }}>
                  {contactTarget?.medicine}
                </Text>{' '}
                at {contactTarget?.time}:
              </Text>

              {/* Phone Info */}
              <View
                style={[
                  styles.contactInfoRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : '#F3F4F6',
                  },
                ]}
              >
                <Text style={styles.contactInfoIcon}>📱</Text>
                <View style={styles.contactInfoTextCol}>
                  <Text
                    style={[
                      styles.contactInfoLabel,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Phone Number:
                  </Text>
                  <Text
                    style={[
                      styles.contactInfoValue,
                      { color: themeColors.textPrimary },
                    ]}
                  >
                    {contactTarget?.patientPhone || 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Email Info */}
              {contactTarget?.patientEmail ? (
                <View
                  style={[
                    styles.contactInfoRow,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : '#F3F4F6',
                      marginTop: 8,
                    },
                  ]}
                >
                  <Text style={styles.contactInfoIcon}>✉️</Text>
                  <View style={styles.contactInfoTextCol}>
                    <Text
                      style={[
                        styles.contactInfoLabel,
                        { color: themeColors.textSecondary },
                      ]}
                    >
                      Email Address:
                    </Text>
                    <Text
                      style={[
                        styles.contactInfoValue,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      {contactTarget.patientEmail}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.modalActionsRow}>
                {contactTarget?.patientPhone ? (
                  <TouchableOpacity
                    style={[
                      styles.callPatientBtn,
                      { backgroundColor: themeColors.success },
                    ]}
                    onPress={() => {
                      setContactModalVisible(false);
                      handleCallPatient(contactTarget?.patientPhone);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.callPatientBtnText}>📞 Call Patient</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.closeModalBtn,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => setContactModalVisible(false)}
                >
                  <Text
                    style={[
                      styles.closeModalBtnText,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  tabBtnText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  tabBtnTextActive: {
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  missedCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  warningIcon: {
    fontSize: 22,
  },
  cardHeaderInfo: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  missedBannerTitle: {
    ...typography.subheader,
    fontWeight: '700',
    fontSize: 15,
  },
  patientNameLabel: {
    ...typography.caption,
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  statusPillText: {
    fontWeight: '800',
    fontSize: 11,
  },
  detailsBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  detailItemLabel: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 13,
    width: 75,
  },
  detailItemValue: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  actionRow: {
    marginTop: spacing.md,
  },
  contactBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  todayTabContainer: {
    flex: 1,
  },
  patientSelectorRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  patientSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  patientSelectBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  todayTaskCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  todayTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayTaskIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  todayTaskTextCol: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  todayTaskName: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  todayTaskTime: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.subheader,
    fontWeight: '700',
    fontSize: 16,
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.md,
  },
  modalPrompt: {
    ...typography.body,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  contactInfoIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  contactInfoTextCol: {
    flex: 1,
  },
  contactInfoLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  contactInfoValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 15,
  },
  modalActionsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  callPatientBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPatientBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  closeModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
