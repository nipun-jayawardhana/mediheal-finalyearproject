import { apiClient } from '../api/apiClient';
import {
  TodayMedicationResponse,
  MarkScheduleTakenResponse,
  MedicationHistoryResponse,
} from '../types/medicationSchedule';

/**
 * Fetch today's medication schedule tasks for the logged-in patient
 * GET /api/medication-schedules/my
 */
export const getMyTodayMedicationSchedules = async (
  dateStr?: string
): Promise<TodayMedicationResponse> => {
  // Default to the device's local date so "today" never depends on the server's timezone
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const endpoint = `/medication-schedules/my?date=${encodeURIComponent(dateStr || localToday)}`;
  const response = await apiClient.get<TodayMedicationResponse>(endpoint);
  return response.data;
};

/**
 * Mark a medication dose/schedule task as taken
 * POST /api/medication-schedules/:id/taken
 */
export const markScheduleTaken = async (
  id: string
): Promise<MarkScheduleTakenResponse> => {
  const response = await apiClient.post<MarkScheduleTakenResponse>(
    `/medication-schedules/${id}/taken`
  );
  return response.data;
};

/**
 * Fetch medication adherence history and stats for the logged-in patient
 * GET /api/medication-schedules/history
 */
export const getMedicationHistory = async (): Promise<MedicationHistoryResponse> => {
  const response = await apiClient.get<MedicationHistoryResponse>(
    '/medication-schedules/history'
  );
  return response.data;
};
