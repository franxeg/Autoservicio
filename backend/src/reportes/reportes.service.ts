import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  async dashboard(sucursalId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const whereSucursal = sucursalId ? { sucursalId } : {};
    const whereHoy = { ...whereSucursal, fecha: { gte: today }, estado: 'COMPLETADA' as const };
    const whereMes = { ...whereSucursal, fecha: { gte: firstDayMonth }, estado: 'COMPLETADA' as const };

    const [ventasHoyAgg, ventasMesAgg, ventasTotalAgg, totalProductos, clientesDeudores, cajaAbierta, stockCriticoAll] = await Promise.all([
      this.prisma.tenant.venta.aggregate({ where: whereHoy, _sum: { total: true }, _count: true }),
      this.prisma.tenant.venta.aggregate({ where: whereMes, _sum: { total: true }, _count: true }),
      this.prisma.tenant.venta.aggregate({ where: { ...whereSucursal, estado: 'COMPLETADA' }, _sum: { total: true }, _count: true }),
      this.prisma.tenant.producto.count({ where: { activo: true } }),
      this.prisma.tenant.cliente.aggregate({ where: { saldoCuenta: { gt: 0 } }, _sum: { saldoCuenta: true }, _count: true }),
      this.prisma.tenant.caja.findFirst({ where: { ...whereSucursal, estado: 'ABIERTA' } }),
      this.prisma.tenant.stock.findMany({
        where: { ...(sucursalId ? { sucursalId } : {}), producto: { unidad: { not: 'KG' }, activo: true } },
        include: { producto: { select: { nombre: true, codigoBarras: true } }, sucursal: { select: { nombre: true } } },
        orderBy: { cantidad: 'asc' },
      }),
    ]);
    const stockCritico = stockCriticoAll.filter(s => s.cantidad <= s.stockMinimo);

    // Ticket promedio (sobre total histórico) y del mes
    const ticketPromedio = ventasTotalAgg._count > 0 ? Math.round((ventasTotalAgg._sum.total || 0) / ventasTotalAgg._count) : 0;
    const ticketMes = ventasMesAgg._count > 0 ? Math.round((ventasMesAgg._sum.total || 0) / ventasMesAgg._count) : 0;

    // Ventas por día últimos 7 días + mes corriente por día
    const ventasPorDia = await this.ventasPorDia(sucursalId, 7);
    const ventasMesPorDia = await this.ventasPorDiaMes(sucursalId);

    // Top 5 productos más vendidos (por cantidad)
    const topProductos = await this.prisma.tenant.detalleVenta.groupBy({
      by: ['productoId'],
      where: { venta: { ...whereSucursal, estado: 'COMPLETADA' } },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 5,
    });
    const topConNombres = await Promise.all(
      topProductos.map(async (t) => {
        const prod = await this.prisma.tenant.producto.findUnique({ where: { id: t.productoId }, select: { nombre: true, codigoBarras: true } });
        return { productoId: t.productoId, nombre: prod?.nombre || 'Desconocido', codigoBarras: prod?.codigoBarras, cantidad: t._sum.cantidad, total: t._sum.subtotal };
      }),
    );

    return {
      ventasHoy: { total: ventasHoyAgg._sum.total || 0, cantidad: ventasHoyAgg._count },
      ventasEsteMes: { total: ventasMesAgg._sum.total || 0, cantidad: ventasMesAgg._count, ticketPromedio: ticketMes },
      ventasTotal: { total: ventasTotalAgg._sum.total || 0, cantidad: ventasTotalAgg._count, ticketPromedio },
      productos: { total: totalProductos },
      clientesDeudores: { total: clientesDeudores._sum.saldoCuenta || 0, cantidad: clientesDeudores._count },
      cajaAbierta: cajaAbierta ? { id: cajaAbierta.id, montoInicial: cajaAbierta.montoInicial, estado: cajaAbierta.estado } : null,
      stockCritico: stockCritico.slice(0, 20).map(s => ({ producto: s.producto.nombre, codigo: s.producto.codigoBarras, sucursal: s.sucursal.nombre, cantidad: s.cantidad, minimo: s.stockMinimo })),
      stockCriticoCount: stockCritico.length,
      ventasPorDia,
      ventasMesPorDia,
      topProductos: topConNombres,
    };
  }

  // Rango de fechas para el desglose: hoy | 7d | mes (por defecto mes).
  // Si se pasa un mes puntual "aaaa-mm" (param `mes`), se usa ese mes calendario.
  private rango(periodo?: string, mes?: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const m = /^(\d{4})-(\d{2})$/.exec(mes || '');
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      if (mo >= 1 && mo <= 12) return { gte: new Date(y, mo - 1, 1), lt: new Date(y, mo, 1) };
    }
    if (periodo === 'hoy') return { gte: hoy };
    if (periodo === '7d') {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 6);
      return { gte: desde };
    }
    return { gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1) };
  }

  // Desglose de cada precio vendido: costo + aporte del %crecimiento + aporte del %venta
  async desglose(sucursalId?: string, periodo?: string, mes?: string) {
    const where: any = { estado: 'COMPLETADA', fecha: this.rango(periodo, mes) };
    if (sucursalId) where.sucursalId = sucursalId;

    const [ventas, detalles] = await Promise.all([
      this.prisma.tenant.venta.count({ where }),
      this.prisma.tenant.detalleVenta.findMany({
        where: { venta: where },
        include: { producto: { select: { id: true, nombre: true, codigoBarras: true, unidad: true } } },
      }),
    ]);

    const total = { vendido: 0, costo: 0, aporteVenta: 0, aporteCrecimiento: 0, sinDato: 0, unidades: 0, lineas: 0, lineasSinFoto: 0 };
    const porProducto = new Map<string, any>();

    for (const d of detalles) {
      const vendido = Math.round(d.subtotal);
      const cant = Number(d.cantidad) || 0; // puede ser fraccionario (kg)
      const completo = d.precioCosto != null && d.aporteVenta != null && d.aporteCrecimiento != null;
      const costo = completo ? Math.round(Math.round(d.precioCosto) * cant) : 0;
      const aporteCrecimiento = completo ? Math.round(Math.round(d.aporteCrecimiento) * cant) : 0;
      // El precio de venta se redondea al múltiplo de 100, por lo que puede sobrar unos pesos
      // sobre costo + %crecimiento + %venta. Ese sobrante lo absorbemos en "utilidad % de venta"
      // para que costo + %crec + %venta siempre dé el total vendido.
      const aporteBase = completo ? Math.round(Math.round(d.aporteVenta) * cant) : 0;
      let aporteVenta = aporteBase + (completo ? Math.max(0, vendido - costo - aporteBase - aporteCrecimiento) : 0);
      // Si viene repartido por combo, respetamos lo guardado (ya viene calculado proporcionalmente)
      if ((d as any).esComboItem || (d as any).comboId) {
        aporteVenta = aporteBase;
      }
      const sinDato = completo ? 0 : vendido;

      total.vendido += vendido;
      total.costo += costo;
      total.aporteVenta += aporteVenta;
      total.aporteCrecimiento += aporteCrecimiento;
      total.sinDato += sinDato;
      total.unidades += Math.round(cant);
      total.lineas += 1;
      if (!completo) total.lineasSinFoto += 1;

      let p = porProducto.get(d.productoId);
      if (!p) {
        p = { productoId: d.productoId, nombre: d.producto?.nombre || 'Desconocido', codigoBarras: d.producto?.codigoBarras, unidad: d.producto?.unidad || 'UNIDAD', unidades: 0, cantidad: 0, vendido: 0, costo: 0, aporteVenta: 0, aporteCrecimiento: 0, sinDato: 0 };
        porProducto.set(d.productoId, p);
      }
      p.unidades += Math.round(cant);
      p.cantidad += cant;
      p.vendido += vendido;
      p.costo += costo;
      p.aporteVenta += aporteVenta;
      p.aporteCrecimiento += aporteCrecimiento;
      p.sinDato += sinDato;
    }

    return {
      periodo: periodo || 'mes',
      mes: mes || null,
      ventas,
      ...total,
      porProducto: [...porProducto.values()].sort((a, b) => b.vendido - a.vendido),
    };
  }

  // Rango por días calendario (acepta "aaaa-mm-dd"). Se calcula en hora local del servidor.
  private isoLocal(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private rangoDias(desde?: string, hasta?: string) {
    const parse = (s?: string) => {
      if (!s) return null;
      const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    };
    const ini = parse(desde) || new Date();
    ini.setHours(0, 0, 0, 0);
    const fin = parse(hasta) || new Date(ini);
    fin.setHours(0, 0, 0, 0);
    const finLt = new Date(fin);
    finLt.setDate(fin.getDate() + 1);
    return { ini, fin, finLt };
  }

  // Informe para la pestaña Movimientos: gastos, compras, ventas y tops del día/mes elegido
  async movimientos(sucursalId?: string, desde?: string, hasta?: string) {
    const r = this.rangoDias(desde, hasta);
    const rango = { gte: r.ini, lt: r.finLt };
    const whereSucursal = sucursalId ? { sucursalId } : {};

    const [gastos, compras, ventas, movimientosStock] = await Promise.all([
      // Todo movimiento de caja que no sea compra ni venta (gastos, retiros)
      this.prisma.tenant.movimientoCaja.findMany({
        where: {
          createdAt: rango,
          tipo: { notIn: ['APERTURA', 'VENTA', 'COMPRA', 'CIERRE', 'PAGO_CUENTA'] },
          ...(sucursalId ? { caja: { sucursalId } } : {}),
        },
        include: { caja: { select: { sucursal: { select: { nombre: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.compra.findMany({
        where: { fecha: rango, estado: 'CONFIRMADA', ...whereSucursal },
        include: { proveedor: { select: { nombre: true } }, _count: { select: { detalles: true } } },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.tenant.venta.findMany({
        where: { fecha: rango, estado: 'COMPLETADA', ...whereSucursal },
        include: {
          detalles: {
            include: {
              producto: { select: { id: true, nombre: true, codigoBarras: true, categoria: { select: { nombre: true } } } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.tenant.movimientoStock.findMany({
        where: { fecha: rango, tipo: { in: ['MERMA', 'AJUSTE'] }, ...whereSucursal },
        include: { producto: { select: { nombre: true, codigoBarras: true, unidad: true } } },
        orderBy: { fecha: 'desc' },
      }),
    ]);

    const mermasTotal = movimientosStock.filter(m => m.tipo === 'MERMA').reduce((a, m) => a + Math.round(Math.abs(m.cantidad) * m.costoUnitario), 0);
    const ajustesTotal = movimientosStock.filter(m => m.tipo === 'AJUSTE').reduce((a, m) => a + Math.round(Math.abs(m.cantidad) * m.costoUnitario), 0);

    const totales = {
      comprasCantidad: compras.length,
      comprasTotal: compras.reduce((a, c) => a + Math.round(c.total), 0),
      ventasCantidad: ventas.length,
      ventasTotal: ventas.reduce((a, v) => a + Math.round(v.total), 0),
      gastosCantidad: gastos.length,
      gastosTotal: gastos.reduce((a, g) => a + Math.round(g.monto), 0),
      mermasCantidad: movimientosStock.filter(m => m.tipo === 'MERMA').length,
      mermasTotal,
      ajustesTotal,
    };

    const porProducto = new Map<string, any>();
    const porCategoria = new Map<string, any>();
    for (const v of ventas) {
      for (const d of v.detalles) {
        const unidades = Math.round(d.cantidad);
        const total = Math.round(d.subtotal);
        const cat = d.producto?.categoria?.nombre || 'Sin categoría';
        let p = porProducto.get(d.productoId);
        if (!p) {
          p = { productoId: d.productoId, nombre: d.producto?.nombre || 'Desconocido', codigoBarras: d.producto?.codigoBarras, unidades: 0, total: 0 };
          porProducto.set(d.productoId, p);
        }
        p.unidades += unidades;
        p.total += total;
        let c = porCategoria.get(cat);
        if (!c) {
          c = { categoria: cat, unidades: 0, total: 0 };
          porCategoria.set(cat, c);
        }
        c.unidades += unidades;
        c.total += total;
      }
    }

    const LIMITE_LISTADO = 200;

    return {
      desde: this.isoLocal(r.ini),
      hasta: this.isoLocal(r.fin),
      totales,
      neto: totales.ventasTotal - totales.comprasTotal - totales.gastosTotal,
      gastos: gastos.slice(0, LIMITE_LISTADO).map(g => ({
        id: g.id,
        fecha: g.createdAt,
        tipo: g.tipo,
        monto: g.monto,
        descripcion: g.descripcion,
        metodoPago: g.metodoPago,
        sucursal: g.caja?.sucursal?.nombre,
      })),
      compras: compras.slice(0, LIMITE_LISTADO).map(c => ({
        id: c.id,
        fecha: c.fecha,
        total: c.total,
        nroFactura: c.nroFactura,
        metodoPago: c.metodoPago,
        proveedor: c.proveedor?.nombre || 'Sin asignar',
        items: c._count.detalles,
      })),
      ventas: ventas.slice(0, LIMITE_LISTADO).map(v => ({
        id: v.id,
        fecha: v.fecha,
        nro: v.nroComprobante,
        total: v.total,
        metodoPago: v.metodoPago,
        items: v.detalles.length,
      })),
      mermas: movimientosStock.slice(0, LIMITE_LISTADO).map(m => ({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        descripcion: m.descripcion,
        producto: m.producto?.nombre || 'Desconocido',
        codigoBarras: m.producto?.codigoBarras,
        unidad: m.producto?.unidad || 'UNIDAD',
        cantidad: Math.abs(m.cantidad),
        valor: Math.round(Math.abs(m.cantidad) * m.costoUnitario),
      })),
      topProductos: [...porProducto.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 10),
      topCategorias: [...porCategoria.values()].sort((a, b) => b.total - a.total),
    };
  }

  async ventasPorDia(sucursalId?: string, dias = 7) {
    const result: { fecha: string; total: number; cantidad: number }[] = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const where: any = { fecha: { gte: d, lt: next }, estado: 'COMPLETADA' };
      if (sucursalId) where.sucursalId = sucursalId;
      const agg = await this.prisma.tenant.venta.aggregate({ where, _sum: { total: true }, _count: true });
      result.push({ fecha: this.isoLocal(d), total: agg._sum.total || 0, cantidad: agg._count });
    }
    return result;
  }

  async stockCritico(sucursalId?: string) {
    const stocks = await this.prisma.tenant.stock.findMany({
      where: { ...(sucursalId ? { sucursalId } : {}), producto: { unidad: { not: 'KG' } } },
      include: { producto: true, sucursal: true },
      orderBy: { cantidad: 'asc' },
    });
    return stocks.filter(s => s.cantidad <= s.stockMinimo).slice(0, 20);
  }

  async ventasPorDiaMes(sucursalId?: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: { fecha: string; total: number; cantidad: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      d.setHours(0, 0, 0, 0);
      const next = new Date(year, month, day + 1);
      const where: any = { fecha: { gte: d, lt: next }, estado: 'COMPLETADA' };
      if (sucursalId) where.sucursalId = sucursalId;
      const agg = await this.prisma.tenant.venta.aggregate({ where, _sum: { total: true }, _count: true });
      result.push({ fecha: this.isoLocal(d), total: agg._sum.total || 0, cantidad: agg._count });
    }
    return result;
  }
}