import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';

@Injectable()
export class VentasService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { sucursalId?: string; page?: number; limit?: number; fecha?: string }) {
    const { sucursalId, page = 1, limit = 20, fecha } = query;
    const where: any = {};
    if (sucursalId) where.sucursalId = sucursalId;
    if (fecha) {
      const d = new Date(fecha);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      where.fecha = { gte: d, lt: next };
    }
    const [data, total] = await Promise.all([
      this.prisma.tenant.venta.findMany({
        where,
        include: { detalles: { include: { producto: true } }, cliente: true, usuario: { select: { nombre: true } }, sucursal: true },
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenant.venta.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const venta = await this.prisma.tenant.venta.findUnique({
      where: { id },
      include: { detalles: { include: { producto: true } }, cliente: true, usuario: true, sucursal: true, caja: true },
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    return venta;
  }

  async create(dto: CreateVentaDto, usuarioId: string) {
    if (!dto.items || dto.items.length === 0) throw new BadRequestException('Venta sin items');
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;

    // Validar sucursal
    const sucursal = await tx.sucursal.findUnique({ where: { id: dto.sucursalId } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    // Validar caja abierta
    let cajaId = dto.cajaId;
    if (!cajaId) {
      const cajaAbierta = await tx.caja.findFirst({ where: { sucursalId: dto.sucursalId, estado: 'ABIERTA' } });
      if (!cajaAbierta) throw new BadRequestException('No hay caja abierta para esta sucursal. Abrí la caja primero.');
      cajaId = cajaAbierta.id;
    } else {
      const caja = await tx.caja.findUnique({ where: { id: cajaId } });
      if (!caja || caja.estado !== 'ABIERTA') throw new BadRequestException('Caja no abierta');
    }

    // Validar cliente si es cuenta corriente
    if (dto.metodoPago === 'CUENTA_CORRIENTE' && !dto.clienteId) {
      throw new BadRequestException('Se requiere cliente para cuenta corriente');
    }

    let total = 0;
    const detallesData: any[] = [];

    for (const item of dto.items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto || !producto.activo) throw new NotFoundException(`Producto ${item.productoId} no encontrado`);
      const precio = item.precioUnitario ?? producto.precioVenta;
      const subtotal = precio * item.cantidad;
      total += subtotal;

      // Verificar y descontar stock
      const stock = await tx.stock.findUnique({
        where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: dto.sucursalId } },
      });
      const cantidadActual = stock?.cantidad ?? 0;
      if (cantidadActual < item.cantidad) {
        throw new BadRequestException(`Stock insuficiente para ${producto.nombre}. Disponible: ${cantidadActual}, solicitado: ${item.cantidad}`);
      }
      await tx.stock.upsert({
        where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: dto.sucursalId } },
        update: { cantidad: cantidadActual - item.cantidad },
        create: { productoId: item.productoId, sucursalId: dto.sucursalId, cantidad: -item.cantidad, empresaId },
      });

      detallesData.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: precio,
        subtotal,
        empresaId,
      });
    }

    const descuento = dto.descuento ?? 0;
    total = Math.max(0, total - descuento);

    const venta = await tx.venta.create({
      data: {
        total,
        descuento,
        metodoPago: dto.metodoPago ?? 'EFECTIVO',
        sucursalId: dto.sucursalId,
        clienteId: dto.clienteId,
        usuarioId,
        cajaId,
        empresaId,
        detalles: { create: detallesData },
      },
      include: { detalles: true },
    });

    // Movimiento de caja
    await tx.movimientoCaja.create({
      data: { cajaId: cajaId!, tipo: 'VENTA', monto: total, descripcion: `Venta #${venta.nroComprobante}`, empresaId },
    });

    // Si es cuenta corriente, incrementar saldo
    if (dto.metodoPago === 'CUENTA_CORRIENTE' && dto.clienteId) {
      await tx.cliente.update({
        where: { id: dto.clienteId },
        data: { saldoCuenta: { increment: total } },
      });
    }

    return venta;
  }

  async cancelar(id: string) {
    const venta = await this.findOne(id);
    if (venta.estado === 'CANCELADA') throw new BadRequestException('Venta ya cancelada');
    const tx = this.prisma.tenant;

    // Reponer stock
    for (const det of venta.detalles) {
      const stock = await tx.stock.findUnique({
        where: { productoId_sucursalId: { productoId: det.productoId, sucursalId: venta.sucursalId } },
      });
      if (stock) {
        await tx.stock.update({
          where: { id: stock.id },
          data: { cantidad: stock.cantidad + det.cantidad },
        });
      }
    }
    // Revertir movimiento? Crear movimiento negativo
    if (venta.cajaId) {
      await tx.movimientoCaja.create({
        data: { cajaId: venta.cajaId, tipo: 'GASTO', monto: venta.total, descripcion: `Cancelación venta #${venta.nroComprobante}`, empresaId: this.prisma.empresaId! },
      });
    }
    if (venta.clienteId && venta.metodoPago === 'CUENTA_CORRIENTE') {
      await tx.cliente.update({
        where: { id: venta.clienteId },
        data: { saldoCuenta: { decrement: venta.total } },
      });
    }
    return tx.venta.update({ where: { id }, data: { estado: 'CANCELADA' } });
  }
}