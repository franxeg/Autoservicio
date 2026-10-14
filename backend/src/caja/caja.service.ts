import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const METODOS_VIRTUALES = ['TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'VIRTUAL'];
const esVirtual = (m: string) => METODOS_VIRTUALES.includes(m);
const esEfectivoCobrado = (m: string) => !esVirtual(m) && m !== 'CUENTA_CORRIENTE';

@Injectable()
export class CajaService {
  constructor(private prisma: PrismaService) {}

  async getAbierta(sucursalId: string) {
    return this.prisma.tenant.caja.findFirst({
      where: { sucursalId, estado: 'ABIERTA' },
      include: { usuario: { select: { id: true, nombre: true } }, _count: { select: { ventas: true, movimientos: true } } },
    });
  }

  async abrir(sucursalId: string, usuarioId: string, montoInicial: number, montoInicialVirtual: number = 0) {
    const abierta = await this.getAbierta(sucursalId);
    if (abierta) throw new ConflictException('Ya existe una caja abierta para esta sucursal');
    montoInicial = Math.round(montoInicial);
    montoInicialVirtual = Math.round(montoInicialVirtual);
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;
    const caja = await tx.caja.create({
      data: { sucursalId, usuarioId, montoInicial, montoInicialVirtual, estado: 'ABIERTA', empresaId },
    });
    await tx.movimientoCaja.create({
      data: { cajaId: caja.id, tipo: 'APERTURA', monto: montoInicial, descripcion: 'Apertura de caja', empresaId },
    });
    if (montoInicialVirtual > 0) {
      await tx.movimientoCaja.create({
        data: { cajaId: caja.id, tipo: 'APERTURA', monto: montoInicialVirtual, descripcion: 'Apertura virtual (Mercado Pago)', empresaId },
      });
    }
    return caja;
  }

  async cerrar(cajaId: string, montoFinal?: number, montoFinalVirtual?: number) {
    const tx = this.prisma.tenant;
    const caja = await tx.caja.findUnique({ where: { id: cajaId }, include: { movimientos: true, ventas: true, pagos: true } });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    if (caja.estado === 'CERRADA') throw new BadRequestException('Caja ya cerrada');

    // Calcular ambos balances si no se envían
    let calculado = montoFinal;
    let calculadoVirtual = montoFinalVirtual;
    if (calculado === undefined || calculadoVirtual === undefined) {
      // Separar ventas efectivo vs virtual (cuenta corriente no entra en la caja)
      const ventasEfectivo = caja.ventas.filter(v => v.estado === 'COMPLETADA' && esEfectivoCobrado(v.metodoPago)).reduce((a, v) => a + v.total, 0);
      const ventasVirtual = caja.ventas.filter(v => v.estado === 'COMPLETADA' && esVirtual(v.metodoPago)).reduce((a, v) => a + v.total, 0);
      const pagosVirtuales = caja.pagos.filter((p: any) => esVirtual(p.metodoPago)).reduce((a: number, p: any) => a + p.monto, 0);
      const pagosEfectivo = caja.pagos.filter((p: any) => esEfectivoCobrado(p.metodoPago)).reduce((a: number, p: any) => a + p.monto, 0);
      const gastos = caja.movimientos
        .filter(m => !['APERTURA', 'VENTA', 'CIERRE', 'PAGO_CUENTA'].includes(m.tipo))
        .reduce((a, m) => a + m.monto, 0); // COMPRA, GASTO, RETIRO
      // Por simplicidad, gastos se descuentan de efectivo. Virtual solo suma ventas virtuales + inicial virtual
      if (calculado === undefined) calculado = (caja.montoInicial || 0) + ventasEfectivo + pagosEfectivo - gastos;
      if (calculadoVirtual === undefined) calculadoVirtual = (caja.montoInicialVirtual || 0) + ventasVirtual + pagosVirtuales;
    }

    calculado = Math.round(calculado!);
    calculadoVirtual = Math.round(calculadoVirtual!);

    await tx.movimientoCaja.create({
      data: { cajaId, tipo: 'CIERRE', monto: calculado, descripcion: 'Cierre de caja', empresaId: this.prisma.empresaId! },
    });

    return tx.caja.update({
      where: { id: cajaId },
      data: { estado: 'CERRADA', fechaCierre: new Date(), montoFinal: calculado, montoFinalVirtual: calculadoVirtual },
    });
  }

  async addMovimiento(cajaId: string, tipo: string, monto: number, descripcion?: string) {
    const tx = this.prisma.tenant;
    const caja = await tx.caja.findUnique({ where: { id: cajaId } });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    if (caja.estado === 'CERRADA') throw new BadRequestException('Caja cerrada');
    const tiposValidos = ['VENTA', 'COMPRA', 'GASTO', 'RETIRO', 'APERTURA', 'CIERRE'];
    if (!tiposValidos.includes(tipo)) throw new BadRequestException(`Tipo inválido: ${tipo}`);
    return tx.movimientoCaja.create({ data: { cajaId, tipo: tipo as any, monto: Math.round(monto), descripcion, empresaId: this.prisma.empresaId! } });
  }

  async findBySucursal(sucursalId: string, limit = 10) {
    return this.prisma.tenant.caja.findMany({
      where: { sucursalId },
      orderBy: { fechaApertura: 'desc' },
      take: limit,
      include: { usuario: { select: { nombre: true } }, _count: { select: { ventas: true } } },
    });
  }

  async findOne(id: string) {
    const caja = await this.prisma.tenant.caja.findUnique({
      where: { id },
      include: {
        usuario: { select: { nombre: true, email: true } },
        sucursal: true,
        ventas: { include: { detalles: true } },
        pagos: { orderBy: { fecha: 'asc' } },
        movimientos: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    const totalVentas = caja.ventas.filter(v => v.estado === 'COMPLETADA').reduce((a, v) => a + v.total, 0);
    const totalVentasEfectivo = caja.ventas.filter(v => v.estado === 'COMPLETADA' && esEfectivoCobrado(v.metodoPago)).reduce((a, v) => a + v.total, 0);
    const totalVentasVirtual = caja.ventas.filter(v => v.estado === 'COMPLETADA' && esVirtual(v.metodoPago)).reduce((a, v) => a + v.total, 0);
    const pagosEfectivo = caja.pagos.filter((p: any) => esEfectivoCobrado(p.metodoPago)).reduce((a: number, p: any) => a + p.monto, 0);
    const pagosVirtuales = caja.pagos.filter((p: any) => esVirtual(p.metodoPago)).reduce((a: number, p: any) => a + p.monto, 0);
    const gastosEfectivo = caja.movimientos.filter(m => !['APERTURA', 'CIERRE', 'VENTA', 'PAGO_CUENTA'].includes(m.tipo) && esEfectivoCobrado(m.metodoPago || 'EFECTIVO')).reduce((a, m) => a + m.monto, 0);
    const gastosVirtuales = caja.movimientos.filter(m => !['APERTURA', 'CIERRE', 'VENTA', 'PAGO_CUENTA'].includes(m.tipo) && esVirtual(m.metodoPago || 'EFECTIVO')).reduce((a, m) => a + m.monto, 0);
    const gastos = gastosEfectivo;
    const balance = (caja.montoInicial || 0) + totalVentasEfectivo + pagosEfectivo - gastosEfectivo;
    const balanceVirtual = (caja.montoInicialVirtual || 0) + totalVentasVirtual + pagosVirtuales - gastosVirtuales;
    return {
      ...caja,
      totalVentas,
      totalVentasEfectivo,
      totalVentasVirtual,
      pagosEfectivo,
      pagosVirtuales,
      balance,
      balanceVirtual,
      gastos,
      gastosEfectivo,
      gastosVirtuales,
    };
  }
}