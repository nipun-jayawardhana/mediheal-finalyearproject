/**
 * Medication Data Models & Service Types
 */

export type MedicationStatus = 'pending' | 'taken' | 'missed';

export interface Medication {
  _id: string;
  patientId: string;
  addedBy: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
  startDate: string;
  endDate: string;
  instructions?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicationLogRef {
  _id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
}

export interface MedicationLog {
  _id: string;
  medicationId: MedicationLogRef | string;
  patientId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: MedicationStatus;
  takenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarkMedicationTakenRequest {
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // e.g. "08:00"
}

export interface MedicationListResponse {
  success: boolean;
  count: number;
  data: Medication[];
  message?: string;
}

export interface MedicationLogListResponse {
  success: boolean;
  count: number;
  data: MedicationLog[];
  message?: string;
}

export interface MarkDoseResponse {
  success: boolean;
  message?: string;
  data: MedicationLog;
}
