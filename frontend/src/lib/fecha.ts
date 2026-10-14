const pad = (n: number) => String(n).padStart(2, '0');

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function fechaCorta(value?: string | Date | null) {
  const d = toDate(value);
  if (!d) return '-';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function horaCorta(value?: string | Date | null) {
  const d = toDate(value);
  if (!d) return '-';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fechaHora(value?: string | Date | null) {
  const d = toDate(value);
  if (!d) return '-';
  return `${fechaCorta(d)} ${horaCorta(d)}`;
}

// Para las fechas "aaaa-mm-dd" que manda el backend en listados por día:
// no se pueden pasar por new Date() porque lo interpreta como UTC y corre un día.
export function isoCorta(iso?: string | null) {
  if (!iso) return '-';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '-';
  return `${d}/${m}/${y}`;
}

// Mismo criterio para los gráficos: el día del mes sin ceros
export function isoDia(iso?: string | null) {
  if (!iso) return '';
  return String(iso).slice(8, 10);
}

export function isoMesCorto(iso?: string | null) {
  if (!iso) return '';
  return String(iso).slice(5, 7);
}

// Hoy en formato "aaaa-mm-dd" para mandar como parámetro al backend
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
