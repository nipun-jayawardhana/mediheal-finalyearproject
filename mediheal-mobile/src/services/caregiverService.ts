import { apiClient } from '../api/apiClient';
import {
  CaregiverPatientListResponse,
  CaregiverPatientOverviewResponse,
  CaregiverLinkResponse,
  GenericCaregiverResponse,
  LinkPatientPayload,
  AddMedicationPayload,
  UpdateMedicationPayload,
} from '../types/caregiver';
import { EmergencyListResponse, EmergencyResponse } from '../types/emergency';
import { MedicationListResponse, MedicationLogListResponse } from '../types/medication';

/**
 * Link caregiver to patient using caregiverLinkCode
 * POST /api/caregivers/link
 */
export const linkPatient = async (
  payload: LinkPatientPayload
): Promise<CaregiverLinkResponse> => {
  const response = await apiClient.post<CaregiverLinkResponse>(
    '/caregivers/link',
    payload
  );
  return response.data;
};

/**
 * Fetch all active patients linked to logged-in caregiver
 * GET /api/caregivers/patients
 */
export const getLinkedPatients = async (): Promise<CaregiverPatientListResponse> => {
  const response = await apiClient.get<CaregiverPatientListResponse>(
    '/caregivers/patients'
  );
  return response.data;
};

/**
 * Fetch detailed patient overview for a linked patient
 * GET /api/caregivers/patients/:patientId
 */
export const getPatientDetailsForCaregiver = async (
  patientId: string
): Promise<CaregiverPatientOverviewResponse> => {
  const response = await apiClient.get<CaregiverPatientOverviewResponse>(
    `/caregivers/patients/${patientId}`
  );
  return response.data;
};

/**
 * Remove caregiver link for a patient
 * DELETE /api/caregivers/patients/:patientId/link
 */
export const removeCaregiverLink = async (
  patientId: string
): Promise<GenericCaregiverResponse> => {
  const response = await apiClient.delete<GenericCaregiverResponse>(
    `/caregivers/patients/${patientId}/link`
  );
  return response.data;
};

/**
 * Get emergency alerts for actively linked patients
 * GET /api/caregivers/emergency-alerts
 */
export const getCaregiverEmergencyAlerts = async (): Promise<EmergencyListResponse> => {
  const response = await apiClient.get<EmergencyListResponse>(
    '/caregivers/emergency-alerts'
  );
  return response.data;
};

/**
 * Resolve an active emergency alert (Caregiver only)
 * PATCH /api/emergency/:alertId/resolve
 */
export const resolveEmergencyAlert = async (
  alertId: string
): Promise<EmergencyResponse> => {
  const response = await apiClient.patch<EmergencyResponse>(
    `/emergency/${alertId}/resolve`
  );
  return response.data;
};

/**
 * Add a new medication for a linked patient
 * POST /api/medications
 */
export const addMedicationForPatient = async (
  payload: AddMedicationPayload
): Promise<any> => {
  const response = await apiClient.post('/medications', payload);
  return response.data;
};

/**
 * Get all medications for a linked patient
 * GET /api/medications/patient/:patientId
 */
export const getPatientMedications = async (
  patientId: string
): Promise<MedicationListResponse> => {
  const response = await apiClient.get<MedicationListResponse>(
    `/medications/patient/${patientId}`
  );
  return response.data;
};

/**
 * Get medication logs for a linked patient
 * GET /api/medications/patient/:patientId/logs
 */
export const getPatientMedicationLogs = async (
  patientId: string
): Promise<MedicationLogListResponse> => {
  const response = await apiClient.get<MedicationLogListResponse>(
    `/medications/patient/${patientId}/logs`
  );
  return response.data;
};

/**
 * Update medication details for a linked patient
 * PUT /api/medications/:medicationId
 */
export const updateMedication = async (
  medicationId: string,
  payload: UpdateMedicationPayload
): Promise<any> => {
  const response = await apiClient.put(`/medications/${medicationId}`, payload);
  return response.data;
};

/**
 * Soft deactivate medication for a linked patient
 * DELETE /api/medications/:medicationId
 */
export const deactivateMedication = async (
  medicationId: string
): Promise<any> => {
  const response = await apiClient.delete(`/medications/${medicationId}`);
  return response.data;
};
