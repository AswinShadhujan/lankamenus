import axios from 'axios';
import { getAuthToken, clearAuthToken } from './auth-storage';

const baseURL =
  typeof process.env.EXPO_PUBLIC_API_URL !== 'undefined' && process.env.EXPO_PUBLIC_API_URL !== ''
    ? process.env.EXPO_PUBLIC_API_URL
    : 'http://10.0.2.2:3001'; // Android emulator default; use EXPO_PUBLIC_API_URL for iOS (e.g. localhost) or prod

const api = axios.create({
  baseURL,
  timeout: 5000,
});

api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await clearAuthToken();
    }
    return Promise.reject(err);
  },
);

export default api;
