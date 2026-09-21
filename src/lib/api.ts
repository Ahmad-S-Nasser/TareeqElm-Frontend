import axios, { AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'https://localhost:9889/api' : '');
if (!baseURL) {
  throw new Error('VITE_API_URL is not set. Configure it in the environment for production builds.');
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// AuthProvider registers a callback here so an expired/invalid session signs the user out of React state too.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

// Add a request interceptor to add the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tareeqelm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const isAuthCall = url.includes('/Auth/');
    // A 401 on a normal call means the token is missing, expired or rejected: end the session.
    if (error.response?.status === 401 && !isAuthCall) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

/**
 * Turns any API failure into a readable message.
 * Handles plain-string bodies, ASP.NET ProblemDetails / validation errors, rate limiting and network errors.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getApiError = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (!axios.isAxiosError(error)) {
    return (isRecord(error) && typeof error.message === 'string' && error.message) || fallback;
  }
  if (!error.response) return 'Cannot reach the server. Check your connection and try again.';

  const { status, data } = error.response as { status: number; data: unknown };
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status >= 500) return 'The server ran into a problem. Please try again in a moment.';
  if (typeof data === 'string' && data.trim()) return data;
  if (isRecord(data)) {
    if (isRecord(data.errors)) {
      const first = Object.values(data.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.title === 'string') return data.title;
  }
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 409) return 'This conflicts with existing data. Refresh the page and try again.';
  return fallback;
};

export default api;
