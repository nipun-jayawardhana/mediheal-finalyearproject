export type EmergencyBloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-'
  | 'Unknown';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface EmergencyMedication {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  startDate?: string;
  endDate?: string;
}

export interface EmergencyPatientInfo {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string | null;
  gender?: string | null;
}

export interface EmergencyHealthProfileData {
  patient: EmergencyPatientInfo;
  bloodGroup: EmergencyBloodGroup;
  allergies: string[];
  hasNoKnownAllergies: boolean;
  chronicConditions: string[];
  emergencyContact: EmergencyContact;
  emergencyNotes: string;
  currentMedications: EmergencyMedication[];
  isCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateEmergencyProfilePayload {
  bloodGroup?: EmergencyBloodGroup;
  allergies?: string[];
  hasNoKnownAllergies?: boolean;
  chronicConditions?: string[];
  emergencyContact?: EmergencyContact;
  emergencyNotes?: string;
}

export interface EmergencyProfileResponse {
  success: boolean;
  data: EmergencyHealthProfileData | null;
  message?: string;
}
