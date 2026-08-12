import { User } from './auth';

export type GenderType = 'male' | 'female' | 'other';
export type BloodGroupType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface PatientProfile {
  _id: string;
  userId: string | User;
  dateOfBirth: string;
  gender: GenderType;
  bloodGroup: BloodGroupType;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions: string[];
  allergies: string[];
  caregiverLinkCode: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePatientProfilePayload {
  dateOfBirth: string;
  gender: GenderType;
  bloodGroup: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string[];
  allergies?: string[];
}

export interface UpdatePatientProfilePayload {
  dateOfBirth?: string;
  gender?: GenderType;
  bloodGroup?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalConditions?: string[];
  allergies?: string[];
}

export interface PatientProfileResponse {
  success: boolean;
  message: string;
  data: {
    profile: PatientProfile;
  };
}

export interface PatientDashboardData {
  user: User;
  patientProfile: PatientProfile | null;
  medications: any[];
  upcomingAppointments: any[];
  latestSymptomCheck: any | null;
  activeEmergencyAlert: any | null;
}

export interface PatientDashboardResponse {
  success: boolean;
  message: string;
  data: PatientDashboardData;
}
