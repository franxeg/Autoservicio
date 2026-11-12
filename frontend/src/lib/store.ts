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
    // Preservar preferencias de tema por usuario
    const keep: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('tema_color_') || k.startsWith('tema_fontSize_'))) {
        keep[k] = localStorage.getItem(k) || '';
      }
    }
    localStorage.clear();
    Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
    // Limpiar tema aplicado en memoria para que no arrastre al siguiente usuario
    localStorage.removeItem('tema_color');
    localStorage.removeItem('tema_fontSize');
    localStorage.removeItem('tema_modo');
    set({ token: null, user: null, sucursalId: null });
  },
}));
