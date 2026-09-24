/**
 * Emergency SOS Data Models & Service Types
 */

export type EmergencyStatus = 'active' | 'resolved' | 'cancelled';

export interface EmergencyAlert {
  _id: string;
  patientId:
    | string
    | {
        _id: string;
        fullName: string;
        email: string;
        phoneNumber?: string;
      };
  message: string;
  latitude?: number;
  longitude?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  caregiverIds?: string[];
  status: EmergencyStatus;
  cancellationReason?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEmergencyPayload {
  message: string;
  latitude?: number;
  longitude?: number;
}

export interface CancelEmergencyPayload {
  reason?: string;
}

export interface EmergencyResponse {
  success: boolean;
  message?: string;
  data: EmergencyAlert;
}

export interface EmergencyListResponse {
  success: boolean;
  count: number;
  data: EmergencyAlert[];
  message?: string;
}

// Phase 7.1 — Caregiver SOS Emergency Health Summary Types
export interface CaregiverEmergencyMedication {
  medicineName: string;
  dosage: string;
  frequency: string;
}

export interface CaregiverEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface CaregiverEmergencySummary {
  profileCompleted: boolean;
  bloodGroup: string;
  allergies: string[];
  hasNoKnownAllergies?: boolean;
  chronicConditions: string[];
  currentMedications: CaregiverEmergencyMedication[];
  emergencyContact: CaregiverEmergencyContact;
  emergencyNotes: string;
  unavailable?: boolean;
  message?: string;
}

export interface CaregiverEmergencyAlertSummaryResponse {
  success: boolean;
  alert: {
    alertId: string;
    patientId: string;
    triggeredAt: string;
    status: EmergencyStatus;
  };
  patient: {
    name: string;
    phone: string;
  };
  emergencySummary: CaregiverEmergencySummary | null;
  message?: string;
}
