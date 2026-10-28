import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { redondearCantidad } from '../common/numeros';
import { ProductosService } from '../productos/productos.service';

@Injectable()
export class ComprasService {
  constructor(private prisma: PrismaService, private productos: ProductosService) {}

  async findAll(query: { sucursalId?: string; proveedorId?: string; estado?: string; page?: number; limit?: number }) {
    const { sucursalId, proveedorId, estado, page = 1, limit = 20 } = query;
    const where: any = {};
    if (sucursalId) where.sucursalId = sucursalId;
    if (proveedorId) where.proveedorId = proveedorId;
    if (estado) where.estado = estado;
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

  private calcularTotal(items: { cantidad: number; precioCosto: number }[]) {
    return items.reduce((acc, i) => acc + Math.round(Math.round(i.precioCosto) * redondearCantidad(i.cantidad)), 0);
  }

  private armarDetalles(items: CreateCompraDto['items'], empresaId: string) {
    return items.map(i => {
      const cantidad = redondearCantidad(i.cantidad);
      const precioCosto = Math.round(i.precioCosto);
      return {
        productoId: i.productoId,
        cantidad,
        precioCosto,
        porcentajeVenta: i.porcentajeVenta ?? 30,
        porcentajeCrecimiento: i.porcentajeCrecimiento ?? 10,
        subtotal: Math.round(precioCosto * cantidad),
        empresaId,
      };
    });
  }

  // Alta de compra o borrador. Si borrador=true NO toca stock, precios, caja ni deuda.
  async create(dto: CreateCompraDto) {
    if (!dto.items?.length) throw new BadRequestException('Compra sin items');
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;
    const metodoPago = dto.metodoPago ?? 'EFECTIVO';
    const borrador = !!dto.borrador;

    const sucursal = await tx.sucursal.findUnique({ where: { id: dto.sucursalId } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    if (dto.proveedorId) {
      const proveedor = await tx.proveedor.findUnique({ where: { id: dto.proveedorId } });
      if (!proveedor || !proveedor.activo) throw new NotFoundException('Proveedor no encontrado');
    }

    // Validaciones de cobro solo al confirmar (el borrador se puede guardar igual)
    if (!borrador) {
      if (metodoPago === 'CUENTA_CORRIENTE') {
        if (!dto.proveedorId) throw new BadRequestException('Cuenta corriente: es obligatorio elegir proveedor');
      } else {
        const cajaAbierta = await tx.caja.findFirst({ where: { sucursalId: dto.sucursalId, estado: 'ABIERTA' } });
        if (!cajaAbierta) throw new BadRequestException('No hay caja abierta en esta sucursal. Abrí la caja para registrar la compra.');
      }
    }

    for (const item of dto.items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto) throw new NotFoundException(`Producto ${item.productoId} no encontrado`);
    }

    const total = this.calcularTotal(dto.items);
    const detalles = this.armarDetalles(dto.items, empresaId);

    const compra = await tx.compra.create({
      data: {
        total,
        nroFactura: dto.nroFactura,
        metodoPago,
        estado: borrador ? 'BORRADOR' : 'CONFIRMADA',
        fechaConfirmacion: borrador ? null : new Date(),
        sucursalId: dto.sucursalId,
        proveedorId: dto.proveedorId || null,
        empresaId,
        detalles: { create: detalles },
      },
      include: { detalles: { include: { producto: true } }, proveedor: true },
    });

    if (!borrador) await this.aplicarEfectos(compra);
    return compra;
  }

  // Edita un borrador: reemplaza items, total, proveedor, factura y medio de pago
  async update(id: string, dto: CreateCompraDto) {
    const compra = await this.findOne(id);
    if (compra.estado !== 'BORRADOR') throw new ConflictException('Solo se pueden editar borradores');
    if (!dto.items?.length) throw new BadRequestException('Compra sin items');
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;

    if (dto.proveedorId) {
      const proveedor = await tx.proveedor.findUnique({ where: { id: dto.proveedorId } });
      if (!proveedor || !proveedor.activo) throw new NotFoundException('Proveedor no encontrado');
    }
    for (const item of dto.items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto) throw new NotFoundException(`Producto ${item.productoId} no encontrado`);
    }

    const total = this.calcularTotal(dto.items);
    await tx.detalleCompra.deleteMany({ where: { compraId: id } });
    return tx.compra.update({
      where: { id },
      data: {
        total,
        nroFactura: dto.nroFactura,
        metodoPago: dto.metodoPago ?? compra.metodoPago,
        proveedorId: dto.proveedorId || null,
        detalles: { create: this.armarDetalles(dto.items, empresaId) },
      },
      include: { detalles: { include: { producto: true } }, proveedor: true },
    });
  }

  // Confirma un borrador: ahí recién suma stock, precios, caja o deuda
  async confirmar(id: string) {
    const compra = await this.findOne(id);
    if (compra.estado === 'CONFIRMADA') throw new ConflictException('La compra ya está confirmada');
    const tx = this.prisma.tenant;

    if (compra.metodoPago === 'CUENTA_CORRIENTE') {
      if (!compra.proveedorId) throw new BadRequestException('Cuenta corriente: la compra necesita proveedor');
    } else {
      const cajaAbierta = await tx.caja.findFirst({ where: { sucursalId: compra.sucursalId, estado: 'ABIERTA' } });
      if (!cajaAbierta) throw new BadRequestException('No hay caja abierta en esta sucursal. Abrí la caja para confirmar la compra.');
    }

    await this.aplicarEfectos(compra);

    return tx.compra.update({
      where: { id },
      data: { estado: 'CONFIRMADA', fechaConfirmacion: new Date() },
      include: { detalles: { include: { producto: true } }, proveedor: true },
    });
  }

  async remove(id: string) {
    const compra = await this.findOne(id);
    if (compra.estado !== 'BORRADOR') throw new ConflictException('Solo se pueden eliminar borradores');
    await this.prisma.tenant.detalleCompra.deleteMany({ where: { compraId: id } });
    return this.prisma.tenant.compra.delete({ where: { id } });
  }

  // Efectos de una compra confirmada: stock + precios de producto + caja o deuda
  private async aplicarEfectos(compra: any) {
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;
    let proveedorNombre = 'Sin asignar';
    if (compra.proveedorId) {
      const proveedor = await tx.proveedor.findUnique({ where: { id: compra.proveedorId } });
      if (proveedor) proveedorNombre = proveedor.nombre;
    }

    const insumoIds: string[] = [];
    for (const det of compra.detalles) {
      // Los productos por peso (KG) no usan control de stock: no se suma stock, pero sí se actualiza el costo/precio
      if (det.producto?.unidad !== 'KG') {
        const stock = await tx.stock.findUnique({
          where: { productoId_sucursalId: { productoId: det.productoId, sucursalId: compra.sucursalId } },
        });
        const cantidad = redondearCantidad(det.cantidad);
        const actual = redondearCantidad(stock?.cantidad ?? 0);
        await tx.stock.upsert({
          where: { productoId_sucursalId: { productoId: det.productoId, sucursalId: compra.sucursalId } },
          update: { cantidad: redondearCantidad(actual + cantidad) },
          create: { productoId: det.productoId, sucursalId: compra.sucursalId, cantidad, empresaId },
        });
      }

      // Los elaborados calculan su costo desde su receta: la compra no les fija el precio
      if (det.producto?.esElaborado) continue;

      const pctVenta = det.porcentajeVenta ?? 30;
      const pctCrec = det.porcentajeCrecimiento ?? 10;
      const costo = Math.round(det.precioCosto);
      // Mismo criterio que productos.service.calcularVenta: múltiplo de 100 redondeado hacia arriba.
      const precioVenta = Math.ceil((costo * (1 + pctVenta / 100) * (1 + pctCrec / 100) - 1e-6) / 100) * 100;
      await tx.producto.update({
        where: { id: det.productoId },
        data: {
          precioCosto: costo,
          precioVenta,
          porcentajeVenta: pctVenta,
          porcentajeCrecimiento: pctCrec,
        },
      });
      insumoIds.push(det.productoId);
    }

    // Al cambiar el costo de algún insumo, recalcular los elaborados que lo usan
    await this.productos.recalcularPorInsumos(insumoIds);

    if (compra.metodoPago === 'CUENTA_CORRIENTE') {
      await tx.proveedor.update({
        where: { id: compra.proveedorId },
        data: { saldoCuenta: { increment: compra.total } },
      });
    } else {
      const cajaAbierta = await tx.caja.findFirst({ where: { sucursalId: compra.sucursalId, estado: 'ABIERTA' } });
      if (!cajaAbierta) throw new BadRequestException('No hay caja abierta en esta sucursal. Abrí la caja para confirmar la compra.');
      await tx.movimientoCaja.create({
        data: {
          cajaId: cajaAbierta.id,
          tipo: 'COMPRA',
          monto: compra.total,
          metodoPago: compra.metodoPago,
          descripcion: `Compra a ${proveedorNombre}${compra.nroFactura ? ` (Factura ${compra.nroFactura})` : ''}`,
          empresaId,
        },
      });
    }
  }
}
