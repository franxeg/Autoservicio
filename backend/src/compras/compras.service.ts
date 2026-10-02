import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompraDto } from './dto/create-compra.dto';

@Injectable()
export class ComprasService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { sucursalId?: string; proveedorId?: string; page?: number; limit?: number }) {
    const { sucursalId, proveedorId, page = 1, limit = 20 } = query;
    const where: any = {};
    if (sucursalId) where.sucursalId = sucursalId;
    if (proveedorId) where.proveedorId = proveedorId;
    const [data, total] = await Promise.all([
      this.prisma.tenant.compra.findMany({
        where,
        include: { detalles: { include: { producto: true } }, proveedor: true, sucursal: true },
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenant.compra.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const compra = await this.prisma.tenant.compra.findUnique({
      where: { id },
      include: { detalles: { include: { producto: true } }, proveedor: true, sucursal: true },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    return compra;
  }

  async create(dto: CreateCompraDto) {
    if (!dto.items?.length) throw new BadRequestException('Compra sin items');
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;

    const sucursal = await tx.sucursal.findUnique({ where: { id: dto.sucursalId } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    let proveedorNombre = 'Sin asignar';
    if (dto.proveedorId) {
      const proveedor = await tx.proveedor.findUnique({ where: { id: dto.proveedorId } });
      if (!proveedor || !proveedor.activo) throw new NotFoundException('Proveedor no encontrado');
      proveedorNombre = proveedor.nombre;
    }

    let total = 0;
    const detalles: any[] = [];

    for (const item of dto.items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto) throw new NotFoundException(`Producto ${item.productoId} no encontrado`);
      const subtotal = item.precioCosto * item.cantidad;
      total += subtotal;
      detalles.push({ productoId: item.productoId, cantidad: item.cantidad, precioCosto: item.precioCosto, subtotal, empresaId });

      // Incrementar stock
      const stock = await tx.stock.findUnique({
        where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: dto.sucursalId } },
      });
      const actual = stock?.cantidad ?? 0;
      await tx.stock.upsert({
        where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: dto.sucursalId } },
        update: { cantidad: actual + item.cantidad },
        create: { productoId: item.productoId, sucursalId: dto.sucursalId, cantidad: item.cantidad, empresaId },
      });

      // Opcional: actualizar precio costo del producto al último costo
      await tx.producto.update({
        where: { id: item.productoId },
        data: { precioCosto: item.precioCosto },
      });
    }

    const compra = await tx.compra.create({
      data: {
        total,
        nroFactura: dto.nroFactura,
        sucursalId: dto.sucursalId,
        proveedorId: dto.proveedorId || null,
        empresaId,
        detalles: { create: detalles },
      },
      include: { detalles: true },
    });

    // Movimiento de caja si hay caja abierta: registrar gasto
    const cajaAbierta = await tx.caja.findFirst({ where: { sucursalId: dto.sucursalId, estado: 'ABIERTA' } });
    if (cajaAbierta) {
      await tx.movimientoCaja.create({
        data: { cajaId: cajaAbierta.id, tipo: 'COMPRA', monto: total, descripcion: `Compra #${compra.id.slice(0, 6)} a ${proveedorNombre}`, empresaId },
      });
    }

    return compra;
  }
}