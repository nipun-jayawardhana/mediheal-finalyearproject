import { apiClient } from '../api/apiClient';
import {
  SymptomAnalysisRequest,
  SymptomAnalysisResponse,
  SymptomCheckDetailResponse,
  SymptomHistoryResponse,
} from '../types/symptom';

/**
 * Analyze symptoms and recommend specialist
 * Endpoint: POST /api/symptoms/analyze
 */
export const analyzeSymptomsApi = async (
  payload: SymptomAnalysisRequest
): Promise<SymptomAnalysisResponse> => {
  const response = await apiClient.post<SymptomAnalysisResponse>(
    '/symptoms/analyze',
    payload
  );
  return response.data;
};

/**
 * Get patient's symptom check history
 * Endpoint: GET /api/symptoms/history
 */
export const getSymptomHistoryApi = async (): Promise<SymptomHistoryResponse> => {
  const response = await apiClient.get<SymptomHistoryResponse>('/symptoms/history');
  return response.data;
};

/**
 * Get single symptom check by ID
 * Endpoint: GET /api/symptoms/:symptomCheckId
 */
export const getSymptomCheckByIdApi = async (
  symptomCheckId: string
): Promise<SymptomCheckDetailResponse> => {
  const response = await apiClient.get<SymptomCheckDetailResponse>(
    `/symptoms/${symptomCheckId}`
  );
  return response.data;
};
