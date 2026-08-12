import { apiClient } from '../api/apiClient';
import {
  AuthResponse,
  LoginRequest,
  MeResponse,
  RegisterRequest,
} from '../types/auth';

/**
 * Register a new Patient or Caregiver user.
 * Endpoint: POST /api/auth/register
 */
export const registerUserApi = async (
  data: RegisterRequest
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/register', data);
  return response.data;
};

/**
 * Authenticate user credentials and retrieve JWT token.
 * Endpoint: POST /api/auth/login
 */
export const loginUserApi = async (
  data: LoginRequest
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);
  return response.data;
};

/**
 * Validate current JWT token and retrieve fresh user profile.
 * Endpoint: GET /api/auth/me
 */
export const getCurrentUserApi = async (): Promise<MeResponse> => {
  const response = await apiClient.get<MeResponse>('/auth/me');
  return response.data;
};
