import { apiClient } from '../api/apiClient';
import {
  AnalyticsRange,
  MedicationAnalyticsResponse,
} from '../types/medicationAnalytics';

/**
 * Fetch logged-in patient's medication adherence analytics
 * GET /api/medication-analytics/my?range=30d
 */
export const getMyMedicationAnalytics = async (
  range: AnalyticsRange = '30d'
): Promise<MedicationAnalyticsResponse> => {
  const response = await apiClient.get<MedicationAnalyticsResponse>(
    '/medication-analytics/my',
    { params: { range } }
  );
  return response.data;
};

/**
 * Fetch medication adherence analytics for a linked patient (Caregiver)
 * GET /api/caregiver/medication-analytics/patient/:patientId?range=30d
 */
export const getCaregiverPatientMedicationAnalytics = async (
  patientId: string,
  range: AnalyticsRange = '30d'
): Promise<MedicationAnalyticsResponse> => {
  const response = await apiClient.get<MedicationAnalyticsResponse>(
    `/caregiver/medication-analytics/patient/${patientId}`,
    { params: { range } }
  );
  return response.data;
};

/**
 * Fetch medication adherence analytics for an authorized patient (Doctor)
 * GET /api/doctor/patients/:patientId/medication-analytics?range=30d
 */
export const getDoctorPatientMedicationAnalytics = async (
  patientId: string,
  range: AnalyticsRange = '30d'
): Promise<MedicationAnalyticsResponse> => {
  const response = await apiClient.get<MedicationAnalyticsResponse>(
    `/doctor/patients/${patientId}/medication-analytics`,
    { params: { range } }
  );
  return response.data;
};
