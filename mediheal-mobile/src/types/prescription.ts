export interface PrescribedMedicine {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface DoctorSummary {
  _id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  specialization?: string;
  hospital?: string;
  slmcNumber?: string;
}

export interface Prescription {
  _id: string;
  patientId: string | { _id: string; fullName: string; email: string };
  doctorId: string | { _id: string; fullName: string; email?: string; phoneNumber?: string };
  doctorDetails?: {
    fullName: string;
    email?: string;
    phoneNumber?: string;
    specialization?: string;
    hospital?: string;
    slmcNumber?: string;
  };
  appointmentId?: string | {
    _id: string;
    appointmentDate: string;
    timeSlot: string;
    status: string;
  };
  consultationId?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  medications: PrescribedMedicine[];
  status: 'active' | 'completed' | 'discontinued';
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePrescriptionPayload {
  patientId: string;
  appointmentId?: string;
  consultationId?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  medications: PrescribedMedicine[];
}

export interface PrescriptionListResponse {
  success: boolean;
  count: number;
  data: Prescription[];
  message?: string;
}

export interface PrescriptionDetailsResponse {
  success: boolean;
  data: Prescription;
  message?: string;
}
