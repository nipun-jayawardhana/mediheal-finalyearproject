import { apiClient } from '../api/apiClient';
import {
  AdminDoctorListResponse,
  AdminDoctorDetailResponse,
  CreateDoctorResponse,
  CreateDoctorRequest,
  UpdateDoctorRequest,
  DoctorStatusRequest,
} from '../types/admin';

/**
 * Fetch all doctor profiles for admin with optional filters
 * GET /api/admin/doctors
 */
export const getAdminDoctors = async (params?: {
  specialization?: string;
  isAvailable?: boolean;
  search?: string;
}): Promise<AdminDoctorListResponse> => {
  const response = await apiClient.get<AdminDoctorListResponse>(
    '/api/admin/doctors',
    { params }
  );
  return response.data;
};

/**
 * Fetch single doctor details by DoctorProfile ID or User ID (Admin)
 * GET /api/admin/doctors/:doctorId
 */
export const getAdminDoctorById = async (
  doctorId: string
): Promise<AdminDoctorDetailResponse> => {
  const response = await apiClient.get<AdminDoctorDetailResponse>(
    `/api/admin/doctors/${doctorId}`
  );
  return response.data;
};

/**
 * Create a new doctor account and profile (Admin only)
 * POST /api/admin/doctors
 */
export const createDoctor = async (
  payload: CreateDoctorRequest
): Promise<CreateDoctorResponse> => {
  const response = await apiClient.post<CreateDoctorResponse>(
    '/api/admin/doctors',
    payload
  );
  return response.data;
};

/**
 * Update doctor profile and user account details (Admin only)
 * PUT /api/admin/doctors/:doctorId
 */
export const updateDoctor = async (
  doctorId: string,
  payload: UpdateDoctorRequest
): Promise<AdminDoctorDetailResponse> => {
  const response = await apiClient.put<AdminDoctorDetailResponse>(
    `/api/admin/doctors/${doctorId}`,
    payload
  );
  return response.data;
};

/**
 * Update doctor account status (isActive) or availability (isAvailable) (Admin only)
 * PATCH /api/admin/doctors/:doctorId/status
 */
export const updateDoctorStatus = async (
  doctorId: string,
  payload: DoctorStatusRequest
): Promise<AdminDoctorDetailResponse> => {
  const response = await apiClient.patch<AdminDoctorDetailResponse>(
    `/api/admin/doctors/${doctorId}/status`,
    payload
  );
  return response.data;
};
