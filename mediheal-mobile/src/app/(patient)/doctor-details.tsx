import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getDoctorById } from '../../services/doctorService';
import { createAppointment } from '../../services/appointmentService';
import { DoctorProfile } from '../../types/doctor';

interface DateItem {
  dateIso: string;
  dayShort: string;
  dayFull: string;
  dayNum: number;
  monthShort: string;
  isDoctorAvailableDay: boolean;
}

export default function DoctorDetailsScreen() {
  const router = useRouter();
  const { id, initialReason } = useLocalSearchParams<{ id: string; initialReason?: string }>();

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [selectedDateIso, setSelectedDateIso] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(initialReason || '');

  // Generate 14 upcoming dates starting from today
  const upcomingDates: DateItem[] = useMemo(() => {
    const dates: DateItem[] = [];
    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const dayFull = d.toLocaleDateString('en-US', { weekday: 'long' });
      const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dayNum = d.getDate();
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
      const dateIso = d.toISOString().split('T')[0];

      // Check if day matches doctor.availableDays if doctor is loaded
      let isDoctorAvailableDay = true;
      if (doctor?.availableDays && doctor.availableDays.length > 0) {
        isDoctorAvailableDay = doctor.availableDays.some(
          (availDay) => availDay.toLowerCase().trim() === dayFull.toLowerCase().trim()
        );
      }

      dates.push({
        dateIso,
        dayShort,
        dayFull,
        dayNum,
        monthShort,
        isDoctorAvailableDay,
      });
    }
    return dates;
  }, [doctor?.availableDays]);

  const fetchDoctorDetails = useCallback(async () => {
    if (!id) {
      setErrorMsg('No doctor ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getDoctorById(id);
      if (res && res.success && res.data) {
        setDoctor(res.data);
      } else {
        setErrorMsg('Doctor profile not found.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load doctor profile details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  // Default select first date once upcomingDates is generated
  useEffect(() => {
    if (upcomingDates.length > 0 && !selectedDateIso) {
      // Prefer first available day if possible, or today
      const preferred = upcomingDates.find((d) => d.isDoctorAvailableDay) || upcomingDates[0];
      setSelectedDateIso(preferred.dateIso);
    }
  }, [upcomingDates, selectedDateIso]);

  const selectedDateObject = useMemo(() => {
    return upcomingDates.find((d) => d.dateIso === selectedDateIso);
  }, [upcomingDates, selectedDateIso]);

  const handleBookAppointment = async () => {
    if (!doctor) return;

    if (!selectedDateIso) {
      Alert.alert('Date Required', 'Please select an appointment date.');
      return;
    }

    if (!selectedSlot) {
      Alert.alert('Time Slot Required', 'Please select an available time slot.');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please enter a brief reason for your visit.');
      return;
    }

    // Verify doctor availability day check
    if (selectedDateObject && !selectedDateObject.isDoctorAvailableDay) {
      Alert.alert(
        'Doctor Unavailable On Selected Day',
        `${doctor.userId?.fullName || 'Doctor'} is listed as available on: ${
          doctor.availableDays.join(', ') || 'N/A'
        }.\n\nWould you like to proceed anyway?`,
        [
          { text: 'Choose Another Date', style: 'cancel' },
          { text: 'Proceed', onPress: () => submitBooking() },
        ]
      );
      return;
    }

    await submitBooking();
  };

  const submitBooking = async () => {
    if (!doctor) return;

    setSubmitting(true);
    try {
      // Prefer doctor.userId._id canonical ID for appointment creation
      const doctorIdToUse = doctor.userId?._id || doctor._id;

      const res = await createAppointment({
        doctorId: doctorIdToUse,
        appointmentDate: selectedDateIso,
        timeSlot: selectedSlot!,
        reason: reason.trim(),
      });

      if (res && res.success && res.data) {
        // Navigate to Booking Confirmation screen passing appointment details
        router.push({
          pathname: '/(patient)/booking-confirmation' as any,
          params: {
            appointmentId: res.data._id,
            doctorName: doctor.userId?.fullName || 'Doctor',
            specialization: doctor.specialization,
            hospital: doctor.hospital,
            appointmentDate: res.data.appointmentDate,
            timeSlot: res.data.timeSlot,
          },
        });
      } else {
        Alert.alert('Booking Error', res.message || 'Failed to create appointment.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'An unexpected error occurred while booking.';
      if (errMsg.toLowerCase().includes('already booked')) {
        Alert.alert(
          'Slot Unavailable',
          'This time slot has already been booked for the selected date. Please choose another time slot.'
        );
      } else if (errMsg.toLowerCase().includes('past')) {
        Alert.alert('Invalid Date', 'Appointment date cannot be in the past. Please select a future date.');
      } else if (errMsg.toLowerCase().includes('not available')) {
        Alert.alert('Doctor Unavailable', 'This doctor is currently not accepting new appointments.');
      } else {
        Alert.alert('Booking Failed', errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading doctor profile..." />;
  }

  if (errorMsg || !doctor) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Doctor Details" onBackPress={() => router.back()} />
        <ErrorView
          message={errorMsg || 'Doctor profile unavailable.'}
          onRetry={fetchDoctorDetails}
        />
      </ScreenContainer>
    );
  }

  const rawName = doctor.userId?.fullName || 'Medical Specialist';
  const doctorName = rawName.toLowerCase().startsWith('dr.')
    ? rawName
    : `Dr. ${rawName}`;

  const initials = rawName
    .replace(/^dr\.\s*/i, '')
    .trim()
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'DR';

  const feeFormatted = doctor.consultationFee
    ? `LKR ${doctor.consultationFee.toLocaleString()}`
    : 'LKR 0';

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader title="Doctor Details" onBackPress={() => router.back()} />

      <View style={styles.container}>
        {/* Main Identity & Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.doctorName}>{doctorName}</Text>
          
          <Text style={styles.specializationBadge}>
            {doctor.specialization.toUpperCase()}
          </Text>

          {doctor.slmcNumber ? (
            <Text style={styles.slmcText}>SLMC Reg No: {doctor.slmcNumber}</Text>
          ) : null}

          <View style={styles.hospitalRow}>
            <Text style={styles.hospitalIcon}>🏥</Text>
            <Text style={styles.hospitalText}>
              {doctor.hospital}
              {doctor.location ? `, ${doctor.location}` : ''}
            </Text>
          </View>

          {/* Map Location Actions */}
          {typeof doctor.latitude === 'number' && typeof doctor.longitude === 'number' ? (
            <View style={styles.mapActionsRow}>
              <TouchableOpacity
                style={styles.mapBtnOutline}
                onPress={() =>
                  router.push({
                    pathname: '/(patient)/doctor-map' as any,
                    params: { specialization: doctor.specialization },
                  })
                }
              >
                <Text style={styles.mapBtnOutlineText}>🗺️ View on Map</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapBtnFilled}
                onPress={() => {
                  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${doctor.latitude},${doctor.longitude}`;
                  Linking.openURL(mapsUrl).catch(() =>
                    Alert.alert('Navigation Error', 'Unable to open Google Maps.')
                  );
                }}
              >
                <Text style={styles.mapBtnFilledText}>🧭 Get Directions</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {doctor.yearsOfExperience > 0 ? `${doctor.yearsOfExperience}+ Yrs` : 'N/A'}
              </Text>
              <Text style={styles.statLbl}>Experience</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statVal}>{feeFormatted}</Text>
              <Text style={styles.statLbl}>Consultation Fee</Text>
            </View>
          </View>
        </View>

        {/* Biography & Languages Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Biography & Background</Text>
          <Text style={styles.bodyText}>
            {doctor.biography || 'No biography provided for this doctor.'}
          </Text>

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Spoken Languages</Text>
          <View style={styles.langChipContainer}>
            {doctor.languages && doctor.languages.length > 0 ? (
              doctor.languages.map((lang, idx) => (
                <View key={idx} style={styles.langChip}>
                  <Text style={styles.langText}>🗣️ {lang}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyText}>English</Text>
            )}
          </View>
        </View>

        {/* Date & Time Slot Picker Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Select Appointment Date</Text>
          <Text style={styles.sectionSub}>Choose a convenient date for your visit</Text>

          {/* Date Horizontal Scroll Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.daysScroll}
            contentContainerStyle={styles.daysContainer}
          >
            {upcomingDates.map((item) => {
              const isSelected = selectedDateIso === item.dateIso;
              return (
                <TouchableOpacity
                  key={item.dateIso}
                  style={[
                    styles.dateChip,
                    isSelected && styles.activeDateChip,
                    !item.isDoctorAvailableDay && styles.unavailableDateChip,
                  ]}
                  onPress={() => setSelectedDateIso(item.dateIso)}
                >
                  <Text style={[styles.dayShortText, isSelected && styles.activeText]}>
                    {item.dayShort}
                  </Text>
                  <Text style={[styles.dayNumText, isSelected && styles.activeText]}>
                    {item.dayNum}
                  </Text>
                  <Text style={[styles.monthShortText, isSelected && styles.activeText]}>
                    {item.monthShort}
                  </Text>

                  {!item.isDoctorAvailableDay && (
                    <View style={styles.offDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {doctor.availableDays && doctor.availableDays.length > 0 ? (
            <Text style={styles.availableDaysHint}>
              📅 Regular Available Days: {doctor.availableDays.join(', ')}
            </Text>
          ) : null}

          {/* Time Slot Picker Grid */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Select a Time Slot</Text>
          <Text style={styles.sectionSub}>Choose your preferred time slot</Text>

          {doctor.availableTimeSlots && doctor.availableTimeSlots.length > 0 ? (
            <View style={styles.slotsGrid}>
              {doctor.availableTimeSlots.map((slot, idx) => {
                const isSelected = selectedSlot === slot;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.slotChip, isSelected && styles.activeSlotChip]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text
                      style={[styles.slotText, isSelected && styles.activeSlotText]}
                    >
                      ⏰ {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptySlotBox}>
              <Text style={styles.emptyScheduleText}>
                No schedule time slots currently listed for this doctor.
              </Text>
            </View>
          )}

          {/* Reason for Appointment Field */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
            Reason for Visit *
          </Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Describe your symptoms or reason for consultation..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
          />
        </View>

        {/* Book Appointment CTA Section */}
        <View style={styles.ctaBox}>
          <AppButton
            title={submitting ? 'Securing Appointment...' : 'Confirm & Book Appointment'}
            onPress={handleBookAppointment}
            variant="primary"
            disabled={submitting}
            style={styles.bookBtn}
          />
          <Text style={styles.ctaSubtext}>
            Consultation fee of {feeFormatted} will be charged per session.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primaryLight,
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    ...typography.title,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  doctorName: {
    ...typography.header,
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  specializationBadge: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  slmcText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  hospitalIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  hospitalText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
  },
  mapActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    width: '100%',
  },
  mapBtnOutline: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  mapBtnOutlineText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  mapBtnFilled: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  mapBtnFilledText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textWhite,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statVal: {
    ...typography.bodyBold,
    color: colors.primaryDark,
    fontSize: 16,
  },
  statLbl: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitle: {
    ...typography.subheader,
    color: colors.textPrimary,
    fontSize: 16,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  langChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  langChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  langText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  daysScroll: {
    marginVertical: spacing.xs,
  },
  daysContainer: {
    gap: spacing.xs,
  },
  dateChip: {
    width: 64,
    height: 76,
    borderRadius: borderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  activeDateChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unavailableDateChip: {
    opacity: 0.6,
  },
  dayShortText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayNumText: {
    ...typography.subheader,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 1,
  },
  monthShortText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  activeText: {
    color: colors.textWhite,
  },
  offDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.warning,
    position: 'absolute',
    bottom: 4,
  },
  availableDaysHint: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: '45%',
    alignItems: 'center',
  },
  activeSlotChip: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  slotText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeSlotText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  emptyScheduleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginVertical: spacing.xs,
  },
  emptySlotBox: {
    padding: spacing.md,
    alignItems: 'center',
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    ...typography.body,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  ctaBox: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  bookBtn: {
    width: '100%',
  },
  ctaSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
