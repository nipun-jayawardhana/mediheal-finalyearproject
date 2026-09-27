/**
 * Location and Distance Utilities for Doctor Filtering & Specialist Map
 */

export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export type DoctorSearchRadius = (typeof RADIUS_OPTIONS)[number] | null;

/**
 * Default fallback patient location (Colombo Central, Sri Lanka)
 */
export const DEFAULT_PATIENT_LOCATION = {
  latitude: 6.9271,
  longitude: 79.8612,
} as const;

/**
 * Validate that given latitude and longitude represent valid, non-zero geographic coordinates
 */
export function isValidCoordinate(
  lat: number | string | null | undefined,
  lon: number | string | null | undefined
): boolean {
  if (lat === null || lat === undefined || lon === null || lon === undefined || lat === '' || lon === '') {
    return false;
  }
  const nLat = typeof lat === 'number' ? lat : Number(lat);
  const nLon = typeof lon === 'number' ? lon : Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) {
    return false;
  }
  if (nLat === 0 && nLon === 0) {
    return false;
  }
  return nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180;
}

/**
 * Compute straight-line distance in kilometers between two GPS coordinates using the Haversine formula.
 * Returns null if either coordinate is invalid, missing, or out of range.
 */
export function calculateHaversineDistance(
  lat1: number | string | null | undefined,
  lon1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lon2: number | string | null | undefined
): number | null {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const nLat1 = typeof lat1 === 'number' ? lat1 : Number(lat1);
  const nLon1 = typeof lon1 === 'number' ? lon1 : Number(lon1);
  const nLat2 = typeof lat2 === 'number' ? lat2 : Number(lat2);
  const nLon2 = typeof lon2 === 'number' ? lon2 : Number(lon2);

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Format distance in kilometers into user-friendly localized string (e.g. "3.5 km away")
 */
export function formatDistanceAway(
  distanceKm: number | null | undefined,
  t?: (key: any) => string
): string {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
    return '';
  }
  const awayText = t ? t('distanceAway') : 'away';
  return `${distanceKm} km ${awayText}`;
}

