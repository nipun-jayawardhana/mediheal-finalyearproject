/**
 * Admin Module Data Models & Service Types
 */

export interface AdminDoctorUser {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  preferredLanguage?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface AdminDoctor {
  _id: string; // Canonical DoctorProfile ID
  userId: AdminDoctorUser;
  slmcNumber: string;
  specialization: string;
  hospital: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  languages?: string[];
  availableDays?: string[];
  availableTimeSlots?: string[];
  biography?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDoctorRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  slmcNumber: string;
  specialization: string;
  hospital: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  languages?: string[];
  availableDays?: string[];
  availableTimeSlots?: string[];
  biography?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  isAvailable?: boolean;
  password?: string;
}

export interface UpdateDoctorRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  slmcNumber?: string;
  specialization?: string;
  hospital?: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  languages?: string[];
  availableDays?: string[];
  availableTimeSlots?: string[];
  biography?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  isAvailable?: boolean;
}

export interface DoctorStatusRequest {
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface AdminDoctorListResponse {
  success: boolean;
  count: number;
  data: AdminDoctor[];
  message?: string;
}

export interface AdminDoctorDetailResponse {
  success: boolean;
  data: AdminDoctor;
  message?: string;
}

export interface CreateDoctorData {
  doctor: AdminDoctor;
  temporaryPassword?: string;
}

export interface CreateDoctorResponse {
  success: boolean;
  message?: string;
  data: CreateDoctorData;
}

export interface GenericAdminResponse {
  success: boolean;
  message?: string;
}
