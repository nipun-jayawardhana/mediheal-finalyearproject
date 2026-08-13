import { apiClient } from '../api/apiClient';
import {
  DoctorAppointmentsResponse,
  DoctorAppointmentResponse,
  DoctorConsultationResponse,
  DoctorConsultationHistoryResponse,
  CreateConsultationPayload,
} from '../types/doctorPortal';

/**
 * Fetch assigned appointments for the logged-in doctor
 * GET /api/doctor/appointments
 */
export const getDoctorAppointments = async (
  status?: string
): Promise<DoctorAppointmentsResponse> => {
  const response = await apiClient.get<DoctorAppointmentsResponse>(
    '/api/doctor/appointments',
    { params: status ? { status } : undefined }
  );
  return response.data;
};

/**
 * Update appointment status (Doctor only: 'confirmed' | 'completed')
 * PATCH /api/doctor/appointments/:appointmentId/status
 */
export const updateAppointmentStatusByDoctor = async (
  appointmentId: string,
  status: 'confirmed' | 'completed'
): Promise<DoctorAppointmentResponse> => {
  const response = await apiClient.patch<DoctorAppointmentResponse>(
    `/api/doctor/appointments/${appointmentId}/status`,
    { status }
  );
  return response.data;
};

/**
 * Fetch single appointment details by ID
 * GET /api/appointments/:appointmentId
 */
export const getAppointmentById = async (
  appointmentId: string
): Promise<DoctorAppointmentResponse> => {
  const response = await apiClient.get<DoctorAppointmentResponse>(
    `/api/appointments/${appointmentId}`
  );
  return response.data;
};

/**
 * Create consultation for confirmed appointment (Doctor only)
 * POST /api/consultations
 */
export const createConsultation = async (
  payload: CreateConsultationPayload
): Promise<DoctorConsultationResponse> => {
  const response = await apiClient.post<DoctorConsultationResponse>(
    '/api/consultations',
    payload
  );
  return response.data;
};

/**
 * Get patient's consultation history for assigned doctor
 * GET /api/doctor/patients/:patientId/history
 */
export const getDoctorPatientHistory = async (
  patientId: string
): Promise<DoctorConsultationHistoryResponse> => {
  const response = await apiClient.get<DoctorConsultationHistoryResponse>(
    `/api/doctor/patients/${patientId}/history`
  );
  return response.data;
};
