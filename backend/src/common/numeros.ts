// Los precios e importes se manejan como enteros; las cantidades pueden llevar
// decimales (ej. productos por peso: 0,735 kg). Se redondean a 3 decimales (gramos).
export function redondearCantidad(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}
