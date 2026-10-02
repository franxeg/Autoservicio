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

    const [ventasHoyAgg, ventasMesAgg, ventasTotalAgg, totalProductos, clientesDeudores, cajaAbierta, stockCritico] = await Promise.all([
      this.prisma.tenant.venta.aggregate({ where: whereHoy, _sum: { total: true }, _count: true }),
      this.prisma.tenant.venta.aggregate({ where: whereMes, _sum: { total: true }, _count: true }),
      this.prisma.tenant.venta.aggregate({ where: { ...whereSucursal, estado: 'COMPLETADA' }, _sum: { total: true }, _count: true }),
      this.prisma.tenant.producto.count({ where: { activo: true } }),
      this.prisma.tenant.cliente.aggregate({ where: { saldoCuenta: { gt: 0 } }, _sum: { saldoCuenta: true }, _count: true }),
      this.prisma.tenant.caja.findFirst({ where: { ...whereSucursal, estado: 'ABIERTA' } }),
      this.prisma.tenant.stock.findMany({
        where: { ...(sucursalId ? { sucursalId } : {}), cantidad: { lte: 5 } },
        include: { producto: { select: { nombre: true, codigoBarras: true } }, sucursal: { select: { nombre: true } } },
        take: 10,
        orderBy: { cantidad: 'asc' },
      }).then(stocks => stocks.filter(s => s.cantidad <= s.stockMinimo)),
    ]);

    // Ticket promedio (sobre total histórico) y del mes
    const ticketPromedio = ventasTotalAgg._count > 0 ? (ventasTotalAgg._sum.total || 0) / ventasTotalAgg._count : 0;
    const ticketMes = ventasMesAgg._count > 0 ? (ventasMesAgg._sum.total || 0) / ventasMesAgg._count : 0;

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
      stockCritico: stockCritico.map(s => ({ producto: s.producto.nombre, codigo: s.producto.codigoBarras, sucursal: s.sucursal.nombre, cantidad: s.cantidad, minimo: s.stockMinimo })),
      stockCriticoCount: stockCritico.length,
      ventasPorDia,
      ventasMesPorDia,
      topProductos: topConNombres,
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
      result.push({ fecha: d.toISOString().slice(0, 10), total: agg._sum.total || 0, cantidad: agg._count });
    }
    return result;
  }

  async stockCritico(sucursalId?: string) {
    const stocks = await this.prisma.tenant.stock.findMany({
      where: sucursalId ? { sucursalId } : {},
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
      result.push({ fecha: d.toISOString().slice(0, 10), total: agg._sum.total || 0, cantidad: agg._count });
    }
    return result;
  }
}