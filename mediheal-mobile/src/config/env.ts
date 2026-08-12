/**
 * Central Environment Configuration
 * Reads EXPO_PUBLIC_API_URL from environment variables (.env).
 *
 * NOTE FOR PHYSICAL MOBILE DEVICE TESTING:
 * http://localhost:5000 does NOT refer to your development PC when testing on a physical phone.
 * Change EXPO_PUBLIC_API_URL in .env to your PC's local Wi-Fi IPv4 address (e.g. http://192.168.1.10:5000/api).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
