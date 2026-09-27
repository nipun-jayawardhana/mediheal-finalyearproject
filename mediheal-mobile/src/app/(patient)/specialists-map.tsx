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
import { getPatientProfileApi } from '../../services/patientService';
import { DoctorProfile } from '../../types/doctor';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { getSpecializationTranslationKey } from '../../utils/displayMappers';
import {
  calculateHaversineDistance,
  formatDistanceAway,
  RADIUS_OPTIONS,
  DEFAULT_PATIENT_LOCATION,
  isValidCoordinate,
} from '../../utils/locationUtils';

// Conditionally import MapView & Marker & Circle to prevent web bundling crashes
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const MapsModule = require('react-native-maps');
    MapView = MapsModule.default;
    Marker = MapsModule.Marker;
    Circle = MapsModule.Circle;
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
  { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#93c5fd' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#60a5fa' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#132a26' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#34d399' }],
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
  const [userLocation, setUserLocation] = useState<UserLocation>(DEFAULT_PATIENT_LOCATION);
  const [selectedRadius, setSelectedRadius] = useState<number | null>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Fetch Patient Location & Preferences from Profile, with device GPS fallback
  const requestLocationAndPreferences = useCallback(async () => {
    try {
      const pRes = await getPatientProfileApi();
      if (pRes?.success && pRes.data?.profile) {
        const prof = pRes.data.profile;
        if (prof.preferredDoctorRadius) {
          setSelectedRadius(prof.preferredDoctorRadius);
        }
        const pLat = prof.patientLocation?.latitude;
        const pLng = prof.patientLocation?.longitude;
        if (isValidCoordinate(pLat, pLng)) {
          setUserLocation({
            latitude: Number(pLat),
            longitude: Number(pLng),
          });
          return;
        }
      }
    } catch {
      // Proceed to device GPS fallback
    }

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (isValidCoordinate(pos.coords.latitude, pos.coords.longitude)) {
                setUserLocation({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
                return;
              }
            },
            () => {
              // Permission denied or GPS unavailable -> ensure fallback is maintained
              setUserLocation((prev) => prev || DEFAULT_PATIENT_LOCATION);
            },
            { timeout: 5000 }
          );
          return;
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (isValidCoordinate(loc.coords.latitude, loc.coords.longitude)) {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Location request error:', err);
    }

    // Default fallback to Colombo Central if GPS and profile are not available
    setUserLocation((prev) => prev || DEFAULT_PATIENT_LOCATION);
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
    requestLocationAndPreferences();
  }, [requestLocationAndPreferences]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Filter doctors with valid numeric latitude & longitude
  const mappedDoctors = useMemo(() => {
    return doctors.filter((d) => isValidCoordinate(d.latitude, d.longitude));
  }, [doctors]);

  // Filter doctors within selected radius from patient location
  const nearbyMappedDoctors = useMemo(() => {
    if (selectedRadius === null) {
      return mappedDoctors;
    }

    if (!userLocation || !isValidCoordinate(userLocation.latitude, userLocation.longitude)) {
      return [];
    }

    return mappedDoctors.filter((doc) => {
      // 4. No doctor is passing filter because of missing coordinates
      if (!isValidCoordinate(doc.latitude, doc.longitude)) {
        return false;
      }

      const dist = calculateHaversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        doc.latitude,
        doc.longitude
      );

      return dist !== null && !isNaN(dist) && dist <= selectedRadius;
    });
  }, [mappedDoctors, selectedRadius, userLocation]);

  // Debug Distance Calculation Logger
  useEffect(() => {
    if (!userLocation || doctors.length === 0) return;

    console.log('Patient location:');
    console.log('latitude:');
    console.log(userLocation.latitude);
    console.log('longitude:');
    console.log(userLocation.longitude);

    doctors.forEach((doc) => {
      const docName = doc.userId?.fullName || 'Specialist';
      const hasCoords = isValidCoordinate(doc.latitude, doc.longitude);
      const dist = hasCoords
        ? calculateHaversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            doc.latitude,
            doc.longitude
          )
        : null;

      console.log('Doctor:');
      console.log(docName);
      console.log(hasCoords ? doc.latitude : 'undefined');
      console.log(hasCoords ? doc.longitude : 'undefined');
      console.log('Distance:');
      console.log(dist !== null ? `${dist} km` : 'No valid coordinates');
    });
  }, [doctors, userLocation]);

  // Set selected doctor if doctorId param was explicitly provided
  useEffect(() => {
    if (params.doctorId && nearbyMappedDoctors.length > 0) {
      const targetDoc = nearbyMappedDoctors.find((d) => d._id === params.doctorId);
      if (targetDoc) {
        setSelectedDoctor(targetDoc);
      }
    }
  }, [nearbyMappedDoctors, params.doctorId]);

  // Listen for Web postMessage from Leaflet map marker clicks
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'SELECT_DOCTOR' && event.data.doctorId) {
          const doc = nearbyMappedDoctors.find((d) => d._id === event.data.doctorId);
          if (doc) {
            setSelectedDoctor(doc);
          }
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [nearbyMappedDoctors]);

  // Helper to format doctor name cleanly
  const getDoctorDisplayName = useCallback((doc: DoctorProfile): string => {
    const raw = doc.userId?.fullName || 'Specialist';
    return raw.toLowerCase().startsWith('dr.') ? raw : `Dr. ${raw}`;
  }, []);

  // Compute Initial Region covering doctors and user location
  const initialRegion = useMemo(() => {
    if (nearbyMappedDoctors.length === 0) {
      return {
        latitude: userLocation?.latitude || 6.9271,
        longitude: userLocation?.longitude || 79.8612,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    if (nearbyMappedDoctors.length === 1) {
      return {
        latitude: nearbyMappedDoctors[0].latitude!,
        longitude: nearbyMappedDoctors[0].longitude!,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }

    const lats = nearbyMappedDoctors.map((d) => d.latitude!);
    const lngs = nearbyMappedDoctors.map((d) => d.longitude!);
    if (userLocation) {
      lats.push(userLocation.latitude);
      lngs.push(userLocation.longitude);
    }

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.05);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.05);

    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [nearbyMappedDoctors, userLocation]);

  // Fit to coordinates on native map
  const fitMapToMarkers = useCallback(() => {
    if (!mapRef.current || nearbyMappedDoctors.length === 0 || Platform.OS === 'web') return;

    const coords = nearbyMappedDoctors.map((d) => ({
      latitude: d.latitude!,
      longitude: d.longitude!,
    }));
    if (userLocation) {
      coords.push(userLocation);
    }

    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        500
      );
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, bottom: 80, left: 50, right: 50 },
        animated: true,
      });
    }
  }, [nearbyMappedDoctors, userLocation]);

  // Automatically fit all markers whenever nearbyMappedDoctors updates
  useEffect(() => {
    if (nearbyMappedDoctors.length > 0 && Platform.OS !== 'web') {
      const timer = setTimeout(() => {
        fitMapToMarkers();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [nearbyMappedDoctors, fitMapToMarkers]);

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

  // Generate Web Leaflet HTML containing doctor pins, user location pin, and radius circle
  const webMapHtml = useMemo(() => {
    const doctorJson = JSON.stringify(
      nearbyMappedDoctors.map((d) => {
        const dist = userLocation
          ? calculateHaversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              d.latitude!,
              d.longitude!
            )
          : null;

        return {
          id: d._id,
          name: getDoctorDisplayName(d),
          lat: d.latitude,
          lng: d.longitude,
          specialty: d.specialization,
          hospital: d.hospital,
          location: d.location || '',
          fee: d.consultationFee,
          available: d.availableDays && d.availableDays.length > 0 ? d.availableDays.join(', ') : '',
          distanceText: dist !== null ? `${dist} km away` : '',
          isSelected: selectedDoctor?._id === d._id,
        };
      })
    );

    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const cardBg = isDark ? '#1E293B' : '#FFFFFF';
    const textColor = isDark ? '#F8FAFC' : '#1E293B';
    const subColor = isDark ? '#94A3B8' : '#64748B';
    const primaryColor = isDark ? '#3B82F6' : '#1060C8';

    const userLocJson = userLocation
      ? JSON.stringify({ lat: userLocation.latitude, lng: userLocation.longitude })
      : 'null';
    const radiusMeters = selectedRadius ? selectedRadius * 1000 : 'null';

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
    .popup-dist { font-size: 11px; font-weight: 700; color: ${primaryColor}; margin-bottom: 2px; }
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
    var userLoc = ${userLocJson};
    var radiusMeters = ${radiusMeters};
    var markers = [];

    // Render User Location Pin & Radius Circle
    if (userLoc) {
      var userIcon = L.divIcon({
        className: 'user-pin-badge',
        html: '<div style="background:#2563EB;color:#FFF;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:800;box-shadow:0 2px 10px rgba(37,99,235,0.4);white-space:nowrap;">📍 Current Location</div>',
        iconAnchor: [50, 15]
      });
      var userMarker = L.marker([userLoc.lat, userLoc.lng], { icon: userIcon }).addTo(map);
      markers.push(userMarker);

      if (radiusMeters) {
        L.circle([userLoc.lat, userLoc.lng], {
          radius: radiusMeters,
          color: '${primaryColor}',
          fillColor: '${primaryColor}',
          fillOpacity: 0.12,
          weight: 2
        }).addTo(map);
      }
    }

    // Render Doctor Pins within Radius
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
        (doc.distanceText ? '<div class="popup-dist">📍 ' + doc.distanceText + '</div>' : '') +
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
  }, [nearbyMappedDoctors, selectedDoctor, userLocation, selectedRadius, isDark, getDoctorDisplayName]);

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

  // Radius Filter Bar Component
  const renderRadiusFilterChips = () => (
    <View
      style={[
        styles.radiusBarContainer,
        { backgroundColor: themeColors.card, borderBottomColor: themeColors.border },
      ]}
    >
      <Text style={[styles.radiusBarLabel, { color: themeColors.textPrimary }]}>
        ⭕ {t('searchRadius')}:
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.radiusBarScroll}
      >
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
      </ScrollView>
    </View>
  );

  // Specialization Filter Chip Bar Component
  const renderSpecializationChips = () => (
    <View
      style={[
        styles.filterBarContainer,
        { backgroundColor: themeColors.card, borderBottomColor: themeColors.border },
      ]}
    >
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
    selectedDoctor &&
    userLocation &&
    isValidCoordinate(selectedDoctor.latitude, selectedDoctor.longitude)
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
              ? `${selectedSpecialization} • ${nearbyMappedDoctors.length} Specialists in Radius`
              : `${nearbyMappedDoctors.length} Specialists in Radius`
          }
          onBackPress={() => router.back()}
        />

        {renderSpecializationChips()}
        {renderRadiusFilterChips()}

        <ScrollView contentContainerStyle={styles.webContainer} showsVerticalScrollIndicator={false}>
          {/* Web Interactive Map Displaying Filtered Pins */}
          {nearbyMappedDoctors.length > 0 || userLocation ? (
            <View style={[styles.webMapFrame, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <View style={[styles.webMapHeader, { backgroundColor: themeColors.surfaceSecondary, borderBottomColor: themeColors.border }]}>
                <Text style={[styles.webMapHeaderTitle, { color: themeColors.textPrimary }]}>
                  🗺️ {nearbyMappedDoctors.length} Specialists {selectedRadius ? `within ${selectedRadius} km` : 'on Map'}
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

              {/* Embedded interactive Leaflet view with radius circle and pins */}
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

                {selectedDocDistance !== null && (
                  <View style={[styles.distanceBadge, { backgroundColor: themeColors.primaryLight }]}>
                    <Text style={[styles.distanceText, { color: themeColors.primary }]}>
                      📍 {formatDistanceAway(selectedDocDistance, t)}
                    </Text>
                  </View>
                )}

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
          {nearbyMappedDoctors.length > 0 ? (
            <View style={styles.webDoctorList}>
              <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
                Specialists Directory ({nearbyMappedDoctors.length} {selectedRadius ? `within ${selectedRadius} km` : 'Pins'})
              </Text>

              {nearbyMappedDoctors.map((doc) => {
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
                        <View style={[styles.distanceBadge, { backgroundColor: themeColors.primaryLight }]}>
                          <Text style={[styles.distanceText, { color: themeColors.primary }]}>
                            📍 {formatDistanceAway(dist, t)}
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
              title={
                selectedRadius
                  ? `No doctors within ${selectedRadius} km`
                  : 'No doctor locations available'
              }
              description={
                selectedRadius
                  ? `No specialists with coordinates were found within ${selectedRadius} km. Try expanding to 50 km.`
                  : selectedSpecialization
                  ? `No specialists for "${selectedSpecialization}" currently have map coordinates.`
                  : 'No specialists currently have GPS map coordinates available.'
              }
              actionText={selectedRadius ? 'Expand to 50 km' : 'View All Specialists'}
              onAction={
                selectedRadius
                  ? () => setSelectedRadius(50)
                  : () => setSelectedSpecialization(undefined)
              }
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
            ? `${selectedSpecialization} (${nearbyMappedDoctors.length} Pins)`
            : `${nearbyMappedDoctors.length} Specialists on Map`
        }
        onBackPress={() => router.back()}
      />

      {renderSpecializationChips()}
      {renderRadiusFilterChips()}

      {nearbyMappedDoctors.length > 0 || userLocation ? (
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
                title={t('currentLocation')}
                description="Your Location"
                pinColor="#2563EB"
              />
            )}

            {/* Radius Circle around user location */}
            {userLocation && selectedRadius !== null && Circle && (
              <Circle
                center={userLocation}
                radius={selectedRadius * 1000}
                strokeWidth={2}
                strokeColor={themeColors.primary}
                fillColor={isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 96, 200, 0.10)'}
              />
            )}

            {/* Render nearby mapped doctors markers */}
            {nearbyMappedDoctors.map((doc) => {
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
            <Text style={[styles.recenterText, { color: themeColors.primary }]}>📍 Recenter</Text>
          </TouchableOpacity>

          {/* Selected Doctor Bottom Card */}
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

                {selectedDocDistance !== null && (
                  <View style={[styles.distanceBadge, { backgroundColor: themeColors.primaryLight }]}>
                    <Text style={[styles.distanceText, { color: themeColors.primary }]}>
                      📍 {formatDistanceAway(selectedDocDistance, t)}
                    </Text>
                  </View>
                )}

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
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="🗺️"
            title={
              selectedRadius
                ? `No doctors within ${selectedRadius} km`
                : 'No doctor locations available'
            }
            description={
              selectedRadius
                ? `No specialists with coordinates found within ${selectedRadius} km. Try expanding to 50 km.`
                : selectedSpecialization
                ? `No specialists for "${selectedSpecialization}" currently have map coordinates.`
                : 'No specialists currently have GPS map coordinates available.'
            }
            actionText={selectedRadius ? 'Expand to 50 km' : 'View All Specialists'}
            onAction={
              selectedRadius
                ? () => setSelectedRadius(50)
                : () => setSelectedSpecialization(undefined)
            }
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
  radiusBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  radiusBarLabel: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 12,
    marginRight: 6,
  },
  radiusBarScroll: {
    gap: 6,
  },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
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
