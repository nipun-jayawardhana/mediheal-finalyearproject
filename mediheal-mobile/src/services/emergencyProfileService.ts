import { apiClient } from '../api/apiClient';
import {
  EmergencyProfileResponse,
  UpdateEmergencyProfilePayload,
} from '../types/emergencyProfile';

/**
 * Fetch current patient's emergency health profile
 * Endpoint: GET /api/emergency-profile/my
 */
export const getMyEmergencyProfileApi = async (): Promise<EmergencyProfileResponse> => {
  const response = await apiClient.get<EmergencyProfileResponse>('/emergency-profile/my');
  return response.data;
};

/**
 * Create or update current patient's emergency health profile
 * Endpoint: PUT /api/emergency-profile/my
 */
export const updateMyEmergencyProfileApi = async (
  payload: UpdateEmergencyProfilePayload
): Promise<EmergencyProfileResponse> => {
  const response = await apiClient.put<EmergencyProfileResponse>(
    '/emergency-profile/my',
    payload
  );
  return response.data;
};
