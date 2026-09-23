export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export interface AdherenceSummary {
  totalScheduledEvaluated: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
  adherencePercentage: number | null;
  hasEnoughData: boolean;
}

export interface DailyTrendItem {
  date: string; // 'YYYY-MM-DD'
  taken: number;
  missed: number;
  percentage: number | null;
}

export interface MedicationBreakdownItem {
  scheduleId: string;
  prescriptionId: string;
  medicineName: string;
  dosage: string;
  taken: number;
  missed: number;
  pending: number;
  totalEvaluated: number;
  adherencePercentage: number | null;
}

export interface MissedTimeItem {
  time: string; // 'HH:mm'
  missedCount: number;
}

export interface MedicationAnalyticsResponse {
  success: boolean;
  range: AnalyticsRange;
  summary: AdherenceSummary;
  dailyTrend: DailyTrendItem[];
  medications: MedicationBreakdownItem[];
  missedByTime: MissedTimeItem[];
  patient?: {
    _id: string;
    fullName: string;
    email?: string;
  };
  message?: string;
}
