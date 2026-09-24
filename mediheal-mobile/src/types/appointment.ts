/**
 * Appointment Data Models & Service Types
 */

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

export interface RescheduleHistoryItem {
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  changedBy?: string;
  changedAt?: string;
}

export interface AppointmentUserRef {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  preferredLanguage?: string;
}

export interface Appointment {
  _id: string;
  patientId: AppointmentUserRef;
  doctorId: AppointmentUserRef;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  status: AppointmentStatus;
  cancellationReason?: string;
  rescheduleHistory?: RescheduleHistoryItem[];
  createdAt?: string;
  updatedAt?: string;
  
  // Optional client-side augmented properties for rich UI presentation
  specialization?: string;
  hospital?: string;
}

export interface CreateAppointmentRequest {
  doctorId: string; // Doctor User ID or DoctorProfile ID
  appointmentDate: string; // ISO date string (YYYY-MM-DD or full ISO)
  timeSlot: string;
  reason: string;
}

export interface CancelAppointmentRequest {
  cancellationReason?: string;
}

export interface RescheduleAppointmentRequest {
  newDate: string; // YYYY-MM-DD
  newTimeSlot: string; // HH:MM
  reason?: string;
}

export interface AvailableSlotItem {
  time: string;
  available: boolean;
}

export interface DoctorAvailableSlotsResponse {
  success: boolean;
  date: string;
  doctorId: string;
  slotDuration: number;
  slots: AvailableSlotItem[];
  message?: string;
}

export interface DoctorWeeklyAvailabilityDay {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  enabled: boolean;
  slotDuration?: number;
}

export interface DoctorAvailabilityData {
  weeklyAvailability: DoctorWeeklyAvailabilityDay[];
  defaultSlotDuration: number;
  availableDays?: string[];
  isAvailable?: boolean;
}

export interface DoctorAvailabilityResponse {
  success: boolean;
  message?: string;
  data: DoctorAvailabilityData;
}

export interface AppointmentResponse {
  success: boolean;
  message?: string;
  data: Appointment;
}

export interface AppointmentListResponse {
  success: boolean;
  count: number;
  data: Appointment[];
  message?: string;
}
