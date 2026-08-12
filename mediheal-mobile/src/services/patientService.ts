import { apiClient } from '../api/apiClient';
import {
  CreatePatientProfilePayload,
  PatientDashboardResponse,
  PatientProfileResponse,
  UpdatePatientProfilePayload,
} from '../types/patient';

/**
 * Get current patient profile
 * Endpoint: GET /api/patients/profile
 */
export const getPatientProfileApi = async (): Promise<PatientProfileResponse> => {
  const response = await apiClient.get<PatientProfileResponse>('/patients/profile');
  return response.data;
};

/**
 * Create new patient profile
 * Endpoint: POST /api/patients/profile
 */
export const createPatientProfileApi = async (
  payload: CreatePatientProfilePayload
): Promise<PatientProfileResponse> => {
  const response = await apiClient.post<PatientProfileResponse>(
    '/patients/profile',
    payload
  );
  return response.data;
};

/**
 * Update existing patient profile
 * Endpoint: PUT /api/patients/profile
 */
export const updatePatientProfileApi = async (
  payload: UpdatePatientProfilePayload
): Promise<PatientProfileResponse> => {
  const response = await apiClient.put<PatientProfileResponse>(
    '/patients/profile',
    payload
  );
  return response.data;
};

/**
 * Get patient dashboard summary data
 * Endpoint: GET /api/patients/dashboard
 */
export const getPatientDashboardApi = async (): Promise<PatientDashboardResponse> => {
  const response = await apiClient.get<PatientDashboardResponse>('/patients/dashboard');
  return response.data;
};
