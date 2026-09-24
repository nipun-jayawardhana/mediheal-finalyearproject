import { apiClient } from '../api/apiClient';
import {
  AppointmentResponse,
  AppointmentListResponse,
  CreateAppointmentRequest,
  AppointmentStatus,
  DoctorAvailableSlotsResponse,
  RescheduleAppointmentRequest,
  DoctorAvailabilityResponse,
  DoctorWeeklyAvailabilityDay,
} from '../types/appointment';

/**
 * Create a new appointment (Patient only)
 * POST /api/appointments
 */
export const createAppointment = async (
  payload: CreateAppointmentRequest
): Promise<AppointmentResponse> => {
  const response = await apiClient.post<AppointmentResponse>(
    '/appointments',
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
    '/appointments/my',
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
    `/appointments/${appointmentId}`
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
    `/appointments/${appointmentId}/cancel`,
    { cancellationReason }
  );
  return response.data;
};

/**
 * Get available slots for a doctor on a specific date
 * GET /api/appointments/doctors/:doctorId/available-slots?date=YYYY-MM-DD
 */
export const getDoctorAvailableSlotsApi = async (
  doctorId: string,
  date: string
): Promise<DoctorAvailableSlotsResponse> => {
  const response = await apiClient.get<DoctorAvailableSlotsResponse>(
    `/appointments/doctors/${doctorId}/available-slots`,
    { params: { date } }
  );
  return response.data;
};

/**
 * Reschedule an appointment
 * PATCH /api/appointments/:appointmentId/reschedule
 */
export const rescheduleAppointmentApi = async (
  appointmentId: string,
  payload: RescheduleAppointmentRequest
): Promise<AppointmentResponse> => {
  const response = await apiClient.patch<AppointmentResponse>(
    `/appointments/${appointmentId}/reschedule`,
    payload
  );
  return response.data;
};

/**
 * Fetch doctor's weekly availability (Doctor only)
 * GET /api/doctor/availability
 */
export const getDoctorAvailabilityApi = async (): Promise<DoctorAvailabilityResponse> => {
  const response = await apiClient.get<DoctorAvailabilityResponse>(
    '/doctor/availability'
  );
  return response.data;
};

/**
 * Update doctor's weekly availability (Doctor only)
 * PUT /api/doctor/availability
 */
export const updateDoctorAvailabilityApi = async (payload: {
  weeklyAvailability: DoctorWeeklyAvailabilityDay[];
  defaultSlotDuration?: number;
  isAvailable?: boolean;
}): Promise<DoctorAvailabilityResponse> => {
  const response = await apiClient.put<DoctorAvailabilityResponse>(
    '/doctor/availability',
    payload
  );
  return response.data;
};

/**
 * Process appointment reminders
 * POST /api/appointments/reminders/process
 */
export const triggerAppointmentRemindersApi = async (): Promise<{
  success: boolean;
  message?: string;
  data: { evaluated: number; remindersCreated: number };
}> => {
  const response = await apiClient.post('/appointments/reminders/process');
  return response.data;
};

