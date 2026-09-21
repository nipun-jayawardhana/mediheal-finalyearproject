import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  ScrollView,
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
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { getSpecializationTranslationKey } from '../../utils/displayMappers';

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

const COMMON_SPECIALIZATIONS = [
  'All Doctors',
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pediatrician',
  'ENT Specialist',
  'Neurologist',
  'Orthopedic Specialist',
];

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#60a5fa' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#090d16' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
];

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

export default function SpecialistMapScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: themeColors, isDark } = useTheme();
  const mapRef = useRef<any>(null);

  const params = useLocalSearchParams<{
    specialization?: string;
    doctorId?: string;
  }>();

  const [selectedSpecialization, setSelectedSpecialization] = useState<string | undefined>(
    params.specialization
  );
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
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
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (err) {
      console.warn('Location request error:', err);
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
        setErrorMsg(res.message || 'Failed to load specialists for map view.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to retrieve specialist locations.');
    } finally {
      setLoading(false);
    }
  }, [selectedSpecialization]);

  useEffect(() => {
    requestLocationPermission();
  }, [requestLocationPermission]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

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
        d.longitude <= 180 &&
        !(d.latitude === 0 && d.longitude === 0)
    );
  }, [doctors]);

  // Set selected doctor if doctorId param was explicitly provided
  useEffect(() => {
    if (params.doctorId && mappedDoctors.length > 0) {
      const targetDoc = mappedDoctors.find((d) => d._id === params.doctorId);
      if (targetDoc) {
        setSelectedDoctor(targetDoc);
      }
    }
  }, [mappedDoctors, params.doctorId]);

  // Listen for Web postMessage from Leaflet map marker clicks
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'SELECT_DOCTOR' && event.data.doctorId) {
          const doc = mappedDoctors.find((d) => d._id === event.data.doctorId);
          if (doc) {
            setSelectedDoctor(doc);
          }
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [mappedDoctors]);

  // Helper to format doctor name cleanly
  const getDoctorDisplayName = useCallback((doc: DoctorProfile): string => {
    const raw = doc.userId?.fullName || 'Specialist';
    return raw.toLowerCase().startsWith('dr.') ? raw : `Dr. ${raw}`;
  }, []);

  // Compute Initial Region covering ALL doctor coordinates
  const initialRegion = useMemo(() => {
    if (mappedDoctors.length === 0) {
      return {
        latitude: userLocation?.latitude || 6.9271,
        longitude: userLocation?.longitude || 79.8612,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    if (mappedDoctors.length === 1) {
      return {
        latitude: mappedDoctors[0].latitude!,
        longitude: mappedDoctors[0].longitude!,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }

    const lats = mappedDoctors.map((d) => d.latitude!);
    const lngs = mappedDoctors.map((d) => d.longitude!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.05);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.05);

    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [mappedDoctors, userLocation]);

  // Fit to coordinates on native map
  const fitMapToMarkers = useCallback(() => {
    if (!mapRef.current || mappedDoctors.length === 0 || Platform.OS === 'web') return;

    if (mappedDoctors.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: mappedDoctors[0].latitude!,
          longitude: mappedDoctors[0].longitude!,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        500
      );
    } else {
      const coords = mappedDoctors.map((d) => ({
        latitude: d.latitude!,
        longitude: d.longitude!,
      }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, bottom: 80, left: 50, right: 50 },
        animated: true,
      });
    }
  }, [mappedDoctors]);

  // Automatically fit all markers whenever mappedDoctors updates
  useEffect(() => {
    if (mappedDoctors.length > 0 && Platform.OS !== 'web') {
      const timer = setTimeout(() => {
        fitMapToMarkers();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [mappedDoctors, fitMapToMarkers]);

  const handleSelectDoctor = (doc: DoctorProfile) => {
    setSelectedDoctor(doc);
  };

  // Open external Google Maps for directions
  const handleGetDirections = (doc: DoctorProfile) => {
    if (typeof doc.latitude !== 'number' || typeof doc.longitude !== 'number') {
      Alert.alert('Directions Unavailable', 'This specialist does not have valid map coordinates.');
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
            'Navigation',
            `Navigate directly to:\nLatitude: ${destLat}\nLongitude: ${destLng}`
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

  // Generate Web Leaflet HTML containing ALL doctor markers
  const webMapHtml = useMemo(() => {
    if (mappedDoctors.length === 0) return '';

    const doctorJson = JSON.stringify(
      mappedDoctors.map((d) => ({
        id: d._id,
        name: getDoctorDisplayName(d),
        lat: d.latitude,
        lng: d.longitude,
        specialty: d.specialization,
        hospital: d.hospital,
        location: d.location || '',
        fee: d.consultationFee,
        available: d.availableDays && d.availableDays.length > 0 ? d.availableDays.join(', ') : '',
        isSelected: selectedDoctor?._id === d._id,
      }))
    );

    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const cardBg = isDark ? '#1E293B' : '#FFFFFF';
    const textColor = isDark ? '#F8FAFC' : '#1E293B';
    const subColor = isDark ? '#94A3B8' : '#64748B';
    const primaryColor = isDark ? '#3B82F6' : '#1060C8';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: ${isDark ? '#0F172A' : '#F4F7FC'}; font-family: system-ui, -apple-system, sans-serif; }
    .pin-badge {
      display: inline-flex;
      align-items: center;
      background: ${cardBg};
      color: ${textColor};
      border: 1.5px solid ${isDark ? '#334155' : '#CBD5E1'};
      border-radius: 9999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }
    .pin-badge:hover {
      transform: scale(1.06);
      border-color: ${primaryColor};
    }
    .pin-badge.selected {
      background: ${primaryColor};
      color: #ffffff;
      border-color: #ffffff;
      box-shadow: 0 4px 16px rgba(16,96,200,0.45);
    }
    .leaflet-popup-content-wrapper {
      background: ${cardBg};
      color: ${textColor};
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      padding: 4px;
    }
    .leaflet-popup-tip {
      background: ${cardBg};
    }
    .popup-title { font-size: 14px; font-weight: 800; color: ${textColor}; margin-bottom: 2px; }
    .popup-spec { font-size: 12px; font-weight: 700; color: ${primaryColor}; margin-bottom: 4px; }
    .popup-hosp { font-size: 11px; color: ${subColor}; margin-bottom: 2px; }
    .popup-fee { font-size: 12px; font-weight: 700; color: ${primaryColor}; margin-top: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true });
    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var doctors = ${doctorJson};
    var markers = [];

    doctors.forEach(function(doc) {
      var icon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: '<div class="pin-badge ' + (doc.isSelected ? 'selected' : '') + '">📍 ' + doc.name + '</div>',
        iconAnchor: [50, 15]
      });

      var marker = L.marker([doc.lat, doc.lng], { icon: icon }).addTo(map);
      
      var popupContent = '<div class="popup-title">📍 ' + doc.name + '</div>' +
        '<div class="popup-spec">' + doc.specialty + '</div>' +
        '<div class="popup-hosp">🏥 ' + doc.hospital + '</div>' +
        (doc.location ? '<div class="popup-hosp">📍 ' + doc.location + '</div>' : '') +
        (doc.fee ? '<div class="popup-fee">Fee: LKR ' + Number(doc.fee).toLocaleString() + '</div>' : '') +
        (doc.available ? '<div class="popup-hosp" style="margin-top:2px;">Available: ' + doc.available + '</div>' : '');

      marker.bindPopup(popupContent);

      marker.on('click', function() {
        if (window.parent) {
          window.parent.postMessage({ type: 'SELECT_DOCTOR', doctorId: doc.id }, '*');
        }
      });

      markers.push(marker);
    });

    if (markers.length > 0) {
      var group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.18));
    }
  </script>
</body>
</html>`;
  }, [mappedDoctors, selectedDoctor, isDark, getDoctorDisplayName]);

  if (loading && doctors.length === 0) {
    return <LoadingView message="Loading specialist map locations..." />;
  }

  if (errorMsg) {
    return (
      <ScreenContainer backgroundColor={themeColors.background}>
        <AppHeader title={t('viewOnMap')} onBackPress={() => router.back()} />
        <ErrorView message={errorMsg} onRetry={fetchDoctors} />
      </ScreenContainer>
    );
  }

  // Filter Chip Bar Component
  const renderFilterChips = () => (
    <View style={[styles.filterBarContainer, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBarScroll}
      >
        {COMMON_SPECIALIZATIONS.map((spec) => {
          const isAll = spec === 'All Doctors';
          const isSelected = isAll ? !selectedSpecialization : selectedSpecialization === spec;

          const specKey = !isAll ? getSpecializationTranslationKey(spec) : undefined;
          const label = isAll
            ? t('allDoctors')
            : specKey && typeof specKey === 'string' && specKey in t
            ? t(specKey as any)
            : spec;

          return (
            <TouchableOpacity
              key={spec}
              style={[
                styles.specChip,
                { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
                isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
              ]}
              onPress={() => setSelectedSpecialization(isAll ? undefined : spec)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.specChipText,
                  { color: themeColors.textSecondary },
                  isSelected && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // Distance calculation for currently selected doctor
  const selectedDocDistance =
    selectedDoctor && userLocation && selectedDoctor.latitude && selectedDoctor.longitude
      ? calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          selectedDoctor.latitude,
          selectedDoctor.longitude
        )
      : null;

  // Web / Responsive Fallback View
  if (Platform.OS === 'web' || !MapView) {
    return (
      <ScreenContainer backgroundColor={themeColors.background}>
        <AppHeader
          title={t('viewOnMap')}
          subtitle={
            selectedSpecialization
              ? `${selectedSpecialization} • ${mappedDoctors.length} Specialists with GPS`
              : `${mappedDoctors.length} Specialists with GPS`
          }
          onBackPress={() => router.back()}
        />

        {renderFilterChips()}

        <ScrollView contentContainerStyle={styles.webContainer} showsVerticalScrollIndicator={false}>
          {/* Web Interactive Map Displaying ALL Doctor Pins */}
          {mappedDoctors.length > 0 ? (
            <View style={[styles.webMapFrame, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <View style={[styles.webMapHeader, { backgroundColor: themeColors.surfaceSecondary, borderBottomColor: themeColors.border }]}>
                <Text style={[styles.webMapHeaderTitle, { color: themeColors.textPrimary }]}>
                  🗺️ Showing All {mappedDoctors.length} Specialists on Map
                </Text>
                {selectedDoctor && (
                  <TouchableOpacity
                    style={[styles.webDirectionsHeaderBtn, { backgroundColor: themeColors.primary }]}
                    onPress={() => handleGetDirections(selectedDoctor)}
                  >
                    <Text style={styles.webDirectionsHeaderBtnText}>Open Directions ↗</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Embedded interactive Leaflet view with ALL pins */}
              <iframe
                title="Specialist Map"
                width="100%"
                height="340"
                style={{ border: 0 }}
                srcDoc={webMapHtml}
              />
            </View>
          ) : null}

          {/* Selected Doctor Info Card (if selected) */}
          {selectedDoctor && (
            <View
              style={[
                styles.webSelectedCard,
                { backgroundColor: themeColors.card, borderColor: themeColors.primary },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docCardName, { color: themeColors.textPrimary }]}>
                    📍 {getDoctorDisplayName(selectedDoctor)}
                  </Text>
                  <Text style={[styles.docCardSpec, { color: themeColors.primary }]}>
                    {selectedDoctor.specialization}
                  </Text>
                  <Text style={[styles.docCardHosp, { color: themeColors.textSecondary }]}>
                    🏥 {selectedDoctor.hospital}
                  </Text>
                  {selectedDoctor.location ? (
                    <Text style={[styles.docCardLoc, { color: themeColors.textMuted }]}>
                      📍 {selectedDoctor.location}
                    </Text>
                  ) : null}

                  {/* Availability */}
                  {selectedDoctor.availableDays && selectedDoctor.availableDays.length > 0 ? (
                    <Text style={[styles.docCardAvail, { color: themeColors.textSecondary }]}>
                      <Text style={{ fontWeight: '700' }}>Available: </Text>
                      {selectedDoctor.availableDays.join(', ')}
                    </Text>
                  ) : null}

                  {/* Consultation Fee */}
                  {selectedDoctor.consultationFee !== undefined && selectedDoctor.consultationFee !== null ? (
                    <Text style={[styles.docCardFee, { color: themeColors.primary }]}>
                      <Text style={{ fontWeight: '700' }}>Fee: </Text>
                      LKR {Number(selectedDoctor.consultationFee).toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.closeCardBtn, { backgroundColor: themeColors.surfaceSecondary }]}
                  onPress={() => setSelectedDoctor(null)}
                >
                  <Text style={[styles.closeCardBtnText, { color: themeColors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.cardActionRow, { borderTopColor: themeColors.border }]}>
                <TouchableOpacity
                  style={[styles.detailsBtn, { borderColor: themeColors.primary, backgroundColor: themeColors.card }]}
                  onPress={() => handleNavigateToDoctorDetails(selectedDoctor._id)}
                >
                  <Text style={[styles.detailsBtnText, { color: themeColors.primary }]}>
                    View Profile
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.directionsBtn, { backgroundColor: themeColors.primary }]}
                  onPress={() => handleGetDirections(selectedDoctor)}
                >
                  <Text style={styles.directionsBtnText}>🧭 Get Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Doctor Cards Directory */}
          {mappedDoctors.length > 0 ? (
            <View style={styles.webDoctorList}>
              <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
                Specialists Directory ({mappedDoctors.length} Pins)
              </Text>

              {mappedDoctors.map((doc) => {
                const isSelected = selectedDoctor?._id === doc._id;
                const dist = userLocation
                  ? calculateHaversineDistance(
                      userLocation.latitude,
                      userLocation.longitude,
                      doc.latitude!,
                      doc.longitude!
                    )
                  : null;

                const displayName = getDoctorDisplayName(doc);

                return (
                  <TouchableOpacity
                    key={doc._id}
                    style={[
                      styles.webDocCard,
                      { backgroundColor: themeColors.card, borderColor: themeColors.border },
                      isSelected && { borderColor: themeColors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedDoctor(doc)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docCardName, { color: themeColors.textPrimary }]}>
                          📍 {displayName}
                        </Text>
                        <Text style={[styles.docCardSpec, { color: themeColors.primary }]}>
                          {doc.specialization}
                        </Text>
                        <Text style={[styles.docCardHosp, { color: themeColors.textSecondary }]}>
                          🏥 {doc.hospital}
                        </Text>
                        {doc.location ? (
                          <Text style={[styles.docCardLoc, { color: themeColors.textMuted }]}>
                            📍 {doc.location}
                          </Text>
                        ) : null}

                        {/* Availability */}
                        {doc.availableDays && doc.availableDays.length > 0 ? (
                          <Text style={[styles.docCardAvail, { color: themeColors.textSecondary }]}>
                            <Text style={{ fontWeight: '700' }}>Available: </Text>
                            {doc.availableDays.join(', ')}
                          </Text>
                        ) : null}

                        {/* Consultation Fee */}
                        {doc.consultationFee !== undefined && doc.consultationFee !== null ? (
                          <Text style={[styles.docCardFee, { color: themeColors.primary }]}>
                            <Text style={{ fontWeight: '700' }}>Fee: </Text>
                            LKR {Number(doc.consultationFee).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>

                      {dist !== null && (
                        <View style={[styles.distanceBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
                          <Text style={[styles.distanceText, { color: themeColors.primary }]}>
                            Approx. {dist} km
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={[styles.cardActionRow, { borderTopColor: themeColors.border }]}>
                      <TouchableOpacity
                        style={[styles.detailsBtn, { borderColor: themeColors.primary }]}
                        onPress={() => handleNavigateToDoctorDetails(doc._id)}
                      >
                        <Text style={[styles.detailsBtnText, { color: themeColors.primary }]}>
                          View Profile
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.directionsBtn, { backgroundColor: themeColors.primary }]}
                        onPress={() => handleGetDirections(doc)}
                      >
                        <Text style={styles.directionsBtnText}>🧭 Get Directions</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="🗺️"
              title="No doctor locations available"
              description={
                selectedSpecialization
                  ? `No specialists for "${selectedSpecialization}" currently have map coordinates.`
                  : 'No specialists currently have GPS map coordinates available.'
              }
              actionText="View All Specialists"
              onAction={() => setSelectedSpecialization(undefined)}
            />
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Native Interactive Map Renderer
  return (
    <View style={[styles.nativePageContainer, { backgroundColor: themeColors.background }]}>
      <AppHeader
        title={t('viewOnMap')}
        subtitle={
          selectedSpecialization
            ? `${selectedSpecialization} (${mappedDoctors.length} Pins)`
            : `${mappedDoctors.length} Specialists on Map`
        }
        onBackPress={() => router.back()}
      />

      {renderFilterChips()}

      {mappedDoctors.length > 0 ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.fullMap}
            initialRegion={initialRegion}
            onMapReady={fitMapToMarkers}
            customMapStyle={isDark ? DARK_MAP_STYLE : []}
            showsUserLocation={!!userLocation}
            showsMyLocationButton={true}
          >
            {/* User Location Marker */}
            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="Your Location"
                description="Current Device Location"
                pinColor="#2563EB"
              />
            )}

            {/* Loop through ALL mapped doctors to render markers */}
            {mappedDoctors.map((doc) => {
              const displayName = getDoctorDisplayName(doc);
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
                  pinColor={isSelected ? '#10B981' : '#DC2626'}
                  onPress={() => handleSelectDoctor(doc)}
                >
                  <View
                    style={[
                      styles.customPinContainer,
                      {
                        backgroundColor: isSelected ? themeColors.primary : themeColors.card,
                        borderColor: isSelected ? '#FFFFFF' : themeColors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.customPinText,
                        { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      📍 {displayName}
                    </Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>

          {/* Floating Action to Re-Center Map to ALL Markers */}
          <TouchableOpacity
            style={[styles.recenterBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={fitMapToMarkers}
            activeOpacity={0.8}
            accessibilityLabel="Fit all doctors"
          >
            <Text style={[styles.recenterText, { color: themeColors.textPrimary }]}>🎯 Fit All</Text>
          </TouchableOpacity>

          {/* Floating Selected Doctor Information Card */}
          {selectedDoctor && (
            <View
              style={[
                styles.floatingCard,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docCardName, { color: themeColors.textPrimary }]}>
                    {getDoctorDisplayName(selectedDoctor)}
                  </Text>
                  <Text style={[styles.docCardSpec, { color: themeColors.primary }]}>
                    {selectedDoctor.specialization}
                  </Text>
                  <Text style={[styles.docCardHosp, { color: themeColors.textSecondary }]}>
                    🏥 {selectedDoctor.hospital}
                  </Text>
                  {selectedDoctor.location ? (
                    <Text style={[styles.docCardLoc, { color: themeColors.textMuted }]}>
                      📍 {selectedDoctor.location}
                    </Text>
                  ) : null}

                  {/* Availability */}
                  {selectedDoctor.availableDays && selectedDoctor.availableDays.length > 0 ? (
                    <Text style={[styles.docCardAvail, { color: themeColors.textSecondary }]}>
                      <Text style={{ fontWeight: '700' }}>Available: </Text>
                      {selectedDoctor.availableDays.join(', ')}
                    </Text>
                  ) : null}

                  {/* Consultation Fee */}
                  {selectedDoctor.consultationFee !== undefined && selectedDoctor.consultationFee !== null ? (
                    <Text style={[styles.docCardFee, { color: themeColors.primary }]}>
                      <Text style={{ fontWeight: '700' }}>Fee: </Text>
                      LKR {Number(selectedDoctor.consultationFee).toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.closeCardBtn, { backgroundColor: themeColors.surfaceSecondary }]}
                  onPress={() => setSelectedDoctor(null)}
                >
                  <Text style={[styles.closeCardBtnText, { color: themeColors.textMuted }]}>✕</Text>
                </TouchableOpacity>

                {selectedDocDistance !== null && (
                  <View style={[styles.distanceBadge, { backgroundColor: themeColors.surfaceSecondary }]}>
                    <Text style={[styles.distanceText, { color: themeColors.primary }]}>
                      Approx. {selectedDocDistance} km
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.cardActionRow, { borderTopColor: themeColors.border }]}>
                <TouchableOpacity
                  style={[styles.detailsBtn, { borderColor: themeColors.primary, backgroundColor: themeColors.card }]}
                  onPress={() => handleNavigateToDoctorDetails(selectedDoctor._id)}
                >
                  <Text style={[styles.detailsBtnText, { color: themeColors.primary }]}>
                    View Profile
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.directionsBtn, { backgroundColor: themeColors.primary }]}
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
            title="No doctor locations available"
            description={
              selectedSpecialization
                ? `No specialists for "${selectedSpecialization}" currently have map coordinates.`
                : 'No specialists currently have GPS map coordinates available.'
            }
            actionText="View All Specialists"
            onAction={() => setSelectedSpecialization(undefined)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nativePageContainer: {
    flex: 1,
  },
  filterBarContainer: {
    borderBottomWidth: 1,
    paddingVertical: spacing.xs,
  },
  filterBarScroll: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  specChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  specChipText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
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
  recenterBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    ...shadows.card,
    zIndex: 10,
  },
  recenterText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 12,
  },
  customPinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1.5,
    ...shadows.card,
  },
  customPinText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 11,
  },
  floatingCard: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    ...shadows.card,
    zIndex: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  closeCardBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  closeCardBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  docCardName: {
    ...typography.subheader,
    fontSize: 16,
    fontWeight: '800',
  },
  docCardSpec: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  docCardHosp: {
    ...typography.caption,
    marginTop: 2,
  },
  docCardLoc: {
    ...typography.caption,
    marginTop: 2,
  },
  docCardAvail: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 4,
  },
  docCardFee: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  distanceBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: spacing.xs,
  },
  distanceText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailsBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },
  directionsBtn: {
    flex: 1.2,
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
  webContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  webMapFrame: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  webMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
  },
  webMapHeaderTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    flex: 1,
  },
  webDirectionsHeaderBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  webDirectionsHeaderBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  webSelectedCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  webDoctorList: {
    gap: spacing.md,
  },
  sectionHeading: {
    ...typography.subheader,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  webDocCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
});
