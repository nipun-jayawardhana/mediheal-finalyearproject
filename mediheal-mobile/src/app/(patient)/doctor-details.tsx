import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getDoctorById } from '../../services/doctorService';
import { DoctorProfile } from '../../types/doctor';

export default function DoctorDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

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
        if (res.data.availableDays && res.data.availableDays.length > 0) {
          setSelectedDay(res.data.availableDays[0]);
        }
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

  const handleBookPress = () => {
    Alert.alert(
      'Book Appointment',
      'Appointment booking will be available in the next step.'
    );
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

        {/* Professional Information Sections */}
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

        {/* Select a Time Slot Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Available Schedule & Time Slots</Text>
          <Text style={styles.sectionSub}>
            Select your preferred day and time for consultation
          </Text>

          {/* Available Days Selector */}
          {doctor.availableDays && doctor.availableDays.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.daysScroll}
              contentContainerStyle={styles.daysContainer}
            >
              {doctor.availableDays.map((day) => {
                const isSelected = selectedDay === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.activeDayChip]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.activeDayText]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyScheduleText}>No available days listed</Text>
          )}

          {/* Available Time Slots Grid */}
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
                No schedule currently available for this doctor.
              </Text>
            </View>
          )}
        </View>

        {/* Book Appointment CTA Section */}
        <View style={styles.ctaBox}>
          <AppButton
            title="Book Appointment"
            onPress={handleBookPress}
            variant="primary"
            style={styles.bookBtn}
          />
          <Text style={styles.ctaSubtext}>
            Consultation fee of {feeFormatted} applies. Booking module will be active in Step 22.
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
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeDayChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeDayText: {
    color: colors.textWhite,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
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
