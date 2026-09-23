import { apiClient } from '../api/apiClient';
import { PatientMedicalHistoryResponse } from '../types/medicalHistory';

/**
 * Fetch chronological medical history timeline for the logged-in patient
 * Endpoint: GET /api/patient/medical-history
 */
export const getPatientMedicalHistory = async (): Promise<PatientMedicalHistoryResponse> => {
  const response = await apiClient.get<PatientMedicalHistoryResponse>(
    '/patient/medical-history'
  );
  return response.data;
};
