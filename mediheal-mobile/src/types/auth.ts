export type UserRole = 'patient' | 'caregiver' | 'doctor' | 'admin';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  preferredLanguage?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'patient' | 'caregiver';
  preferredLanguage?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface MeResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
  };
}
