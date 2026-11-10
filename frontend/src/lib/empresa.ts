export const getNombreEmpresa = (): string => {
  // Solo mostrar nombre de empresa si es premium
  const esPremium = (() => {
    try {
      const cache = localStorage.getItem('license_status_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        const status = parsed?.status || parsed;
        if (status?.isPremium) return true;
      }
      const trialStart = localStorage.getItem('premium_trial_start');
      if (trialStart) {
        const trialEnd = Number(trialStart) + 30 * 24 * 60 * 60 * 1000;
        if (Date.now() < trialEnd) return true;
      }
      return localStorage.getItem('premium_activo') === 'true';
    } catch { return false; }
  })();
  if (!esPremium) return 'Autoservicio';

  try {
    // 1) Intentar desde el usuario logueado (localStorage 'user')
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        const n = u?.empresa?.nombre || u?.empresaNombre || u?.nombreEmpresa;
        if (n && String(n).trim()) return String(n).trim();
      } catch {}
    }
    // 2) Claves directas
    const keys = ['nombreEmpresa', 'empresaNombre', 'razonSocial', 'razon_social', 'nombre_comercio', 'comercio', 'negocioNombre', 'empresa'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) {
        try {
          const parsed = JSON.parse(v);
          if (parsed && typeof parsed === 'object') {
            const candidates = [parsed.nombre, parsed.razonSocial, parsed.empresa, parsed.nombreEmpresa, parsed.titulo, parsed.razon_social, parsed.nombreComercio];
            for (const c of candidates) {
              if (c && String(c).trim()) return String(c).trim();
            }
          } else if (typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
          }
        } catch {}
        // Si no es JSON, usar el valor directo solo si no parece un objeto
        if (!v.trim().startsWith('{')) return v.trim();
      }
    }
    // 3) Buscar en cualquier clave que contenga empresa/nombre/razon/comercio
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const kl = k.toLowerCase();
      if (kl.includes('empresa') || kl.includes('razon') || kl.includes('negocio') || kl.includes('comercio') || kl.includes('establecimiento')) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const parsed = JSON.parse(v);
          if (parsed && typeof parsed === 'object') {
            const candidates = [parsed.nombre, parsed.razonSocial, parsed.empresa, parsed.nombreEmpresa, parsed.razon_social, parsed.nombreComercio];
            for (const c of candidates) {
              if (c && String(c).trim()) return String(c).trim();
            }
          } else if (typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
          }
        } catch {
          if (v.trim() && !v.trim().startsWith('{')) return v.trim();
        }
      }
    }
  } catch {}
  return 'Autoservicio';
};

export const NOMBRE_EMPRESA = getNombreEmpresa();

