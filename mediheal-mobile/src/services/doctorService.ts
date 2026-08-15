import { apiClient } from '../api/apiClient';
import {
  DoctorListResponse,
  DoctorDetailsResponse,
  DoctorQueryParams,
} from '../types/doctor';

/**
 * Fetch all active doctors with optional query filtering
 */
export const getDoctors = async (
  params?: DoctorQueryParams
): Promise<DoctorListResponse> => {
  const response = await apiClient.get<DoctorListResponse>('/doctors', {
    params,
  });
  return response.data;
};

/**
 * Helper to fetch doctors filtered specifically by specialization
 */
export const getDoctorsBySpecialization = async (
  specialization: string
): Promise<DoctorListResponse> => {
  return getDoctors({ specialization });
};

/**
 * Fetch single doctor profile details by DoctorProfile ID or Doctor User ID
 */
export const getDoctorById = async (
  doctorId: string
): Promise<DoctorDetailsResponse> => {
  const response = await apiClient.get<DoctorDetailsResponse>(
    `/doctors/${doctorId}`
  );
  return response.data;
};
