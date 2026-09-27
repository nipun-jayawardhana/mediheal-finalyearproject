import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { DoctorCard } from '../../components/DoctorCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { getDoctors } from '../../services/doctorService';
import { getPatientProfileApi } from '../../services/patientService';
import { DoctorProfile } from '../../types/doctor';
import { useLanguage } from '../../context/LanguageContext';
import { getSpecializationTranslationKey } from '../../utils/displayMappers';
import { useTheme } from '../../context/ThemeContext';
import { calculateHaversineDistance, RADIUS_OPTIONS } from '../../utils/locationUtils';

interface UserLocation {
  latitude: number;
  longitude: number;
}

export default function SpecialistListScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors, isDark } = useTheme();
  const { specialization: initialSpecialization } = useLocalSearchParams<{
    specialization?: string;
  }>();

  const [selectedSpecialization, setSelectedSpecialization] = useState<string | undefined>(
    initialSpecialization
  );
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [patientLocation, setPatientLocation] = useState<UserLocation | null>(null);
  const [selectedRadius, setSelectedRadius] = useState<number | null>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Fetch Patient Location & Preferences from Profile, with device GPS fallback
  const fetchLocationAndPreferences = useCallback(async () => {
    try {
      const res = await getPatientProfileApi();
      if (res && res.success && res.data?.profile) {
        const prof = res.data.profile;
        if (prof.preferredDoctorRadius) {
          setSelectedRadius(prof.preferredDoctorRadius);
        }
        if (
          prof.patientLocation?.latitude &&
          prof.patientLocation?.longitude &&
          typeof prof.patientLocation.latitude === 'number' &&
          typeof prof.patientLocation.longitude === 'number'
        ) {
          setPatientLocation({
            latitude: prof.patientLocation.latitude,
            longitude: prof.patientLocation.longitude,
          });
          return;
        }
      }
    } catch {
      // Proceed to GPS fallback if profile fetch fails
    }

    // GPS fallback
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setPatientLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
            },
            () => {}
          );
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setPatientLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // 2. Fetch doctors list
  const fetchDoctorsList = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const queryParams = selectedSpecialization
        ? { specialization: selectedSpecialization }
        : undefined;
      const res = await getDoctors(queryParams);

      if (res && res.success) {
        setDoctors(res.data || []);
      } else {
        setErrorMsg('Failed to load specialists.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve specialists list.');
    } finally {
      setLoading(false);
    }
  }, [selectedSpecialization]);

  useEffect(() => {
    fetchLocationAndPreferences();
  }, [fetchLocationAndPreferences]);

  useEffect(() => {
    fetchDoctorsList();
  }, [fetchDoctorsList]);

  // Compute doctor distance via Haversine
  const processedDoctors = useMemo(() => {
    return doctors.map((doc) => {
      const hasCoords =
        typeof doc.latitude === 'number' &&
        typeof doc.longitude === 'number' &&
        !isNaN(doc.latitude) &&
        !isNaN(doc.longitude);

      const distanceKm =
        hasCoords && patientLocation
          ? calculateHaversineDistance(
              patientLocation.latitude,
              patientLocation.longitude,
              doc.latitude!,
              doc.longitude!
            )
          : undefined;

      return { doc, distanceKm };
    });
  }, [doctors, patientLocation]);

  // Filter and sort doctors by selected radius
  const filteredDoctors = useMemo(() => {
    if (selectedRadius === null || !patientLocation) {
      return processedDoctors;
    }

    return processedDoctors
      .filter((item) => item.distanceKm !== undefined && item.distanceKm <= selectedRadius)
      .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
  }, [processedDoctors, selectedRadius, patientLocation]);

  const handleSelectDoctor = (doctor: DoctorProfile) => {
    router.push({
      pathname: '/(patient)/doctor-details' as any,
      params: { id: doctor._id },
    });
  };

  const handleViewAllDoctors = () => {
    setSelectedSpecialization(undefined);
  };

  if (loading) {
    return <LoadingView message="Finding specialists..." />;
  }

  const selectedSpecKey = selectedSpecialization
    ? getSpecializationTranslationKey(selectedSpecialization)
    : undefined;
  const selectedSpecLocalized =
    selectedSpecKey && typeof selectedSpecKey === 'string' && selectedSpecKey in t
      ? t(selectedSpecKey as any)
      : selectedSpecialization;

  const initialSpecKey = initialSpecialization
    ? getSpecializationTranslationKey(initialSpecialization)
    : undefined;
  const initialSpecLocalized =
    initialSpecKey && typeof initialSpecKey === 'string' && initialSpecKey in t
      ? t(initialSpecKey as any)
      : initialSpecialization;

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('specialists')}
        subtitle={t('medicalProfessionals')}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {/* Recommendation Context Banner */}
        {selectedSpecialization ? (
          <View
            style={[
              styles.recommendationBanner,
              { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
            ]}
          >
            <Text style={styles.sparkleIcon}>✨</Text>
            <View style={styles.bannerTextCol}>
              <Text style={[styles.bannerTitle, { color: themeColors.primaryDark }]}>
                {t('recommendedSpecialization')}
              </Text>
              <Text style={[styles.bannerSub, { color: themeColors.primary }]}>
                {t('filteredFor')}{' '}
                <Text style={[styles.bannerHighlight, { color: themeColors.primaryDark }]}>
                  {selectedSpecLocalized}
                </Text>{' '}
                {t('basedOnAiAnalysis')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.clearFilterBtn, { backgroundColor: themeColors.card }]}
              onPress={handleViewAllDoctors}
            >
              <Text style={[styles.clearFilterText, { color: themeColors.primary }]}>
                {t('showAll')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Location & Radius Filter Card */}
        <View
          style={[
            styles.radiusCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.radiusHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nearbyHeading, { color: themeColors.textPrimary }]}>
                📍 {t('nearbyDoctors')}
              </Text>
              <Text style={[styles.locationSubText, { color: themeColors.textSecondary }]}>
                {patientLocation
                  ? `${t('currentLocation')}: ${patientLocation.latitude.toFixed(3)}, ${patientLocation.longitude.toFixed(3)}`
                  : 'Location: Sri Lanka (Colombo Central)'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.mapHeaderChip, { backgroundColor: themeColors.primary }]}
              onPress={() =>
                router.push({
                  pathname: '/(patient)/specialists-map' as any,
                  params: selectedSpecialization ? { specialization: selectedSpecialization } : undefined,
                })
              }
            >
              <Text style={styles.mapHeaderChipText}>🗺️ {t('viewOnMap')}</Text>
            </TouchableOpacity>
          </View>

          {/* Radius Selector Options */}
          <View style={styles.radiusChipsRow}>
            <Text style={[styles.radiusLabel, { color: themeColors.textMuted }]}>
              {t('searchRadius')}:
            </Text>
            {RADIUS_OPTIONS.map((rad) => {
              const isSelected = selectedRadius === rad;
              return (
                <TouchableOpacity
                  key={rad}
                  style={[
                    styles.radiusChip,
                    {
                      backgroundColor: themeColors.surfaceSecondary,
                      borderColor: themeColors.border,
                    },
                    isSelected && {
                      backgroundColor: themeColors.primary,
                      borderColor: themeColors.primary,
                    },
                  ]}
                  onPress={() => setSelectedRadius(rad)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.radiusChipText,
                      { color: themeColors.textSecondary },
                      isSelected && styles.radiusChipTextActive,
                    ]}
                  >
                    {rad} km
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.radiusChip,
                {
                  backgroundColor: themeColors.surfaceSecondary,
                  borderColor: themeColors.border,
                },
                selectedRadius === null && {
                  backgroundColor: themeColors.primary,
                  borderColor: themeColors.primary,
                },
              ]}
              onPress={() => setSelectedRadius(null)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.radiusChipText,
                  { color: themeColors.textSecondary },
                  selectedRadius === null && styles.radiusChipTextActive,
                ]}
              >
                {t('allDoctors')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Specialization Filter Chip Bar */}
        <View style={styles.filterChipBar}>
          {initialSpecialization ? (
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
                selectedSpecialization === initialSpecialization && {
                  backgroundColor: themeColors.primaryLight,
                  borderColor: themeColors.primary,
                },
              ]}
              onPress={() => setSelectedSpecialization(initialSpecialization)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: themeColors.textSecondary },
                  selectedSpecialization === initialSpecialization && { color: themeColors.primary },
                ]}
              >
                {t('recommended')}: {initialSpecLocalized}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
              !selectedSpecialization && {
                backgroundColor: themeColors.primaryLight,
                borderColor: themeColors.primary,
              },
            ]}
            onPress={handleViewAllDoctors}
          >
            <Text
              style={[
                styles.chipText,
                { color: themeColors.textSecondary },
                !selectedSpecialization && { color: themeColors.primary },
              ]}
            >
              {t('allDoctors')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.resultsCountText, { color: themeColors.textMuted }]}>
            {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Doctor' : 'Doctors'}
            {selectedRadius ? ` <= ${selectedRadius} km` : ''}
          </Text>
        </View>

        {/* Error State */}
        {errorMsg ? <ErrorView message={errorMsg} onRetry={fetchDoctorsList} /> : null}

        {/* List or Empty State */}
        {!errorMsg && (
          <FlatList
            data={filteredDoctors}
            keyExtractor={(item) => item.doc._id}
            renderItem={({ item }) => (
              <DoctorCard
                doctor={item.doc}
                distanceKm={item.distanceKm}
                onPress={() => handleSelectDoctor(item.doc)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="🩺"
                title={
                  selectedRadius
                    ? `No doctors within ${selectedRadius} km`
                    : t('noMatchingSpecialists')
                }
                description={
                  selectedRadius
                    ? `There are no active doctors located within ${selectedRadius} km of your position. Try selecting a 25 km or 50 km radius.`
                    : selectedSpecialization
                    ? t('noDoctorsForSpec')
                    : t('noRegisteredDoctors')
                }
                actionText={selectedRadius ? 'Expand to 50 km' : undefined}
                onAction={selectedRadius ? () => setSelectedRadius(50) : undefined}
              />
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  sparkleIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  bannerSub: {
    ...typography.caption,
  },
  bannerHighlight: {
    fontWeight: '800',
  },
  clearFilterBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.xs,
  },
  clearFilterText: {
    ...typography.caption,
    fontWeight: '600',
  },
  radiusCard: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  nearbyHeading: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  locationSubText: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 1,
  },
  mapHeaderChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  mapHeaderChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  radiusChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  radiusLabel: {
    ...typography.caption,
    fontWeight: '700',
    marginRight: 2,
  },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  radiusChipText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  radiusChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterChipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  resultsCountText: {
    ...typography.caption,
    marginLeft: 'auto',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
