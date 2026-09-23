export interface TimelineDoctorInfo {
  _id?: string;
  name: string;
  specialization: string;
  hospital: string;
  slmcNumber?: string;
}

export interface TimelineMedicineItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface TimelinePrescriptionInfo {
  prescriptionId?: string | null;
  date?: string;
  status?: string;
  medications: TimelineMedicineItem[];
}

export interface TimelineAdherenceSummary {
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
  adherencePercentage: number | null;
  hasEnoughData: boolean;
  summaryText: string;
}

export interface AppointmentSummaryInfo {
  appointmentDate?: string;
  timeSlot?: string;
  reason?: string;
}

export type TimelineEventType = 'CONSULTATION' | 'PRESCRIPTION' | 'MEDICATION_ADHERENCE';

export interface MedicalTimelineItem {
  id: string;
  type: TimelineEventType;
  date: string;
  consultationId?: string | null;
  appointmentId?: string | null;
  appointmentDetails?: AppointmentSummaryInfo | null;
  doctor: TimelineDoctorInfo;
  diagnosis?: string;
  clinicalNotes?: string;
  recommendations?: string[];
  followUpDate?: string | null;
  prescription?: TimelinePrescriptionInfo | null;
  adherence?: TimelineAdherenceSummary | null;
}

export interface PatientMedicalHistoryResponse {
  success: boolean;
  count: number;
  data: MedicalTimelineItem[];
  message?: string;
}
