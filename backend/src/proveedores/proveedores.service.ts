import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { SaldarProveedorDto } from './dto/saldar-proveedor.dto';

function limpiarDto(dto: CreateProveedorDto) {
  const data: any = { ...dto };
  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'string' && data[key].trim() === '') delete data[key];
  }
  return data;
}

@Injectable()
export class ProveedoresService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    const where: any = { activo: true };
    if (search) where.nombre = { contains: search, mode: 'insensitive' };
    return this.prisma.tenant.proveedor.findMany({ where, orderBy: { nombre: 'asc' } });
  }

  async findOne(id: string) {
    const prov = await this.prisma.tenant.proveedor.findUnique({ where: { id }, include: { compras: { take: 5, orderBy: { fecha: 'desc' } } } });
    if (!prov) throw new NotFoundException('Proveedor no encontrado');
    return prov;
  }

  async create(dto: CreateProveedorDto) {
    const data = limpiarDto(dto);
    const empresaId = this.prisma.empresaId!;
    if (data.cuit) {
      const exists = await this.prisma.tenant.proveedor.findFirst({ where: { empresaId, cuit: data.cuit } });
      if (exists) {
        if (exists.activo) throw new ConflictException('CUIT ya registrado');
        // Reutiliza el que estaba dado de baja: mantiene el id y las compras viejas
        return this.prisma.tenant.proveedor.update({ where: { id: exists.id }, data: { ...data, activo: true } });
      }
    }
    return this.prisma.tenant.proveedor.create({ data: { ...data, empresaId } });
  }

  async update(id: string, dto: CreateProveedorDto) {
    await this.findOne(id);
    return this.prisma.tenant.proveedor.update({ where: { id }, data: limpiarDto(dto) });
  }

  async remove(id: string) {
    const prov = await this.findOne(id);
    if (prov.saldoCuenta !== 0) {
      throw new BadRequestException('No se puede eliminar: el proveedor tiene saldo pendiente en cuenta corriente. Saldalo primero.');
    }
    return this.prisma.tenant.proveedor.update({ where: { id }, data: { activo: false } });
  }

  async saldar(id: string, dto: SaldarProveedorDto) {
    const prov = await this.findOne(id);
    const monto = Math.round(Number(dto.monto));
    if (monto <= 0) throw new BadRequestException('El monto debe ser positivo');
    if (monto > prov.saldoCuenta + 0.01) {
      throw new BadRequestException(`El monto no puede superar la deuda pendiente: $${Math.round(Number(prov.saldoCuenta))}`);
    }
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;

    const caja = await tx.caja.findFirst({ where: { sucursalId: dto.sucursalId, estado: 'ABIERTA' } });
    if (!caja) throw new BadRequestException('No hay caja abierta en esta sucursal. Abrí la caja para poder pagar.');

    // Descontar de la caja (movimiento de salida)
    await tx.movimientoCaja.create({
      data: {
        cajaId: caja.id,
        tipo: 'PAGO_PROVEEDOR',
        monto: -monto, // negativo porque sale de caja
        metodoPago: dto.metodoPago,
        descripcion: dto.descripcion || `Pago a proveedor ${prov.nombre}`,
        empresaId,
      },
    });

    // Reducir la deuda del proveedor
    const nuevoSaldo = Math.round(Number(prov.saldoCuenta) - monto);
    await tx.proveedor.update({ where: { id }, data: { saldoCuenta: nuevoSaldo } });

    return { saldo: nuevoSaldo, monto };
  }
}