import axios from 'axios';
import { API_URL } from '../config/env';

/**
 * Centralized Axios HTTP Client
 * Configured with base URL, timeout, and standard headers.
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Response interceptor for friendly error formatting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage = 'An unexpected network error occurred. Please try again.';

    if (error.response) {
      // Server responded with error status code
      errorMessage =
        error.response.data?.message ||
        `Server returned error (${error.response.status})`;
    } else if (error.request) {
      // Request sent but no response received (Network timeout / server unreachable)
      errorMessage =
        'Unable to connect to MediHeal server. Please check your network connection and server status.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return Promise.reject({
      message: errorMessage,
      originalError: error,
    });
  }
);
