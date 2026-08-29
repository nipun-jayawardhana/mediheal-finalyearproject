import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { ConsultationCard } from '../../components/ConsultationCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing } from '../../constants/theme';
import { getMyConsultations } from '../../services/consultationService';
import { Consultation } from '../../types/consultation';

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

export default function PatientConsultationHistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors } = useTheme();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await getMyConsultations();
      if (res && res.success) {
        setConsultations(res.data || []);
      } else {
        setErrorMsg('Failed to load consultation history.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve consultation records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConsultations();
    }, [fetchConsultations])
  );

  const handleSelectConsultation = (consultation: Consultation) => {
    router.push({
      pathname: '/(patient)/consultation-summary' as any,
      params: { id: consultation._id },
    });
  };

  if (loading && consultations.length === 0) {
    return <LoadingView message="Loading your consultation history..." />;
  }

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('consultationsTitle')}
        subtitle={t('pastDoctorVisits')}
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={fetchConsultations} />
        ) : null}

        {!errorMsg && (
          <FlatList
            data={consultations}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <ConsultationCard
                consultation={item}
                onPress={() => handleSelectConsultation(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="🩺"
                title={t('noConsultations')}
                description={t('noConsultationsDesc')}
                actionText={t('viewMyBookings')}
                onAction={() => router.push('/(patient)/my-bookings' as any)}
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
  listContent: {
    paddingBottom: spacing.xl,
  },
});
