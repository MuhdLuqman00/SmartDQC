import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('smartdqc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('smartdqc_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const BASE = BASE_URL;
