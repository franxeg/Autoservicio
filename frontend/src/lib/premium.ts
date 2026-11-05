// Sistema de licencias / premium (Fase 3 - frontend).
// Por ahora funciona en modo "trial local": 30 días gratis desde la primera ejecución.
// Cuando se implemente el backend de licencias (Fase 1/2), este módulo se conectará al servidor.

const TRIAL_DAYS = 30;
const STORAGE_KEY_TRIAL_START = 'premium_trial_start';
const STORAGE_KEY_PREMIUM = 'premium_activo';
const STORAGE_KEY_PREMIUM_EXPIRY = 'premium_expiry';
const STORAGE_KEY_LICENSE_KEY = 'license_key';

export interface PremiumStatus {
  isPremium: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  expiryDate: string | null;
  licenseKey: string | null;
}

function getTrialStart(): number {
  let v = localStorage.getItem(STORAGE_KEY_TRIAL_START);
  if (!v) {
    v = String(Date.now());
    localStorage.setItem(STORAGE_KEY_TRIAL_START, v);
  }
  return Number(v);
}

export function getPremiumStatus(): PremiumStatus {
  const licenseKey = localStorage.getItem(STORAGE_KEY_LICENSE_KEY);
  const premiumFlag = localStorage.getItem(STORAGE_KEY_PREMIUM) === 'true';
  const expiryRaw = localStorage.getItem(STORAGE_KEY_PREMIUM_EXPIRY);
  const expiry = expiryRaw ? Number(expiryRaw) : null;

  // Si tiene licencia premium activa y no venció
  if (licenseKey && premiumFlag && expiry && Date.now() < expiry) {
    return {
      isPremium: true,
      isTrial: false,
      trialDaysLeft: 0,
      expiryDate: new Date(expiry).toISOString(),
      licenseKey,
    };
  }

  // Trial: 30 días desde la primera ejecución
  const trialStart = getTrialStart();
  const trialEnd = trialStart + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)));

  if (Date.now() < trialEnd) {
    return {
      isPremium: true,
      isTrial: true,
      trialDaysLeft: daysLeft,
      expiryDate: new Date(trialEnd).toISOString(),
      licenseKey: null,
    };
  }

  // Venció el trial y no hay premium
  return {
    isPremium: false,
    isTrial: false,
    trialDaysLeft: 0,
    expiryDate: null,
    licenseKey: null,
  };
}

export function activatePremium(licenseKey: string, daysValid: number = 30): void {
  localStorage.setItem(STORAGE_KEY_LICENSE_KEY, licenseKey);
  localStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
  localStorage.setItem(STORAGE_KEY_PREMIUM_EXPIRY, String(Date.now() + daysValid * 24 * 60 * 60 * 1000));
}

export function deactivatePremium(): void {
  localStorage.removeItem(STORAGE_KEY_LICENSE_KEY);
  localStorage.removeItem(STORAGE_KEY_PREMIUM);
  localStorage.removeItem(STORAGE_KEY_PREMIUM_EXPIRY);
}

export function isPremiumActive(): boolean {
  return getPremiumStatus().isPremium;
}