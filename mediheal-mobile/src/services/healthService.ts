import { apiClient } from '../api/apiClient';

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp?: string;
  environment?: string;
  database?: {
    status: string;
    connected: boolean;
  };
}

/**
 * Checks backend API health connection.
 * Endpoint: GET /api/health
 */
export const checkBackendHealth = async (): Promise<HealthResponse> => {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
};
