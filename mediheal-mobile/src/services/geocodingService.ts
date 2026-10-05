import { Platform } from 'react-native';

/**
 * Address <-> coordinate lookups via OpenStreetMap Nominatim.
 * Used on every platform so web and native produce the same address formats.
 * Nominatim allows ~1 request/second, so callers should debounce search input.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
  fullAddress: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

// Browsers forbid setting User-Agent; native apps should identify themselves per Nominatim policy
const requestHeaders: Record<string, string> =
  Platform.OS === 'web' ? { Accept: 'application/json' } : { Accept: 'application/json', 'User-Agent': 'MediHeal-Mobile/1.0' };

// Build a short, human-friendly label such as "Nawaloka Hospital, Weekanda, Colombo"
function formatLabel(place: NominatimPlace): string {
  const a = place.address || {};
  const parts = [
    place.name || a.road,
    a.suburb || a.neighbourhood || a.city_district || a.quarter,
    a.city || a.town || a.village || a.municipality || a.county,
  ];

  const seen = new Set<string>();
  const label = parts
    .map((p) => p?.trim())
    .filter((p): p is string => {
      if (!p || seen.has(p.toLowerCase())) return false;
      seen.add(p.toLowerCase());
      return true;
    })
    .slice(0, 3)
    .join(', ');

  return label || place.display_name.split(',').slice(0, 3).join(',').trim();
}

function toResult(place: NominatimPlace): GeocodeResult {
  return {
    latitude: Math.round(parseFloat(place.lat) * 1e6) / 1e6,
    longitude: Math.round(parseFloat(place.lon) * 1e6) / 1e6,
    label: formatLabel(place),
    fullAddress: place.display_name,
  };
}

/**
 * Search places by free-text address (limited to Sri Lanka)
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url =
    `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=lk&accept-language=en` +
    `&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: requestHeaders, signal });
  if (!res.ok) throw new Error(`Address search failed (${res.status})`);
  const places: NominatimPlace[] = await res.json();
  return places.map(toResult);
}

/**
 * Resolve a short address label for a coordinate
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const url =
    `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1&zoom=17&accept-language=en` +
    `&lat=${latitude}&lon=${longitude}`;
  const res = await fetch(url, { headers: requestHeaders, signal });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
  const place: NominatimPlace & { error?: string } = await res.json();
  if (place.error || !place.lat) return null;
  return toResult(place);
}
