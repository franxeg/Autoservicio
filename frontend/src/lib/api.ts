import axios from 'axios';
import { useAuthStore } from './store';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Solo inyectar el token de cliente si la request no trae uno propio (ej. token de proveedor)
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Inyectar sucursal activa si existe
  const sucursalId = localStorage.getItem('sucursalId');
  if (sucursalId) {
    config.headers['x-sucursal-id'] = sucursalId;
  }
  return config;
});

// Si el token del usuario expiró, cerramos sesión y volvemos al login prolijamente.
// No aplica al login ni a peticiones con token de proveedor (esas se manejan aparte).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    if (status === 401 && !url.includes('/auth/login')) {
      const mainToken = localStorage.getItem('token');
      const sentAuth = error?.config?.headers?.Authorization;
      if (mainToken && sentAuth === `Bearer ${mainToken}`) {
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
