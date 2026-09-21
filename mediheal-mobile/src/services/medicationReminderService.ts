import { apiClient } from '../api/apiClient';
import {
  MissedMedicationResponse,
  CaregiverMissedMedicationResponse,
  CaregiverPatientTodayMedicationResponse,
} from '../types/medicationReminder';

/**
 * Fetch missed medications for the logged-in patient
 * GET /api/medication-schedules/missed
 */
export const getMyMissedMedications = async (): Promise<MissedMedicationResponse> => {
  const response = await apiClient.get<MissedMedicationResponse>(
    '/medication-schedules/missed'
  );
  return response.data;
};

/**
 * Fetch missed medications across all linked patients for a caregiver
 * GET /api/caregiver/medications/missed
 */
export const getCaregiverMissedMedications = async (): Promise<CaregiverMissedMedicationResponse> => {
  const response = await apiClient.get<CaregiverMissedMedicationResponse>(
    '/caregiver/medications/missed'
  );
  return response.data;
};

/**
 * Fetch today's prescribed medication status for a linked patient
 * GET /api/caregiver/medications/patient/:patientId/today
 */
export const getCaregiverPatientTodayMedications = async (
  patientId: string,
  dateStr?: string
): Promise<CaregiverPatientTodayMedicationResponse> => {
  const endpoint = dateStr
    ? `/caregiver/medications/patient/${patientId}/today?date=${encodeURIComponent(dateStr)}`
    : `/caregiver/medications/patient/${patientId}/today`;
  const response = await apiClient.get<CaregiverPatientTodayMedicationResponse>(endpoint);
  return response.data;
};
