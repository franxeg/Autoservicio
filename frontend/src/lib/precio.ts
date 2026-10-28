// Precio de venta: SIEMPRE múltiplo de 100, redondeado hacia ARRIBA al próximo.
// Debe coincidir exactamente con backend/src/productos/productos.service.ts#calcularVenta
// y con backend/src/compras/compras.service.ts (confirmación de compra).
// (1e-6 absorbe el ruido de coma flotante para no empujar un múltiplo exacto al siguiente.)
export const multiplo100 = (n: number) => Math.ceil((Math.max(n, 0) - 1e-6) / 100) * 100;

export const calcularPrecioVenta = (costo: number, pctVenta: number, pctCrec: number) =>
  multiplo100(costo * (1 + pctVenta / 100) * (1 + pctCrec / 100));
