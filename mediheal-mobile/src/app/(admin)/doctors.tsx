import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { AdminDoctorCard } from '../../components/AdminDoctorCard';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import {
  getAdminDoctors,
  updateDoctorStatus,
} from '../../services/adminService';
import { AdminDoctor } from '../../types/admin';

const STATUS_FILTERS = [
  { label: 'All Doctors', value: 'all' },
  { label: 'Active Only', value: 'active' },
  { label: 'Inactive Only', value: 'inactive' },
];

export default function AdminDoctorsScreen() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchDoctors = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getAdminDoctors({ search: searchQuery.trim() || undefined });
      if (res && res.success) {
        setDoctors(res.data || []);
      } else {
        setErrorMsg(res.message || 'Failed to load doctors directory.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve doctor accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchDoctors(true);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDoctors(true);
  };

  const handleEditDoctor = (doc: AdminDoctor) => {
    router.push({
      pathname: '/(admin)/doctor-edit' as any,
      params: { id: doc._id },
    });
  };

  const handleToggleStatus = (doc: AdminDoctor) => {
    const isUserActive = doc.userId?.isActive !== false;
    const actionText = isUserActive ? 'Deactivate' : 'Reactivate';
    const doctorName = doc.userId?.fullName || 'this doctor';

    Alert.alert(
      `${actionText} Doctor Account`,
      isUserActive
        ? `Deactivate ${doctorName}? Patients will no longer be able to book new appointments while the account is inactive.`
        : `Reactivate ${doctorName}? This will allow patients to view and book appointments again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isUserActive ? 'destructive' : 'default',
          onPress: () => performToggleStatus(doc._id, !isUserActive),
        },
      ]
    );
  };

  const performToggleStatus = async (doctorId: string, newActiveState: boolean) => {
    try {
      const res = await updateDoctorStatus(doctorId, { isActive: newActiveState });
      if (res && res.success) {
        Alert.alert(
          'Status Updated',
          `Doctor account has been ${newActiveState ? 'reactivated' : 'deactivated'} successfully.`
        );
        fetchDoctors(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to update doctor status.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update doctor status.');
    }
  };

  if (loading && doctors.length === 0) {
    return <LoadingView message="Loading doctor directory..." />;
  }

  // Client-side filtering by status & search
  const filteredDoctors = doctors.filter((doc) => {
    const isUserActive = doc.userId?.isActive !== false;
    if (statusFilter === 'active' && !isUserActive) return false;
    if (statusFilter === 'inactive' && isUserActive) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = doc.userId?.fullName?.toLowerCase() || '';
      const spec = doc.specialization?.toLowerCase() || '';
      const hosp = doc.hospital?.toLowerCase() || '';
      const slmc = doc.slmcNumber?.toLowerCase() || '';
      return name.includes(q) || spec.includes(q) || hosp.includes(q) || slmc.includes(q);
    }

    return true;
  });

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <AppHeader
        title="Specialist Management"
        subtitle="Doctor Accounts & Profiles"
        onBackPress={() => router.back()}
        rightComponent={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => router.push('/(admin)/doctor-add' as any)}
          >
            <Text style={styles.headerAddText}>+ Add Doctor</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Search Input Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, specialization, or SLMC number..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearchIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {STATUS_FILTERS.map((tab) => {
              const isSelected = statusFilter === tab.value;
              return (
                <TouchableOpacity
                  key={tab.value}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                  onPress={() => setStatusFilter(tab.value)}
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
          <ErrorView message={errorMsg} onRetry={() => fetchDoctors(true)} />
        ) : null}

        {!errorMsg && filteredDoctors.length === 0 && (
          <EmptyState
            icon="🩺"
            title="No Doctors Found"
            description="No doctor accounts match your search or filter criteria."
            actionText="Add New Doctor"
            onAction={() => router.push('/(admin)/doctor-add' as any)}
          />
        )}

        {!errorMsg && filteredDoctors.length > 0 && (
          <FlatList
            data={filteredDoctors}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <AdminDoctorCard
                doctor={item}
                onEdit={handleEditDoctor}
                onToggleStatus={handleToggleStatus}
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
  headerAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  headerAddText: {
    ...typography.caption,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  clearSearchIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textMuted,
    paddingLeft: spacing.xs,
  },
  filterWrap: {
    marginVertical: spacing.xs,
  },
  filterScroll: {
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
