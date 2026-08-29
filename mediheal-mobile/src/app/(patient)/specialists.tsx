import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { DoctorCard } from '../../components/DoctorCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { getDoctors } from '../../services/doctorService';
import { DoctorProfile } from '../../types/doctor';
import { useLanguage } from '../../context/LanguageContext';
import { getSpecializationTranslationKey } from '../../utils/displayMappers';
import { useTheme } from '../../context/ThemeContext';

export default function SpecialistListScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();
  const { specialization: initialSpecialization } = useLocalSearchParams<{
    specialization?: string;
  }>();

  const [selectedSpecialization, setSelectedSpecialization] = useState<string | undefined>(
    initialSpecialization
  );
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDoctorsList = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // CANONICAL BACKEND PARAMETER PRESERVED IN ENGLISH
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
    fetchDoctorsList();
  }, [fetchDoctorsList]);

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

  const selectedSpecKey = selectedSpecialization ? getSpecializationTranslationKey(selectedSpecialization) : undefined;
  const selectedSpecLocalized = selectedSpecKey && typeof selectedSpecKey === 'string' && selectedSpecKey in t
    ? t(selectedSpecKey as any)
    : selectedSpecialization;

  const initialSpecKey = initialSpecialization ? getSpecializationTranslationKey(initialSpecialization) : undefined;
  const initialSpecLocalized = initialSpecKey && typeof initialSpecKey === 'string' && initialSpecKey in t
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
          <View style={[styles.recommendationBanner, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]}>
            <Text style={styles.sparkleIcon}>✨</Text>
            <View style={styles.bannerTextCol}>
              <Text style={[styles.bannerTitle, { color: themeColors.primaryDark }]}>{t('recommendedSpecialization')}</Text>
              <Text style={[styles.bannerSub, { color: themeColors.primary }]}>
                {t('filteredFor')} <Text style={[styles.bannerHighlight, { color: themeColors.primaryDark }]}>{selectedSpecLocalized}</Text> {t('basedOnAiAnalysis')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.clearFilterBtn, { backgroundColor: themeColors.card }]}
              onPress={handleViewAllDoctors}
            >
              <Text style={[styles.clearFilterText, { color: themeColors.primary }]}>{t('showAll')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.contextBanner, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.contextText, { color: themeColors.textSecondary }]}>
              {t('showingAllSpecialists')}
            </Text>
          </View>
        )}

        {/* Filter Chip Bar */}
        <View style={styles.filterChipBar}>
          {initialSpecialization ? (
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
                selectedSpecialization === initialSpecialization && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
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
              !selectedSpecialization && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
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

          <TouchableOpacity
            style={[styles.mapChip, { backgroundColor: themeColors.primary }]}
            onPress={() =>
              router.push({
                pathname: '/(patient)/doctor-map' as any,
                params: selectedSpecialization ? { specialization: selectedSpecialization } : undefined,
              })
            }
          >
            <Text style={styles.mapChipText}>🗺️ {t('viewOnMap')}</Text>
          </TouchableOpacity>
        </View>

        {/* Error State */}
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchDoctorsList} />
        ) : null}

        {/* List or Empty State */}
        {!errorMsg && (
          <FlatList
            data={doctors}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <DoctorCard
                doctor={item}
                onPress={() => handleSelectDoctor(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="🩺"
                title={t('noMatchingSpecialists')}
                description={
                  selectedSpecialization
                    ? t('noDoctorsForSpec')
                    : t('noRegisteredDoctors')
                }
                actionText={selectedSpecialization ? t('allDoctors') : undefined}
                onAction={selectedSpecialization ? handleViewAllDoctors : undefined}
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
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sparkleIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.bodyBold,
    color: colors.primaryDark,
    fontSize: 14,
  },
  bannerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bannerHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  clearFilterBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.xs,
  },
  clearFilterText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  contextBanner: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  contextText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterChipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeChipText: {
    color: colors.textWhite,
  },
  mapChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 'auto',
  },
  mapChipText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
