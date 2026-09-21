export type AdherenceStatus = 'PENDING' | 'TAKEN' | 'MISSED';

export interface TodayMedicationTask {
  _id: string;
  scheduleId: string;
  prescriptionId: string;
  doctorId?: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  scheduledTime: string;
  status: AdherenceStatus;
  takenAt: string | null;
  dayNumber?: number;
  scheduledDate: string;
}

export interface TodayMedicationResponse {
  success: boolean;
  count: number;
  data: TodayMedicationTask[];
}

export interface MarkScheduleTakenResponse {
  success: boolean;
  message: string;
  data: {
    _id: string;
    scheduleId: string;
    medicineName: string;
    dosage: string;
    scheduledTime: string;
    status: AdherenceStatus;
    takenAt: string | null;
    scheduledDate: string;
  };
}

export interface AdherenceHistoryItem {
  _id: string;
  scheduleId: string;
  medicineName: string;
  dosage: string;
  scheduledDate: string;
  scheduledTime: string;
  dayNumber: number;
  status: AdherenceStatus;
  takenAt: string | null;
  doctorName: string;
  instructions?: string;
}

export interface AdherenceStats {
  totalScheduled: number;
  totalTaken: number;
  adherencePercentage: number;
}

export interface MedicationHistoryResponse {
  success: boolean;
  count: number;
  stats: AdherenceStats;
  data: AdherenceHistoryItem[];
}
