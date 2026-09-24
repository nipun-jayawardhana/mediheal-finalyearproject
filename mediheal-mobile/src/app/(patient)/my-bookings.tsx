import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppointmentCard } from '../../components/AppointmentCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import {
  getMyAppointments,
  cancelAppointment,
  getDoctorAvailableSlotsApi,
  rescheduleAppointmentApi,
} from '../../services/appointmentService';
import { getMyConsultations } from '../../services/consultationService';
import { Appointment, AvailableSlotItem } from '../../types/appointment';
import { Consultation } from '../../types/consultation';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface DateItem {
  dateIso: string;
  dayShort: string;
  dayNum: number;
  monthShort: string;
}

export default function MyBookingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors, isDark } = useTheme();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultationMap, setConsultationMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Reschedule Modal State
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [selectedApptForReschedule, setSelectedApptForReschedule] = useState<Appointment | null>(null);
  const [rescheduleDateIso, setRescheduleDateIso] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailableSlotItem[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState<boolean>(false);
  const [rescheduleSlotsMessage, setRescheduleSlotsMessage] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);

  // 14 upcoming dates starting from tomorrow for reschedule
  const upcomingDates: DateItem[] = useMemo(() => {
    const dates: DateItem[] = [];
    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dayNum = d.getDate();
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
      const dateIso = d.toISOString().split('T')[0];

      dates.push({
        dateIso,
        dayShort,
        dayNum,
        monthShort,
      });
    }
    return dates;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // Fetch both appointments and consultations in parallel
      const [apptsRes, consultsRes] = await Promise.all([
        getMyAppointments(),
        getMyConsultations().catch(() => null), // Fail-safe if no consultations exist
      ]);

      if (apptsRes && apptsRes.success) {
        setAppointments(apptsRes.data || []);
      } else {
        setErrorMsg('Failed to retrieve your appointments.');
      }

      // Build map of appointmentId._id -> consultation._id
      if (consultsRes && consultsRes.success && Array.isArray(consultsRes.data)) {
        const map: Record<string, string> = {};
        consultsRes.data.forEach((c: Consultation) => {
          const apptId = typeof c.appointmentId === 'object' ? c.appointmentId?._id : c.appointmentId;
          if (apptId) {
            map[apptId] = c._id;
          }
        });
        setConsultationMap(map);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh appointments whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleCancelPress = (appointment: Appointment) => {
    const doctorNameRaw = appointment.doctorId?.fullName || 'Doctor';
    const doctorName = doctorNameRaw.toLowerCase().startsWith('dr.')
      ? doctorNameRaw
      : `Dr. ${doctorNameRaw}`;

    Alert.alert(
      t('cancelAppointmentConfirm'),
      `Are you sure you want to cancel your appointment with ${doctorName} on ${appointment.timeSlot}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('yesCancel'),
          style: 'destructive',
          onPress: () => performCancellation(appointment._id),
        },
      ]
    );
  };

  const performCancellation = async (appointmentId: string) => {
    setCancellingId(appointmentId);
    try {
      const res = await cancelAppointment(appointmentId, 'Cancelled by patient via mobile app');
      if (res && res.success) {
        Alert.alert(t('cancelAppointment'), 'Your appointment has been cancelled successfully.');
        setAppointments((prev) =>
          prev.map((app) =>
            app._id === appointmentId
              ? { ...app, status: 'cancelled', cancellationReason: 'Cancelled by patient' }
              : app
          )
        );
      } else {
        Alert.alert('Cancellation Error', res.message || 'Failed to cancel appointment.');
      }
    } catch (err: any) {
      Alert.alert('Cancellation Error', err.message || 'Unable to process cancellation.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleViewSummary = (appointment: Appointment) => {
    const consultationId = consultationMap[appointment._id];
    if (consultationId) {
      router.push({
        pathname: '/(patient)/consultation-summary' as any,
        params: { id: consultationId },
      });
    } else {
      Alert.alert(
        t('consultationSummary'),
        'No detailed consultation notes have been recorded for this appointment yet.'
      );
    }
  };

  // --- Reschedule Flow ---
  const handleOpenReschedule = (appointment: Appointment) => {
    setSelectedApptForReschedule(appointment);
    const initialDate = upcomingDates[0]?.dateIso || new Date().toISOString().split('T')[0];
    setRescheduleDateIso(initialDate);
    setRescheduleSlot(null);
    setRescheduleModalVisible(true);
  };

  const fetchRescheduleSlots = useCallback(async (doctorId: string, dateIso: string) => {
    setLoadingRescheduleSlots(true);
    setRescheduleSlotsMessage('');
    setRescheduleSlot(null);

    try {
      const res = await getDoctorAvailableSlotsApi(doctorId, dateIso);
      if (res && res.success) {
        setRescheduleSlots(res.slots || []);
        if (res.message) {
          setRescheduleSlotsMessage(res.message);
        }
      } else {
        setRescheduleSlots([]);
        setRescheduleSlotsMessage(res?.message || 'No available slots');
      }
    } catch (err: any) {
      setRescheduleSlots([]);
      setRescheduleSlotsMessage(err.message || 'Unable to load slots');
    } finally {
      setLoadingRescheduleSlots(false);
    }
  }, []);

  useEffect(() => {
    if (rescheduleModalVisible && selectedApptForReschedule && rescheduleDateIso) {
      const docId = selectedApptForReschedule.doctorId?._id;
      if (docId) {
        fetchRescheduleSlots(docId, rescheduleDateIso);
      }
    }
  }, [rescheduleModalVisible, selectedApptForReschedule, rescheduleDateIso, fetchRescheduleSlots]);

  const handleConfirmReschedule = async () => {
    if (!selectedApptForReschedule || !rescheduleDateIso || !rescheduleSlot) {
      Alert.alert('Incomplete Selection', 'Please choose a date and available time slot.');
      return;
    }

    setSubmittingReschedule(true);
    try {
      const res = await rescheduleAppointmentApi(selectedApptForReschedule._id, {
        newDate: rescheduleDateIso,
        newTimeSlot: rescheduleSlot,
      });

      if (res && res.success && res.data) {
        Alert.alert(t('rescheduleSuccess'), 'Your appointment has been successfully rescheduled.');
        setAppointments((prev) =>
          prev.map((app) => (app._id === res.data._id ? res.data : app))
        );
        setRescheduleModalVisible(false);
      } else {
        Alert.alert('Reschedule Failed', res.message || 'Unable to reschedule appointment.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error occurred while rescheduling.';
      if (errMsg.toLowerCase().includes('already booked')) {
        Alert.alert(
          'Slot Unavailable',
          'This slot has just been booked. Please choose another slot.'
        );
        if (selectedApptForReschedule.doctorId?._id) {
          fetchRescheduleSlots(selectedApptForReschedule.doctorId._id, rescheduleDateIso);
        }
      } else {
        Alert.alert('Reschedule Error', errMsg);
      }
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Group appointments into sections
  const upcomingAppointments = appointments.filter(
    (app) => app.status === 'pending' || app.status === 'confirmed'
  );
  const completedAppointments = appointments.filter((app) => app.status === 'completed');
  const cancelledAppointments = appointments.filter((app) => app.status === 'cancelled');

  if (loading && appointments.length === 0) {
    return <LoadingView message="Loading your appointments..." />;
  }

  const isEmpty = appointments.length === 0;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('myBookingsTitle')}
        subtitle={t('manageAppointments')}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchData} />
        ) : null}

        {!errorMsg && isEmpty && (
          <EmptyState
            icon="📅"
            title={t('noBookingsFound')}
            description={t('noBookingsDesc')}
            actionText={t('findDoctor')}
            onAction={() => router.push('/(patient)/specialists' as any)}
          />
        )}

        {!errorMsg && !isEmpty && (
          <FlatList
            data={[{ key: 'content' }]}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <View style={styles.listSection}>
                {/* Upcoming Appointments Section */}
                {upcomingAppointments.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      {t('upcoming')} ({upcomingAppointments.length})
                    </Text>
                    {upcomingAppointments.map((app) => (
                      <AppointmentCard
                        key={app._id}
                        appointment={app}
                        onCancel={handleCancelPress}
                        onReschedule={handleOpenReschedule}
                        cancellingId={cancellingId}
                      />
                    ))}
                  </View>
                )}

                {/* Completed Appointments Section */}
                {completedAppointments.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      {t('completed')} ({completedAppointments.length})
                    </Text>
                    {completedAppointments.map((app) => (
                      <AppointmentCard
                        key={app._id}
                        appointment={app}
                        onViewSummary={handleViewSummary}
                      />
                    ))}
                  </View>
                )}

                {/* Cancelled Appointments Section */}
                {cancelledAppointments.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                      {t('cancelled')} ({cancelledAppointments.length})
                    </Text>
                    {cancelledAppointments.map((app) => (
                      <AppointmentCard key={app._id} appointment={app} />
                    ))}
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                {t('rescheduleAppointment')}
              </Text>
              <TouchableOpacity
                onPress={() => setRescheduleModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={[styles.modalCloseText, { color: themeColors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
              {t('rescheduleNotes')}
            </Text>

            {/* Doctor Info Row */}
            {selectedApptForReschedule && (
              <View style={[styles.modalDoctorBanner, { backgroundColor: themeColors.surfaceSecondary }]}>
                <Text style={[styles.modalDoctorName, { color: themeColors.primary }]}>
                  Dr. {selectedApptForReschedule.doctorId?.fullName || 'Doctor'}
                </Text>
                <Text style={[styles.modalCurrentTime, { color: themeColors.textSecondary }]}>
                  Current: {selectedApptForReschedule.timeSlot} on {new Date(selectedApptForReschedule.appointmentDate).toLocaleDateString()}
                </Text>
              </View>
            )}

            {/* Select Date Horizontal Scroll */}
            <Text style={[styles.modalSectionLabel, { color: themeColors.textPrimary }]}>
              {t('selectDate')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalDaysScroll}
            >
              {upcomingDates.map((item) => {
                const isSelected = rescheduleDateIso === item.dateIso;
                return (
                  <TouchableOpacity
                    key={item.dateIso}
                    style={[
                      styles.modalDateChip,
                      {
                        backgroundColor: isSelected ? themeColors.primary : themeColors.surfaceSecondary,
                        borderColor: isSelected ? themeColors.primary : themeColors.border,
                      },
                    ]}
                    onPress={() => setRescheduleDateIso(item.dateIso)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.dayShort} ${item.dayNum}`}
                  >
                    <Text
                      style={[
                        styles.modalDayShort,
                        { color: isSelected ? '#FFFFFF' : themeColors.textSecondary },
                      ]}
                    >
                      {item.dayShort}
                    </Text>
                    <Text
                      style={[
                        styles.modalDayNum,
                        { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                      ]}
                    >
                      {item.dayNum}
                    </Text>
                    <Text
                      style={[
                        styles.modalMonthShort,
                        { color: isSelected ? '#FFFFFF' : themeColors.textSecondary },
                      ]}
                    >
                      {item.monthShort}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Available Slots Grid */}
            <Text style={[styles.modalSectionLabel, { color: themeColors.textPrimary, marginTop: spacing.sm }]}>
              {t('availableSlots')}
            </Text>
            <ScrollView style={styles.modalSlotsContainer} showsVerticalScrollIndicator={false}>
              {loadingRescheduleSlots ? (
                <View style={styles.modalSlotEmptyBox}>
                  <Text style={[styles.modalSlotEmptyText, { color: themeColors.textSecondary }]}>
                    Loading available slots...
                  </Text>
                </View>
              ) : rescheduleSlots && rescheduleSlots.length > 0 ? (
                <View style={styles.modalSlotsGrid}>
                  {rescheduleSlots.map((slot, idx) => {
                    const isSelected = rescheduleSlot === slot.time;
                    const isAvailable = slot.available;
                    return (
                      <TouchableOpacity
                        key={idx}
                        disabled={!isAvailable}
                        style={[
                          styles.modalSlotChip,
                          {
                            backgroundColor: isAvailable
                              ? isSelected
                                ? themeColors.primaryLight
                                : themeColors.surfaceSecondary
                              : isDark
                              ? 'rgba(239, 68, 68, 0.15)'
                              : '#FEE2E2',
                            borderColor: isAvailable
                              ? isSelected
                                ? themeColors.primary
                                : themeColors.border
                              : themeColors.border,
                            opacity: isAvailable ? 1 : 0.6,
                          },
                        ]}
                        onPress={() => setRescheduleSlot(slot.time)}
                        accessibilityRole="button"
                        accessibilityLabel={`${slot.time} ${isAvailable ? t('available') : t('alreadyBooked')}`}
                      >
                        <Text
                          style={[
                            styles.modalSlotTime,
                            {
                              color: isAvailable
                                ? isSelected
                                  ? themeColors.primary
                                  : themeColors.textPrimary
                                : themeColors.textMuted,
                            },
                          ]}
                        >
                          ⏰ {slot.time}
                        </Text>
                        <Text
                          style={[
                            styles.modalSlotStatus,
                            {
                              color: isAvailable
                                ? isSelected
                                  ? themeColors.primary
                                  : themeColors.success
                                : themeColors.danger,
                            },
                          ]}
                        >
                          {isAvailable ? t('available') : t('alreadyBooked')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.modalSlotEmptyBox}>
                  <Text style={[styles.modalSlotEmptyText, { color: themeColors.textSecondary }]}>
                    {rescheduleSlotsMessage || t('chooseAnotherSlot')}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <AppButton
                title={t('cancel')}
                onPress={() => setRescheduleModalVisible(false)}
                variant="outline"
                style={styles.modalActionBtn}
              />
              <AppButton
                title={submittingReschedule ? '...' : t('rescheduleConfirm')}
                onPress={handleConfirmReschedule}
                variant="primary"
                disabled={!rescheduleSlot || submittingReschedule}
                style={styles.modalActionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  listSection: {
    paddingBottom: spacing.xl,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subheader,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
    borderWidth: 1,
    ...shadows.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    ...typography.header,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseText: {
    fontSize: 20,
    fontWeight: '700',
    padding: spacing.xs,
  },
  modalSubtitle: {
    ...typography.caption,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  modalDoctorBanner: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalDoctorName: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  modalCurrentTime: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  modalSectionLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  modalDaysScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  modalDateChip: {
    width: 60,
    height: 72,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modalDayShort: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalDayNum: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 1,
  },
  modalMonthShort: {
    fontSize: 10,
  },
  modalSlotsContainer: {
    maxHeight: 180,
    marginVertical: spacing.xs,
  },
  modalSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalSlotChip: {
    minWidth: '47%',
    flex: 1,
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  modalSlotTime: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSlotStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  modalSlotEmptyBox: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  modalSlotEmptyText: {
    ...typography.caption,
    fontSize: 13,
    fontStyle: 'italic',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalActionBtn: {
    flex: 1,
    minHeight: 48,
  },
});
