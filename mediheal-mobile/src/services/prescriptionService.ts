import { apiClient } from '../api/apiClient';
import {
  PrescriptionListResponse,
  PrescriptionDetailsResponse,
  CreatePrescriptionPayload,
} from '../types/prescription';

/**
 * Fetch logged-in patient's prescriptions list
 * GET /api/prescriptions/my
 */
export const getMyPrescriptions = async (): Promise<PrescriptionListResponse> => {
  const response = await apiClient.get<PrescriptionListResponse>(
    '/prescriptions/my'
  );
  return response.data;
};

/**
 * Fetch specific prescription details by ID
 * GET /api/prescriptions/:prescriptionId
 */
export const getPrescriptionById = async (
  prescriptionId: string
): Promise<PrescriptionDetailsResponse> => {
  const response = await apiClient.get<PrescriptionDetailsResponse>(
    `/prescriptions/${prescriptionId}`
  );
  return response.data;
};

/**
 * Create a new prescription (Doctor only)
 * POST /api/prescriptions
 */
export const createPrescription = async (
  payload: CreatePrescriptionPayload
): Promise<PrescriptionDetailsResponse> => {
  const response = await apiClient.post<PrescriptionDetailsResponse>(
    '/prescriptions',
    payload
  );
  return response.data;
};
