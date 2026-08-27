import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { getSpecializationTranslationKey } from '../../utils/displayMappers';

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    appointmentId?: string;
    doctorName?: string;
    specialization?: string;
    hospital?: string;
    appointmentDate?: string;
    timeSlot?: string;
  }>();

  // Format date display
  const formatDateDisplay = (rawDate?: string) => {
    if (!rawDate) return 'Upcoming Scheduled Date';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return rawDate;
    }
  };

  const formattedDate = formatDateDisplay(params.appointmentDate);

  const handleBackHome = () => {
    router.replace('/(patient)' as any);
  };

  const handleViewBookings = () => {
    router.replace('/(patient)/my-bookings' as any);
  };

  const specKey = getSpecializationTranslationKey(params.specialization);
  const specLocalized = typeof specKey === 'string' && specKey in t ? t(specKey as any) : params.specialization;

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <AppHeader
        title={t('appTitle')}
        subtitle={t('bookingConfirmation')}
        onBackPress={handleBackHome}
      />

      <View style={styles.container}>
        {/* Main White Confirmation Card */}
        <View style={styles.card}>
          {/* Green Check Circle */}
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>

          {/* Heading */}
          <Text style={styles.title}>{t('appointmentBookedSuccess')}</Text>

          {/* Details Box */}
          <View style={styles.detailsBox}>
            {/* Doctor */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Text style={styles.detailIcon}>👤</Text>
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>{t('doctor').toUpperCase()}</Text>
                <Text style={styles.detailVal}>
                  {params.doctorName || 'Medical Specialist'}
                </Text>
                {specLocalized ? (
                  <Text style={styles.detailSubVal}>{specLocalized}</Text>
                ) : null}
              </View>
            </View>

            {/* Hospital */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Text style={styles.detailIcon}>🏥</Text>
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>{t('hospital').toUpperCase()}</Text>
                <Text style={styles.detailVal}>
                  {params.hospital || 'MediHeal Partner Hospital'}
                </Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Text style={styles.detailIcon}>📅</Text>
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>{t('date').toUpperCase()} & {t('time').toUpperCase()}</Text>
                <Text style={styles.detailVal}>{formattedDate}</Text>
                {params.timeSlot ? (
                  <Text style={styles.detailSubVal}>⏰ {params.timeSlot}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <AppButton
            title={t('viewMyBookings')}
            onPress={handleViewBookings}
            variant="primary"
            style={styles.actionBtn}
          />

          <AppButton
            title={t('backToHome')}
            onPress={handleBackHome}
            variant="outline"
            style={styles.actionBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successLight,
    borderWidth: 2,
    borderColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkMark: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.success,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  detailIcon: {
    fontSize: 18,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  detailVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailSubVal: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  actionCol: {
    width: '100%',
    gap: spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
});
