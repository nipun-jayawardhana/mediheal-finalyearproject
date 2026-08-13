import { apiClient } from '../api/apiClient';
import {
  AppointmentResponse,
  AppointmentListResponse,
  CreateAppointmentRequest,
  AppointmentStatus,
} from '../types/appointment';

/**
 * Create a new appointment (Patient only)
 * POST /api/appointments
 */
export const createAppointment = async (
  payload: CreateAppointmentRequest
): Promise<AppointmentResponse> => {
  const response = await apiClient.post<AppointmentResponse>(
    '/api/appointments',
    payload
  );
  return response.data;
};

/**
 * Fetch logged-in patient's appointments list
 * GET /api/appointments/my
 */
export const getMyAppointments = async (
  status?: AppointmentStatus
): Promise<AppointmentListResponse> => {
  const response = await apiClient.get<AppointmentListResponse>(
    '/api/appointments/my',
    {
      params: status ? { status } : undefined,
    }
  );
  return response.data;
};

/**
 * Fetch specific appointment details by appointment ID
 * GET /api/appointments/:appointmentId
 */
export const getAppointmentById = async (
  appointmentId: string
): Promise<AppointmentResponse> => {
  const response = await apiClient.get<AppointmentResponse>(
    `/api/appointments/${appointmentId}`
  );
  return response.data;
};

/**
 * Cancel an appointment (Patient only)
 * PATCH /api/appointments/:appointmentId/cancel
 */
export const cancelAppointment = async (
  appointmentId: string,
  cancellationReason?: string
): Promise<AppointmentResponse> => {
  const response = await apiClient.patch<AppointmentResponse>(
    `/api/appointments/${appointmentId}/cancel`,
    { cancellationReason }
  );
  return response.data;
};
