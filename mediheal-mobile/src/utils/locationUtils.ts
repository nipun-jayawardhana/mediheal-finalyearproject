/**
 * Location and Distance Utilities for Doctor Filtering & Specialist Map
 */

export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export type DoctorSearchRadius = (typeof RADIUS_OPTIONS)[number] | null;

/**
 * Compute straight-line distance in kilometers between two GPS coordinates using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371; // Earth's radius in kilometers
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

/**
 * Format distance in kilometers into user-friendly localized string (e.g. "3.5 km away")
 */
export function formatDistanceAway(
  distanceKm: number,
  t?: (key: any) => string
): string {
  const awayText = t ? t('distanceAway') : 'away';
  return `${distanceKm} km ${awayText}`;
}
