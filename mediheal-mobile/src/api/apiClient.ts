import axios from 'axios';
import { API_URL } from '../config/env';
import { getToken } from '../utils/authStorage';

/**
 * Centralized Axios HTTP Client
 * Configured with base URL, timeout, standard headers, and JWT interceptor.
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Automatically attach Bearer token if available
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error retrieving token in Axios interceptor:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Friendly error formatting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage = 'An unexpected network error occurred. Please try again.';

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      // Request timeout
      errorMessage = 'Symptom analysis is taking longer than expected. Please try again.';
    } else if (error.response) {
      // Server responded with error status code (e.g. 400, 401, 403, 404, 500)
      errorMessage =
        error.response.data?.message ||
        `Server returned error (${error.response.status})`;
    } else if (error.request) {
      // Request sent but no response received (Server unreachable / network down)
      errorMessage =
        'Unable to connect to MediHeal server. Please check your network connection and server status.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return Promise.reject({
      message: errorMessage,
      statusCode: error.response?.status,
      originalError: error,
    });
  }
);
