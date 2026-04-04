import axios from 'axios';

/** Public API base URL (set in Vercel as NEXT_PUBLIC_API_URL). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || '';

function isLocalBrowserHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

/**
 * When env is unset, assume API on :3001 during local browser dev (Next on any localhost port).
 * Production hostnames never match → keep using NEXT_PUBLIC_API_URL only.
 */
function browserLocalApiFallback(): string {
  if (typeof window === 'undefined') return '';
  if (!isLocalBrowserHost(window.location.hostname)) return '';
  return 'http://localhost:3001';
}

/** Base URL of the API (for building image URLs etc.). */
export function getApiBaseUrl(): string {
  return API_URL || browserLocalApiFallback();
}

/**
 * Dish/menu image URLs from the API: absolute https URLs pass through;
 * root-relative paths (`/upload/...`) are prefixed with the API origin.
 */
export function resolvePublicMediaUrl(url: string | null | undefined): string {
  const t = url?.trim() ?? '';
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  const base = getApiBaseUrl();
  if (t.startsWith('/') && base) {
    return `${base.replace(/\/$/, '')}${t}`;
  }
  return t;
}

const api = axios.create({
  baseURL: API_URL || undefined,
  timeout: 15000, // 15s so the app doesn't hang if the API is unreachable
});

// Attach JWT when present (used for both admin and end-user auth)
api.interceptors.request.use((config) => {
  const base = getApiBaseUrl();
  if (base) {
    config.baseURL = base.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// On 401, clear token and redirect to admin login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
export const setAdminToken = (token: string) => {
  if (typeof window !== 'undefined') localStorage.setItem('adminToken', token);
};
export const getAdminToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
export const clearAdminToken = () => {
  if (typeof window !== 'undefined') localStorage.removeItem('adminToken');
};
