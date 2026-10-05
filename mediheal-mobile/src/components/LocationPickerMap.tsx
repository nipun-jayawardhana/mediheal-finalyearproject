import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  StyleProp,
  TextStyle,
} from 'react-native';
import * as Location from 'expo-location';
import { spacing, borderRadius, typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PATIENT_LOCATION, isValidCoordinate } from '../utils/locationUtils';
import { showMessage } from '../utils/dialogs';
import { GeocodeResult, reverseGeocode, searchPlaces } from '../services/geocodingService';

// Conditionally import MapView & Marker to prevent web bundling crashes
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

const MESSAGE_SOURCE = 'mediheal-location-picker';
const PICKED_ZOOM_DELTA = 0.01;
const DEFAULT_ZOOM_DELTA = 0.08;
const MAP_HEIGHT = 280;
const SEARCH_DEBOUNCE_MS = 700;

export interface PickedCoordinate {
  latitude: number;
  longitude: number;
}

interface LocationPickerMapProps {
  value: PickedCoordinate | null;
  onChange: (coordinate: PickedCoordinate | null) => void;
  address: string;
  onAddressChange: (address: string) => void;
  inputStyle?: StyleProp<TextStyle>;
  hasError?: boolean;
}

const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Single location control: the address field and the map pin stay in sync.
 * - Typing an address suggests matching places; choosing one moves the pin.
 * - Tapping/dragging on the map (or using current location) fills in the address.
 */
export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  value,
  onChange,
  address,
  onAddressChange,
  inputStyle,
  hasError,
}) => {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);

  const [locating, setLocating] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);
  const [resolvingAddress, setResolvingAddress] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string>('');

  const hasValue = !!value && isValidCoordinate(value.latitude, value.longitude);

  // Snapshot of the starting point; the web iframe is only built once per theme so it doesn't reload on every pick.
  const initialCenterRef = useRef<PickedCoordinate>(
    hasValue ? (value as PickedCoordinate) : { ...DEFAULT_PATIENT_LOCATION }
  );
  const initialHasPinRef = useRef<boolean>(hasValue);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchAbortRef.current?.abort();
      reverseAbortRef.current?.abort();
    };
  }, []);

  const cancelPendingSearch = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchAbortRef.current?.abort();
    setSearching(false);
    setSuggestions([]);
    setSearchMessage('');
  };

  // Move the visible map (and web pin) to a coordinate chosen outside the map itself
  const focusMap = (coord: PickedCoordinate | null) => {
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        { source: MESSAGE_SOURCE, type: coord ? 'SET_PIN' : 'CLEAR_PIN', lat: coord?.latitude, lng: coord?.longitude },
        '*'
      );
      return;
    }
    if (coord && mapRef.current) {
      mapRef.current.animateToRegion(
        { ...coord, latitudeDelta: PICKED_ZOOM_DELTA, longitudeDelta: PICKED_ZOOM_DELTA },
        400
      );
    }
  };

  // Pin moved from the map side -> update coordinate and fill in the address
  const handlePinPlaced = async (lat: number, lng: number) => {
    const coord = { latitude: roundCoord(lat), longitude: roundCoord(lng) };
    onChange(coord);
    cancelPendingSearch();

    reverseAbortRef.current?.abort();
    const controller = new AbortController();
    reverseAbortRef.current = controller;
    setResolvingAddress(true);
    try {
      const place = await reverseGeocode(coord.latitude, coord.longitude, controller.signal);
      if (!controller.signal.aborted && place?.label) {
        onAddressChange(place.label);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Reverse geocoding failed:', err?.message);
      }
    } finally {
      if (reverseAbortRef.current === controller) setResolvingAddress(false);
    }
  };

  const runSearch = async (query: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setSearchMessage('');
    try {
      const results = await searchPlaces(query, controller.signal);
      if (controller.signal.aborted) return;
      setSuggestions(results);
      setSearchMessage(results.length === 0 ? 'No matching places found. You can still drop the pin on the map.' : '');
      return results;
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setSuggestions([]);
        setSearchMessage('Address search is unavailable right now. Drop the pin on the map instead.');
      }
    } finally {
      if (searchAbortRef.current === controller) setSearching(false);
    }
  };

  // Address typed -> suggest places (debounced)
  const handleAddressTyped = (text: string) => {
    onAddressChange(text);
    reverseAbortRef.current?.abort();
    setResolvingAddress(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (text.trim().length < 3) {
      searchAbortRef.current?.abort();
      setSearching(false);
      setSuggestions([]);
      setSearchMessage('');
      return;
    }
    searchTimerRef.current = setTimeout(() => void runSearch(text), SEARCH_DEBOUNCE_MS);
  };

  // Suggestion chosen -> move the pin there and use its label as the address
  const handleSuggestionSelected = (place: GeocodeResult) => {
    cancelPendingSearch();
    const coord = { latitude: place.latitude, longitude: place.longitude };
    onAddressChange(place.label);
    onChange(coord);
    focusMap(coord);
  };

  // Enter pressed -> jump to the best match without waiting for the debounce
  const handleSubmitAddress = async () => {
    if (suggestions.length > 0) {
      handleSuggestionSelected(suggestions[0]);
      return;
    }
    if (address.trim().length < 3) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const results = await runSearch(address);
    if (results && results.length > 0) handleSuggestionSelected(results[0]);
  };

  // Web: receive picks from the Leaflet iframe
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (data && data.source === MESSAGE_SOURCE && data.type === 'PICKED') {
        void handlePinPlaced(Number(data.lat), Number(data.lng));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  });

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showMessage('Permission Needed', 'Location permission is required to use your current position.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord = { latitude: roundCoord(pos.coords.latitude), longitude: roundCoord(pos.coords.longitude) };
      focusMap(coord);
      void handlePinPlaced(coord.latitude, coord.longitude);
    } catch (err: any) {
      showMessage('Location Unavailable', err?.message || 'Unable to determine your current location.');
    } finally {
      setLocating(false);
    }
  };

  const handleClear = () => {
    cancelPendingSearch();
    reverseAbortRef.current?.abort();
    setResolvingAddress(false);
    onChange(null);
    onAddressChange('');
    focusMap(null);
  };

  const webMapHtml = useMemo(() => {
    if (Platform.OS !== 'web') return '';
    const center = initialCenterRef.current;
    const primary = isDark ? '#3B82F6' : '#1060C8';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: ${isDark ? '#0F172A' : '#F4F7FC'}; font-family: system-ui, -apple-system, sans-serif; }
    #map { cursor: crosshair; }
    .pick-pin { font-size: 30px; line-height: 30px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); }
    .hint { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 1000; background: ${primary}; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); pointer-events: none; white-space: nowrap; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Click the map or drag the pin to set the location</div>
  <script>
    var SOURCE = '${MESSAGE_SOURCE}';
    var map = L.map('map', { zoomControl: true }).setView([${center.latitude}, ${center.longitude}], ${initialHasPinRef.current ? 15 : 12});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var pinIcon = L.divIcon({ className: '', html: '<div class="pick-pin">📍</div>', iconSize: [30, 30], iconAnchor: [15, 30] });
    var marker = null;

    function notify(latlng) {
      window.parent.postMessage({ source: SOURCE, type: 'PICKED', lat: latlng.lat, lng: latlng.lng }, '*');
    }

    function placePin(latlng) {
      if (marker) {
        marker.setLatLng(latlng);
      } else {
        marker = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(map);
        marker.on('dragend', function () { notify(marker.getLatLng()); });
      }
    }

    ${initialHasPinRef.current ? `placePin(L.latLng(${center.latitude}, ${center.longitude}));` : ''}

    map.on('click', function (e) {
      placePin(e.latlng);
      notify(e.latlng);
    });

    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || data.source !== SOURCE) return;
      if (data.type === 'SET_PIN') {
        var ll = L.latLng(data.lat, data.lng);
        placePin(ll);
        map.setView(ll, 16);
      } else if (data.type === 'CLEAR_PIN' && marker) {
        map.removeLayer(marker);
        marker = null;
      }
    });
  </script>
</body>
</html>`;
  }, [isDark]);

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <iframe
          ref={iframeRef}
          title="Doctor Location Picker"
          width="100%"
          height={String(MAP_HEIGHT)}
          style={{ border: 0, display: 'block' }}
          srcDoc={webMapHtml}
        />
      );
    }

    if (!MapView) {
      return (
        <View style={[styles.unavailable, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.unavailableText, { color: colors.textMuted }]}>
            Map is unavailable on this device. Search an address or use "Current Location" instead.
          </Text>
        </View>
      );
    }

    const center = initialCenterRef.current;
    const delta = initialHasPinRef.current ? PICKED_ZOOM_DELTA : DEFAULT_ZOOM_DELTA;

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.nativeMap}
        initialRegion={{ ...center, latitudeDelta: delta, longitudeDelta: delta }}
        onPress={(e: any) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          void handlePinPlaced(latitude, longitude);
        }}
      >
        {hasValue && (
          <Marker
            coordinate={value}
            draggable
            pinColor={colors.primary}
            onDragEnd={(e: any) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              void handlePinPlaced(latitude, longitude);
            }}
          />
        )}
      </MapView>
    );
  };

  return (
    <View>
      {/* Address search field */}
      <View>
        <TextInput
          style={[
            styles.defaultInput,
            { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.border },
            inputStyle,
            styles.inputWithStatus,
          ]}
          placeholder="Search address or hospital, e.g. Colombo 07"
          placeholderTextColor={colors.textMuted}
          value={address}
          onChangeText={handleAddressTyped}
          onSubmitEditing={() => void handleSubmitAddress()}
          returnKeyType="search"
          autoCorrect={false}
        />
        {(searching || resolvingAddress) && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.inputSpinner} />
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={[styles.suggestionList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {suggestions.map((place, idx) => (
            <TouchableOpacity
              key={`${place.latitude},${place.longitude},${idx}`}
              style={[
                styles.suggestionRow,
                idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
              onPress={() => handleSuggestionSelected(place)}
              activeOpacity={0.7}
            >
              <Text style={[styles.suggestionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                📍 {place.label}
              </Text>
              <Text style={[styles.suggestionSub, { color: colors.textMuted }]} numberOfLines={1}>
                {place.fullAddress}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {searchMessage ? (
        <Text style={[styles.hintText, { color: colors.textMuted }]}>{searchMessage}</Text>
      ) : null}

      {/* Map */}
      <View
        style={[
          styles.mapFrame,
          { borderColor: hasError ? colors.danger : colors.border, backgroundColor: colors.surfaceSecondary },
        ]}
      >
        {renderMap()}
      </View>

      <Text style={[styles.hintText, { color: colors.textMuted }]}>
        {Platform.OS === 'web'
          ? 'Search above or click the map. The address and pin update together.'
          : 'Search above or tap the map. Long-press and drag the pin to adjust.'}
      </Text>

      <View style={styles.footerRow}>
        <View style={styles.coordCol}>
          <Text style={[styles.coordLabel, { color: colors.textMuted }]}>Pinned coordinates</Text>
          <Text style={[styles.coordValue, { color: hasValue ? colors.textPrimary : colors.textMuted }]}>
            {hasValue ? `${value!.latitude.toFixed(6)}, ${value!.longitude.toFixed(6)}` : 'No pin on the map yet'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.footerBtn, { borderColor: colors.primary }]}
          onPress={handleUseCurrentLocation}
          disabled={locating}
          activeOpacity={0.8}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.footerBtnText, { color: colors.primary }]}>📍 Current Location</Text>
          )}
        </TouchableOpacity>

        {(hasValue || address.length > 0) && (
          <TouchableOpacity
            style={[styles.footerBtn, { borderColor: colors.border }]}
            onPress={handleClear}
            activeOpacity={0.8}
          >
            <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  defaultInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  inputWithStatus: {
    paddingRight: 40,
  },
  inputSpinner: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
  },
  suggestionList: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  suggestionTitle: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  suggestionSub: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
  mapFrame: {
    height: MAP_HEIGHT,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  nativeMap: {
    width: '100%',
    height: '100%',
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  unavailableText: {
    ...typography.caption,
    textAlign: 'center',
  },
  hintText: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  coordCol: {
    flex: 1,
  },
  coordLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  coordValue: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  footerBtn: {
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
