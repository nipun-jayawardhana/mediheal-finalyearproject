/**
 * Appointment Data Models & Service Types
 */

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

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
