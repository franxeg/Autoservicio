import axios from 'axios';

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
