// Cliente de licencias para el sistema SaaS.
// Se conecta al license-server para verificar el estado de la licencia.
// Soporta modo offline con grace period de 7 días.

const LICENSE_SERVER_URL = (import.meta as any).env?.VITE_LICENSE_SERVER_URL || 'https://autoservicio-license-server.onrender.com';
const GRACE_PERIOD_DAYS = 7;

const STORAGE_KEY_TOKEN = 'license_token';
const STORAGE_KEY_LICENSE_KEY = 'license_key';
const STORAGE_KEY_COMPANY = 'license_company';
const STORAGE_KEY_STATUS_CACHE = 'license_status_cache';
const STORAGE_KEY_LAST_CHECK = 'license_last_check';
const STORAGE_KEY_TRIAL_START = 'premium_trial_start';

export interface LicenseStatus {
  isPremium: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  expiryDate: string | null;
  licenseKey: string | null;
  nombre: string | null;
  offline: boolean;
}

interface CachedStatus {
  status: Omit<LicenseStatus, 'offline'>;
  timestamp: number;
}

function getCachedStatus(): CachedStatus | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATUS_CACHE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedStatus(status: Omit<LicenseStatus, 'offline'>) {
  const cached: CachedStatus = { status, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEY_STATUS_CACHE, JSON.stringify(cached));
  localStorage.setItem(STORAGE_KEY_LAST_CHECK, String(Date.now()));
}

function isGracePeriodValid(): boolean {
  const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
  if (!lastCheck) return false;
  const elapsed = Date.now() - Number(lastCheck);
  const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return elapsed < graceMs;
}

export function getLicenseToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function getLicenseKey(): string | null {
  return localStorage.getItem(STORAGE_KEY_LICENSE_KEY);
}

export function isRegistered(): boolean {
  return !!localStorage.getItem(STORAGE_KEY_TOKEN);
}

export async function registerCompany(nombre: string, email: string, password: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.message || 'Error al registrar' };

    localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
    localStorage.setItem(STORAGE_KEY_LICENSE_KEY, data.licenseKey);
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(data.company));
    setCachedStatus({
      isPremium: data.company.isPremium,
      isTrial: data.company.isTrial,
      trialDaysLeft: data.company.trialDaysLeft,
      expiryDate: data.company.trialEnd,
      licenseKey: data.licenseKey,
      nombre: data.company.nombre,
    });
    return { ok: true, message: data.message };
  } catch (e: any) {
    return { ok: false, message: 'No se pudo conectar al servidor. Verificá tu conexión a internet.' };
  }
}

export async function loginCompany(email: string, password: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.message || 'Error al iniciar sesión' };

    localStorage.setItem(STORAGE_KEY_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEY_LICENSE_KEY, data.company.licenseKey);
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(data.company));
    setCachedStatus({
      isPremium: data.company.isPremium,
      isTrial: data.company.isTrial,
      trialDaysLeft: data.company.trialDaysLeft,
      expiryDate: data.company.premiumExpiry || data.company.trialEnd,
      licenseKey: data.company.licenseKey,
      nombre: data.company.nombre,
    });
    return { ok: true, message: 'Sesión iniciada correctamente' };
  } catch (e: any) {
    return { ok: false, message: 'No se pudo conectar al servidor. Verificá tu conexión a internet.' };
  }
}

export async function checkLicenseStatus(): Promise<LicenseStatus> {
  const token = getLicenseToken();

  // Si no está registrado, usar trial local
  if (!token) {
    const trialStart = localStorage.getItem(STORAGE_KEY_TRIAL_START);
    if (!trialStart) {
      localStorage.setItem(STORAGE_KEY_TRIAL_START, String(Date.now()));
    }
    const start = Number(localStorage.getItem(STORAGE_KEY_TRIAL_START) || Date.now());
    const trialEnd = start + 30 * 24 * 60 * 60 * 1000;
    const daysLeft = Math.max(0, Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)));
    const isTrial = Date.now() < trialEnd;
    return {
      isPremium: isTrial,
      isTrial,
      trialDaysLeft: daysLeft,
      expiryDate: new Date(trialEnd).toISOString(),
      licenseKey: null,
      nombre: null,
      offline: false,
    };
  }

  // Intentar consultar al servidor
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/license/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const status: Omit<LicenseStatus, 'offline'> = {
        isPremium: data.isPremium,
        isTrial: data.isTrial,
        trialDaysLeft: data.trialDaysLeft,
        expiryDate: data.premiumExpiry || data.trialEnd,
        licenseKey: data.licenseKey,
        nombre: data.nombre,
      };
      setCachedStatus(status);
      return { ...status, offline: false };
    }
    // Token inválido o error del servidor
    if (res.status === 401) {
      // Token expirado, limpiar
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  } catch {
    // Sin conexión a internet
  }

  // Modo offline: usar cache si está dentro del grace period
  const cached = getCachedStatus();
  if (cached && isGracePeriodValid()) {
    return { ...cached.status, offline: true };
  }

  // Sin cache válido ni conexión: degradar a modo free
  return {
    isPremium: false,
    isTrial: false,
    trialDaysLeft: 0,
    expiryDate: null,
    licenseKey: getLicenseKey(),
    nombre: null,
    offline: true,
  };
}

export function logoutLicense() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_LICENSE_KEY);
  localStorage.removeItem(STORAGE_KEY_COMPANY);
  localStorage.removeItem(STORAGE_KEY_STATUS_CACHE);
  localStorage.removeItem(STORAGE_KEY_LAST_CHECK);
}