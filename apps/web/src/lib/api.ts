import axios from 'axios';

const baseURL =
  typeof process.env.NEXT_PUBLIC_API_URL !== 'undefined' && process.env.NEXT_PUBLIC_API_URL !== ''
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:3001';

/** Base URL of the API (for building image URLs etc.). */
export function getApiBaseUrl(): string {
  return baseURL;
}

const api = axios.create({
  baseURL,
  timeout: 15000, // 15s so the app doesn't hang if the API is unreachable
});

// Attach JWT when present (used for both admin and end-user auth)
api.interceptors.request.use((config) => {
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