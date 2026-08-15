import { apiClient } from '../api/apiClient';
import {
  ConsultationListResponse,
  ConsultationDetailsResponse,
} from '../types/consultation';

/**
 * Fetch logged-in patient's consultations list
 * GET /api/consultations/my
 */
export const getMyConsultations = async (): Promise<ConsultationListResponse> => {
  const response = await apiClient.get<ConsultationListResponse>(
    '/consultations/my'
  );
  return response.data;
};

/**
 * Fetch specific consultation details by ID
 * GET /api/consultations/:consultationId
 */
export const getConsultationById = async (
  consultationId: string
): Promise<ConsultationDetailsResponse> => {
  const response = await apiClient.get<ConsultationDetailsResponse>(
    `/consultations/${consultationId}`
  );
  return response.data;
};
