import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { getDoctors } from '../../services/doctorService';
import { DoctorProfile } from '../../types/doctor';

// Conditionally import MapView to prevent web bundling crashes
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const MapsModule = require('react-native-maps');
    MapView = MapsModule.default;
    Marker = MapsModule.Marker;
    PROVIDER_GOOGLE = MapsModule.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('react-native-maps not loaded natively:', e);
  }
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Compute straight-line distance in kilometers using the Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function DoctorMapScreen() {
  const router = useRouter();
  const { specialization: initialSpecialization } = useLocalSearchParams<{
    specialization?: string;
  }>();

  const [selectedSpecialization, setSelectedSpecialization] = useState<string | undefined>(
    initialSpecialization
  );
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Request Foreground Location Permission
  const requestLocationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setUserLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
              setLocationPermissionGranted(true);
            },
            () => {
              setLocationPermissionGranted(false);
            }
          );
        } else {
          setLocationPermissionGranted(false);
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } else {
        setLocationPermissionGranted(false);
      }
    } catch (err) {
      console.warn('Location request error:', err);
      setLocationPermissionGranted(false);
    }
  }, []);

  // 2. Fetch doctors list with optional specialization filter
  const fetchDoctors = useCallback(async () => {
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
        setErrorMsg('Failed to load doctors for map view.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve doctor locations.');
    } finally {
      setLoading(false);
    }
  }, [selectedSpecialization]);

  useEffect(() => {
    requestLocationPermission();
    fetchDoctors();
  }, [requestLocationPermission, fetchDoctors]);

  // Filter doctors with valid numeric latitude & longitude
  const mappedDoctors = useMemo(() => {
    return doctors.filter(
      (d) =>
        typeof d.latitude === 'number' &&
        typeof d.longitude === 'number' &&
        !isNaN(d.latitude) &&
        !isNaN(d.longitude) &&
        d.latitude >= -90 &&
        d.latitude <= 90 &&
        d.longitude >= -180 &&
        d.longitude <= 180
    );
  }, [doctors]);

  // Auto-select first mapped doctor when data loads if none selected
  useEffect(() => {
    if (mappedDoctors.length > 0 && !selectedDoctor) {
      setSelectedDoctor(mappedDoctors[0]);
    }
  }, [mappedDoctors, selectedDoctor]);

  // Initial Map Region
  const mapRegion = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }
    if (mappedDoctors.length > 0) {
      return {
        latitude: mappedDoctors[0].latitude!,
        longitude: mappedDoctors[0].longitude!,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }
    // Default fallback (Colombo, Sri Lanka)
    return {
      latitude: 6.9271,
      longitude: 79.8612,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
  }, [userLocation, mappedDoctors]);

  // Open external Google Maps for directions
  const handleGetDirections = (doc: DoctorProfile) => {
    if (typeof doc.latitude !== 'number' || typeof doc.longitude !== 'number') {
      Alert.alert('Directions Unavailable', 'This doctor does not have valid map coordinates.');
      return;
    }

    const destLat = doc.latitude;
    const destLng = doc.longitude;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

    Linking.canOpenURL(mapsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(mapsUrl);
        } else {
          Alert.alert(
            'Navigation Error',
            `Unable to open maps automatically. You can navigate directly to:\nLatitude: ${destLat}\nLongitude: ${destLng}`
          );
        }
      })
      .catch((err) => {
        console.warn('Linking error:', err);
        Linking.openURL(mapsUrl);
      });
  };

  const handleNavigateToDoctorDetails = (docId: string) => {
    router.push({
      pathname: '/(patient)/doctor-details' as any,
      params: { id: docId },
    });
  };

  if (loading) {
    return <LoadingView message="Loading doctor map locations..." />;
  }

  if (errorMsg) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader title="Doctor Map" onBackPress={() => router.back()} />
        <ErrorView message={errorMsg} onRetry={fetchDoctors} />
      </ScreenContainer>
    );
  }

  // Web Fallback Renderer
  if (Platform.OS === 'web' || !MapView) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <AppHeader
          title="Doctor Locations"
          subtitle="Hospital & Specialist Map View"
          onBackPress={() => router.back()}
        />

        <View style={styles.webFallbackContainer}>
          {/* Context Banner */}
          <View style={styles.webBanner}>
            <Text style={styles.webBannerIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.webBannerTitle}>Interactive Google Map</Text>
              <Text style={styles.webBannerSub}>
                Interactive map view is optimized for the MediHeal mobile app. You can view doctor locations and open directions below.
              </Text>
            </View>
          </View>

          {/* Location Permission Status Notice */}
          {locationPermissionGranted === false && (
            <View style={styles.permissionNotice}>
              <Text style={styles.permissionNoticeText}>
                💡 Location access is optional. You can still view doctor locations.
              </Text>
            </View>
          )}

          {/* Doctor List with Coordinates */}
          {mappedDoctors.length > 0 ? (
            <FlatList
              data={mappedDoctors}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              renderItem={({ item }) => {
                const distance = userLocation
                  ? calculateHaversineDistance(
                      userLocation.latitude,
                      userLocation.longitude,
                      item.latitude!,
                      item.longitude!
                    )
                  : null;

                const docName = item.userId?.fullName || 'Specialist';
                const displayName = docName.toLowerCase().startsWith('dr.')
                  ? docName
                  : `Dr. ${docName}`;

                return (
                  <View style={styles.webDocCard}>
                    <View style={styles.webDocHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docCardName}>{displayName}</Text>
                        <Text style={styles.docCardSpec}>{item.specialization}</Text>
                        <Text style={styles.docCardHosp}>🏥 {item.hospital}</Text>
                        {item.location ? (
                          <Text style={styles.docCardLoc}>📍 {item.location}</Text>
                        ) : null}
                      </View>

                      {distance !== null && (
                        <View style={styles.distanceBadge}>
                          <Text style={styles.distanceText}>📍 Approx. {distance} km away</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.webActionRow}>
                      <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => handleNavigateToDoctorDetails(item._id)}
                      >
                        <Text style={styles.detailsBtnText}>View Doctor Details</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.directionsBtn}
                        onPress={() => handleGetDirections(item)}
                      >
                        <Text style={styles.directionsBtnText}>🧭 Get Directions</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <EmptyState
              icon="🗺️"
              title="No Mapped Doctors Available"
              description={
                selectedSpecialization
                  ? `No doctors for "${selectedSpecialization}" currently have map coordinates.`
                  : 'No doctor records currently have map coordinates.'
              }
              actionText="View Doctor List"
              onAction={() => router.push('/(patient)/specialists' as any)}
            />
          )}
        </View>
      </ScreenContainer>
    );
  }

  // Native Interactive Map Renderer
  const selectedDocDistance =
    selectedDoctor && userLocation && selectedDoctor.latitude && selectedDoctor.longitude
      ? calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          selectedDoctor.latitude,
          selectedDoctor.longitude
        )
      : null;

  return (
    <View style={styles.nativePageContainer}>
      <AppHeader
        title="Doctor Map"
        subtitle={selectedSpecialization ? `Filter: ${selectedSpecialization}` : 'Interactive Google Maps'}
        onBackPress={() => router.back()}
      />

      {/* Permission Info Toast Banner */}
      {locationPermissionGranted === false && (
        <View style={styles.permissionNotice}>
          <Text style={styles.permissionNoticeText}>
            💡 Location access is optional. You can still view doctor locations.
          </Text>
        </View>
      )}

      {/* Main Map View */}
      {mappedDoctors.length > 0 ? (
        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.fullMap}
            initialRegion={mapRegion}
            showsUserLocation={!!userLocation}
            showsMyLocationButton={true}
          >
            {/* Patient Current Location Marker fallback */}
            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="Your Location"
                description="Current Device Location"
                pinColor="#2563EB"
              />
            )}

            {/* Doctor Markers */}
            {mappedDoctors.map((doc) => {
              const docName = doc.userId?.fullName || 'Doctor';
              const displayName = docName.toLowerCase().startsWith('dr.')
                ? docName
                : `Dr. ${docName}`;

              const isSelected = selectedDoctor?._id === doc._id;

              return (
                <Marker
                  key={doc._id}
                  coordinate={{
                    latitude: doc.latitude!,
                    longitude: doc.longitude!,
                  }}
                  title={displayName}
                  description={`${doc.specialization} • ${doc.hospital}`}
                  pinColor={isSelected ? '#166534' : '#DC2626'}
                  onPress={() => setSelectedDoctor(doc)}
                />
              );
            })}
          </MapView>

          {/* Floating Selected Doctor Summary Card */}
          {selectedDoctor && (
            <View style={styles.floatingCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docCardName}>
                    {selectedDoctor.userId?.fullName?.startsWith('Dr.')
                      ? selectedDoctor.userId.fullName
                      : `Dr. ${selectedDoctor.userId?.fullName || 'Specialist'}`}
                  </Text>
                  <Text style={styles.docCardSpec}>{selectedDoctor.specialization}</Text>
                  <Text style={styles.docCardHosp}>🏥 {selectedDoctor.hospital}</Text>
                </View>

                {selectedDocDistance !== null && (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>📍 Approx. {selectedDocDistance} km away</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => handleNavigateToDoctorDetails(selectedDoctor._id)}
                >
                  <Text style={styles.detailsBtnText}>View Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.directionsBtn}
                  onPress={() => handleGetDirections(selectedDoctor)}
                >
                  <Text style={styles.directionsBtnText}>🧭 Get Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="🗺️"
            title="No Mapped Doctors Found"
            description={
              selectedSpecialization
                ? `No doctors for "${selectedSpecialization}" currently have GPS coordinates.`
                : 'No doctors currently have GPS coordinates available.'
            }
            actionText="View Specialist Directory"
            onAction={() => router.push('/(patient)/specialists' as any)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nativePageContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  fullMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  permissionNotice: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: '#FDE68A',
  },
  permissionNoticeText: {
    ...typography.caption,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  floatingCard: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  docCardName: {
    ...typography.subheader,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  docCardSpec: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 1,
  },
  docCardHosp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  docCardLoc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  distanceBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  distanceText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 11,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  detailsBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  directionsBtn: {
    flex: 1.2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionsBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  webFallbackContainer: {
    flex: 1,
    padding: spacing.md,
  },
  webBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: spacing.sm,
  },
  webBannerIcon: {
    fontSize: 24,
  },
  webBannerTitle: {
    ...typography.bodyBold,
    color: colors.primaryDark,
    fontSize: 15,
  },
  webBannerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  webDocCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  webDocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  webActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
