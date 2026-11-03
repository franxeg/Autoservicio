export const getNombreEmpresa = (): string => {
  try {
    const keys = ['nombreEmpresa', 'empresaNombre', 'empresa', 'razonSocial', 'razon_social', 'configEmpresa', 'empresa_config', 'nombre', 'titulo', 'appNombre', 'nombre_comercio', 'comercio', 'negocioNombre'];
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
        if (v.trim()) return v.trim();
      }
    }
    // Buscar en cualquier clave que contenga empresa/nombre/razon/comercio
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
          if (v.trim()) return v.trim();
        }
      }
    }
  } catch {}
  return 'Autoservicio';
};

export const NOMBRE_EMPRESA = getNombreEmpresa();

