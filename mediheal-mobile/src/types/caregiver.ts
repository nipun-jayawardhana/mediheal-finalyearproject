/**
 * Caregiver Module Data Models & Service Types
 */

import { Medication, MedicationLog } from './medication';
import { EmergencyAlert } from './emergency';

export type CaregiverLinkStatus = 'active' | 'removed';

export interface LinkedPatientUser {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: string;
}

export interface LinkedPatientProfile {
  _id?: string;
  userId: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalConditions?: string[];
  allergies?: string[];
  caregiverLinkCode?: string;
}

export interface LinkedPatientItem {
  _id: string;
  relationship: string;
  status: CaregiverLinkStatus;
  linkedAt: string;
  patient: LinkedPatientUser;
  patientProfile?: LinkedPatientProfile;
}

export interface CaregiverAdherenceSummary {
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  adherencePercentage: number;
}

export interface CaregiverPatientOverview {
  relationship: string;
  linkedAt: string;
  patient: LinkedPatientUser;
  patientProfile?: LinkedPatientProfile;
  upcomingAppointments?: any[];
  recentConsultations?: any[];
  activeMedications?: Medication[];
  recentMedicationLogs?: MedicationLog[];
  recentEmergencyAlerts?: EmergencyAlert[];
  adherenceSummary?: CaregiverAdherenceSummary;
}

export interface LinkPatientPayload {
  caregiverLinkCode: string;
  relationship: string;
}

export interface CaregiverPatientListResponse {
  success: boolean;
  count: number;
  data: LinkedPatientItem[];
  message?: string;
}

export interface CaregiverPatientOverviewResponse {
  success: boolean;
  data: CaregiverPatientOverview;
  message?: string;
}

export interface CaregiverLinkResponse {
  success: boolean;
  message?: string;
  data: LinkedPatientItem;
}

export interface GenericCaregiverResponse {
  success: boolean;
  message?: string;
}

export interface AddMedicationPayload {
  patientId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
  startDate: string;
  endDate: string;
  instructions?: string;
}

export interface UpdateMedicationPayload {
  medicineName?: string;
  dosage?: string;
  frequency?: string;
  timeSlots?: string[];
  startDate?: string;
  endDate?: string;
  instructions?: string;
  isActive?: boolean;
}
