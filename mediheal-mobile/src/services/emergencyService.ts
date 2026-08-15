import { apiClient } from '../api/apiClient';
import {
  EmergencyAlert,
  CreateEmergencyPayload,
  EmergencyResponse,
  EmergencyListResponse,
} from '../types/emergency';

/**
 * Create a new emergency alert (Patient only)
 * POST /api/emergency
 */
export const createEmergencyAlert = async (
  payload: CreateEmergencyPayload
): Promise<EmergencyResponse> => {
  const response = await apiClient.post<EmergencyResponse>(
    '/emergency',
    payload
  );
  return response.data;
};

/**
 * Fetch patient's own emergency alerts
 * GET /api/emergency/my
 */
export const getMyEmergencyAlerts = async (): Promise<EmergencyListResponse> => {
  const response = await apiClient.get<EmergencyListResponse>(
    '/emergency/my'
  );
  return response.data;
};

/**
 * Get single emergency alert by ID
 * GET /api/emergency/:alertId
 */
export const getEmergencyAlertById = async (
  alertId: string
): Promise<EmergencyResponse> => {
  const response = await apiClient.get<EmergencyResponse>(
    `/emergency/${alertId}`
  );
  return response.data;
};

/**
 * Cancel own emergency alert (Patient only)
 * PATCH /api/emergency/:alertId/cancel
 */
export const cancelEmergencyAlert = async (
  alertId: string,
  reason?: string
): Promise<EmergencyResponse> => {
  const response = await apiClient.patch<EmergencyResponse>(
    `/emergency/${alertId}/cancel`,
    { reason }
  );
  return response.data;
};

/**
 * Helper method to fetch the patient's currently active emergency alert (if any)
 */
export const getActiveEmergencyAlert = async (): Promise<EmergencyAlert | null> => {
  try {
    const res = await getMyEmergencyAlerts();
    if (res && res.success && Array.isArray(res.data)) {
      const activeAlert = res.data.find((alert) => alert.status === 'active');
      return activeAlert || null;
    }
    return null;
  } catch (err) {
    return null;
  }
};
