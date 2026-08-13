/**
 * Consultation Data Models & Service Types
 */

export interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface ConsultationUserRef {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  preferredLanguage?: string;
}

export interface ConsultationAppointmentRef {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  reason: string;
}

export interface Consultation {
  _id: string;
  appointmentId: ConsultationAppointmentRef;
  patientId: ConsultationUserRef;
  doctorId: ConsultationUserRef;
  diagnosis: string;
  clinicalNotes?: string;
  prescriptions: PrescriptionItem[];
  recommendations: string[];
  followUpDate?: string | null;
  completedAt: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Optional client-side augmented properties
  specialization?: string;
  hospital?: string;
}

export interface ConsultationListResponse {
  success: boolean;
  count: number;
  data: Consultation[];
  message?: string;
}

export interface ConsultationDetailsResponse {
  success: boolean;
  data: Consultation;
  message?: string;
}
