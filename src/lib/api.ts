import axios, { AxiosError } from 'axios';
import i18n from '@/i18n';
import { normalizeLanguage } from '@/i18n/config';

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
    // Lets the backend localise its own messages / emails to the user's active language.
    config.headers['Accept-Language'] = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
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

export const getApiError = (error: unknown, fallback?: string): string => {
  const t = (key: string) => i18n.t(key, { ns: 'errors' });
  const fallbackText = fallback ?? t('generic');
  if (!axios.isAxiosError(error)) {
    return (isRecord(error) && typeof error.message === 'string' && error.message) || fallbackText;
  }
  if (!error.response) return t('network');

  const { status, data } = error.response as { status: number; data: unknown };
  if (status === 429) return t('tooManyRequests');
  if (status >= 500) return t('server');
  if (isRecord(data)) {
    if (isRecord(data.errors)) {
      const first = Object.values(data.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    // Business-rule errors carry a stable `code` and a title the server already localised for the
    // Accept-Language header we send, so it is more specific than the generic status messages below.
    if (typeof data.code === 'string' && typeof data.title === 'string' && data.title.trim()) return data.title;
  }
  if (status === 403) return t('forbidden');
  if (typeof data === 'string' && data.trim()) return data;
  if (isRecord(data)) {
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.title === 'string') return data.title;
  }
  if (status === 404) return t('notFound');
  if (status === 409) return t('conflict');
  return fallbackText;
};

export default api;
