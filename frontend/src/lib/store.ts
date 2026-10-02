import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: any | null;
  sucursalId: string | null;
  setAuth: (token: string, user: any) => void;
  setSucursal: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  sucursalId: localStorage.getItem('sucursalId'),
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  setSucursal: (id) => {
    localStorage.setItem('sucursalId', id);
    set({ sucursalId: id });
  },
  logout: () => {
    localStorage.clear();
    set({ token: null, user: null });
  },
}));
