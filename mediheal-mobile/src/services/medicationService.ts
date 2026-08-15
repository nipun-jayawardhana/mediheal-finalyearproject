import { apiClient } from '../api/apiClient';
import {
  MedicationListResponse,
  MedicationLogListResponse,
  MarkDoseResponse,
  MarkMedicationTakenRequest,
} from '../types/medication';

/**
 * Fetch logged-in patient's active medications
 * GET /api/medications/my
 */
export const getMyMedications = async (): Promise<MedicationListResponse> => {
  const response = await apiClient.get<MedicationListResponse>(
    '/medications/my'
  );
  return response.data;
};

/**
 * Fetch logged-in patient's medication logs
 * GET /api/medications/my/logs
 */
export const getMyMedicationLogs = async (): Promise<MedicationLogListResponse> => {
  const response = await apiClient.get<MedicationLogListResponse>(
    '/medications/my/logs'
  );
  return response.data;
};

/**
 * Mark a medication dose as taken
 * POST /api/medications/:medicationId/taken
 */
export const markMedicationTaken = async (
  medicationId: string,
  payload: MarkMedicationTakenRequest
): Promise<MarkDoseResponse> => {
  const response = await apiClient.post<MarkDoseResponse>(
    `/medications/${medicationId}/taken`,
    payload
  );
  return response.data;
};
