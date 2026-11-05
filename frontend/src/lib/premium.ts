// Sistema de licencias / premium.
// Se integra con lib/license.ts para verificar contra el servidor.
// Soporta modo offline con grace period.

import { checkLicenseStatus, isRegistered } from './license';

export interface PremiumStatus {
  isPremium: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  expiryDate: string | null;
  licenseKey: string | null;
  offline: boolean;
}

const STORAGE_KEY_TRIAL_START = 'premium_trial_start';

function getTrialStart(): number {
  let v = localStorage.getItem(STORAGE_KEY_TRIAL_START);
  if (!v) {
    v = String(Date.now());
    localStorage.setItem(STORAGE_KEY_TRIAL_START, v);
  }
  return Number(v);
}

// Sincrónico: usa cache o trial local
export function getPremiumStatus(): PremiumStatus {
  const cached = localStorage.getItem('license_status_cache');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const status = parsed.status || parsed;
      if (status) {
        return {
          isPremium: !!status.isPremium,
          isTrial: !!status.isTrial,
          trialDaysLeft: status.trialDaysLeft || 0,
          expiryDate: status.expiryDate || null,
          licenseKey: status.licenseKey || null,
          offline: false,
        };
      }
    } catch {}
  }

  // Si no está registrado, usar trial local de 30 días
  if (!isRegistered()) {
    const trialStart = getTrialStart();
    const trialEnd = trialStart + 30 * 24 * 60 * 60 * 1000;
    const daysLeft = Math.max(0, Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)));
    const isTrial = Date.now() < trialEnd;
    return {
      isPremium: isTrial,
      isTrial,
      trialDaysLeft: daysLeft,
      expiryDate: new Date(trialEnd).toISOString(),
      licenseKey: null,
      offline: false,
    };
  }

  // Registrado pero sin cache: asumir no premium (se actualizará al hacer check)
  return {
    isPremium: false,
    isTrial: false,
    trialDaysLeft: 0,
    expiryDate: null,
    licenseKey: null,
    offline: true,
  };
}

// Asincrónico: consulta al servidor y actualiza cache
export async function refreshPremiumStatus(): Promise<PremiumStatus> {
  const status = await checkLicenseStatus();
  return {
    isPremium: status.isPremium,
    isTrial: status.isTrial,
    trialDaysLeft: status.trialDaysLeft,
    expiryDate: status.expiryDate,
    licenseKey: status.licenseKey,
    offline: status.offline,
  };
}

export function isPremiumActive(): boolean {
  return getPremiumStatus().isPremium;
}

export function activatePremium(licenseKey: string, daysValid: number = 30): void {
  localStorage.setItem('license_key', licenseKey);
  localStorage.setItem('premium_activo', 'true');
  localStorage.setItem('premium_expiry', String(Date.now() + daysValid * 24 * 60 * 60 * 1000));
  // También actualizar cache
  const cached = {
    status: {
      isPremium: true,
      isTrial: false,
      trialDaysLeft: 0,
      expiryDate: new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString(),
      licenseKey,
    },
    timestamp: Date.now(),
  };
  localStorage.setItem('license_status_cache', JSON.stringify(cached));
}