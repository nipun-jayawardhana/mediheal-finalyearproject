export interface MissedMedicationItem {
  _id: string;
  scheduleId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  status: 'MISSED';
  scheduledDate: string;
  instructions?: string;
}

export interface MissedMedicationResponse {
  success: boolean;
  count: number;
  data: MissedMedicationItem[];
}

export interface CaregiverMissedMedicationItem {
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  medicine: string;
  dosage: string;
  time: string;
  scheduledTime24: string;
  scheduledDate: string;
  status: 'MISSED';
  scheduleId: string;
  recordId: string;
  instructions?: string;
}

export interface CaregiverMissedMedicationResponse {
  success: boolean;
  count: number;
  data: CaregiverMissedMedicationItem[];
}

export interface CaregiverPatientTodayMedicationTask {
  _id: string;
  scheduleId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledTimeFormatted: string;
  status: 'PENDING' | 'TAKEN' | 'MISSED';
  takenAt: string | null;
  instructions?: string;
}

export interface CaregiverPatientTodayMedicationResponse {
  success: boolean;
  count: number;
  data: CaregiverPatientTodayMedicationTask[];
}
