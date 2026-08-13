/**
 * Doctor Profile & User Interface Definitions
 */

export interface DoctorUser {
  _id: string; // User ID
  fullName: string;
  email: string;
  phoneNumber?: string;
  preferredLanguage?: string;
  isActive?: boolean;
}

export interface DoctorProfile {
  _id: string; // DoctorProfile Document ID
  userId: DoctorUser; // Populated Doctor User Object
  slmcNumber: string;
  specialization: string;
  hospital: string;
  yearsOfExperience: number;
  consultationFee: number;
  languages: string[];
  availableDays: string[];
  availableTimeSlots: string[];
  biography?: string;
  location?: string;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DoctorQueryParams {
  specialization?: string;
  hospital?: string;
  search?: string;
  language?: string;
  isAvailable?: boolean;
}

export interface DoctorListResponse {
  success: boolean;
  count: number;
  data: DoctorProfile[];
  message?: string;
}

export interface DoctorDetailsResponse {
  success: boolean;
  data: DoctorProfile;
  message?: string;
}
