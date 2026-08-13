/**
 * Doctor Portal Data Models & Service Types
 */

export type DoctorAppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface DoctorPatientUser {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  preferredLanguage?: string;
}

export interface DoctorAppointment {
  _id: string;
  patientId: DoctorPatientUser;
  doctorId: DoctorPatientUser | string;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  status: DoctorAppointmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrescriptionItemInput {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface CreateConsultationPayload {
  appointmentId: string;
  diagnosis: string;
  clinicalNotes?: string;
  prescriptions?: PrescriptionItemInput[];
  recommendations?: string[];
  followUpDate?: string;
}

export interface DoctorConsultationRecord {
  _id: string;
  appointmentId: DoctorAppointment | string;
  patientId: DoctorPatientUser;
  doctorId: DoctorPatientUser | string;
  diagnosis: string;
  clinicalNotes?: string;
  prescriptions?: PrescriptionItemInput[];
  recommendations?: string[];
  followUpDate?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface DoctorAppointmentsResponse {
  success: boolean;
  count: number;
  data: DoctorAppointment[];
  message?: string;
}

export interface DoctorAppointmentResponse {
  success: boolean;
  data: DoctorAppointment;
  message?: string;
}

export interface DoctorConsultationResponse {
  success: boolean;
  message?: string;
  data: DoctorConsultationRecord;
}

export interface DoctorConsultationHistoryResponse {
  success: boolean;
  count: number;
  data: DoctorConsultationRecord[];
  message?: string;
}

export interface GenericDoctorResponse {
  success: boolean;
  message?: string;
}
