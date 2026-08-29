import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AppButton } from '../../components/AppButton';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { getSpecializationTranslationKey } from '../../utils/displayMappers';
import { useTheme } from '../../context/ThemeContext';

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();
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
    <ScreenContainer scrollable backgroundColor={themeColors.background}>
      <AppHeader
        title={t('appTitle')}
        subtitle={t('bookingConfirmation')}
        onBackPress={handleBackHome}
      />

      <View style={styles.container}>
        {/* Main White Confirmation Card */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          {/* Green Check Circle */}
          <View style={[styles.checkCircle, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.success }]}>
            <Text style={[styles.checkMark, { color: themeColors.success }]}>✓</Text>
          </View>

          {/* Heading */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('appointmentBookedSuccess')}</Text>

          {/* Details Box */}
          <View style={[styles.detailsBox, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
            {/* Doctor */}
            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: themeColors.primaryLight }]}>
                <Text style={styles.detailIcon}>👤</Text>
              </View>
              <View style={styles.detailTextCol}>
                <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>{t('doctor').toUpperCase()}</Text>
                <Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>
                  {params.doctorName || 'Medical Specialist'}
                </Text>
                {specLocalized ? (
                  <Text style={[styles.detailSubVal, { color: themeColors.primary }]}>{specLocalized}</Text>
                ) : null}
              </View>
            </View>

            {/* Hospital */}
            <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: themeColors.primaryLight }]}>
                <Text style={styles.detailIcon}>🏥</Text>
              </View>
              <View style={styles.detailTextCol}>
                <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>{t('hospital').toUpperCase()}</Text>
                <Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>
                  {params.hospital || 'MediHeal Partner Hospital'}
                </Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={[styles.detailRow, { borderBottomColor: 'transparent' }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: themeColors.primaryLight }]}>
                <Text style={styles.detailIcon}>📅</Text>
              </View>
              <View style={styles.detailTextCol}>
                <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>{t('date').toUpperCase()} & {t('time').toUpperCase()}</Text>
                <Text style={[styles.detailVal, { color: themeColors.textPrimary }]}>{formattedDate}</Text>
                {params.timeSlot ? (
                  <Text style={[styles.detailSubVal, { color: themeColors.primary }]}>⏰ {params.timeSlot}</Text>
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
