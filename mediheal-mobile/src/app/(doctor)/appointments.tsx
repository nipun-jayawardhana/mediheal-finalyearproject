import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { DoctorAppointmentCard } from '../../components/DoctorAppointmentCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import {
  getDoctorAppointments,
  updateAppointmentStatusByDoctor,
} from '../../services/doctorPortalService';
import { DoctorAppointment } from '../../types/doctorPortal';

const FILTER_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function DoctorAppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();

  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>(params.filter || 'all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchAppointments = useCallback(
    async (filterVal: string = selectedFilter, isRefresh: boolean = false) => {
      if (!isRefresh) setLoading(true);
      setErrorMsg('');

      try {
        const queryStatus = filterVal === 'all' ? undefined : filterVal;
        const res = await getDoctorAppointments(queryStatus);
        if (res && res.success) {
          setAppointments(res.data || []);
        } else {
          setErrorMsg(res.message || 'Failed to load assigned appointments.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Unable to retrieve appointments.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedFilter]
  );

  useFocusEffect(
    useCallback(() => {
      fetchAppointments(selectedFilter, true);
    }, [selectedFilter])
  );

  const handleFilterSelect = (filterVal: string) => {
    setSelectedFilter(filterVal);
    fetchAppointments(filterVal, false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAppointments(selectedFilter, true);
  };

  const handleConfirmAppointment = async (appt: DoctorAppointment) => {
    Alert.alert(
      'Confirm Appointment',
      'Confirm this appointment and mark it ready for consultation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            try {
              const res = await updateAppointmentStatusByDoctor(appt._id, 'confirmed');
              if (res && res.success) {
                Alert.alert('Confirmed', 'Appointment has been confirmed.');
                fetchAppointments(selectedFilter, true);
              } else {
                Alert.alert('Error', res.message || 'Failed to confirm appointment.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to confirm appointment.');
            }
          },
        },
      ]
    );
  };

  const handleStartConsultation = (appt: DoctorAppointment) => {
    router.push({
      pathname: '/(doctor)/active-consultation' as any,
      params: { appointmentId: appt._id },
    });
  };

  const handleViewHistory = (appt: DoctorAppointment) => {
    const patientId = typeof appt.patientId === 'object' ? appt.patientId._id : appt.patientId;
    router.push({
      pathname: '/(doctor)/patient-history' as any,
      params: { patientId },
    });
  };

  if (loading && appointments.length === 0) {
    return <LoadingView message="Loading assigned appointments..." />;
  }

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Assigned Appointments"
        subtitle="Doctor Consultation Schedule"
        onBackPress={() => router.back()}
      />

      <View style={styles.container}>
        {/* Filter Tabs */}
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            {FILTER_TABS.map((tab) => {
              const isSelected = selectedFilter === tab.value;
              return (
                <TouchableOpacity
                  key={tab.value}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                  onPress={() => handleFilterSelect(tab.value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Content */}
        {errorMsg ? (
          <ErrorView message={errorMsg} onRetry={() => fetchAppointments(selectedFilter, true)} />
        ) : null}

        {!errorMsg && appointments.length === 0 && (
          <EmptyState
            icon="📅"
            title="No Appointments Found"
            description="You currently have no assigned appointments under this filter."
          />
        )}

        {!errorMsg && appointments.length > 0 && (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <DoctorAppointmentCard
                appointment={item}
                onConfirm={handleConfirmAppointment}
                onStartConsultation={handleStartConsultation}
                onViewHistory={handleViewHistory}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
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
  tabsWrap: {
    marginVertical: spacing.xs,
  },
  tabsScroll: {
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  filterChip: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
});
