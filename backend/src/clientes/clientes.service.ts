import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string, sucursalId?: string) {
    const where: any = {};
    if (search) where.OR = [{ nombre: { contains: search, mode: 'insensitive' } }, { dni: { contains: search, mode: 'insensitive' } }];
    if (sucursalId) where.sucursalId = sucursalId;
    return this.prisma.tenant.cliente.findMany({ where, orderBy: { nombre: 'asc' } });
  }

  async findOne(id: string) {
    const cliente = await this.prisma.tenant.cliente.findUnique({
      where: { id },
      include: { ventas: { orderBy: { fecha: 'desc' }, take: 10, include: { detalles: true } } },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async create(dto: CreateClienteDto) {
    const empresaId = this.prisma.empresaId!;
    if (dto.dni) {
      const exists = await this.prisma.tenant.cliente.findFirst({ where: { empresaId, dni: dto.dni } });
      if (exists) throw new ConflictException('DNI ya registrado');
    }
    return this.prisma.tenant.cliente.create({ data: { ...dto, empresaId } });
  }

  async update(id: string, dto: CreateClienteDto) {
    await this.findOne(id);
    return this.prisma.tenant.cliente.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Borrado lógico: no hay campo activo, así que eliminamos solo si saldo 0
    const cliente = await this.prisma.tenant.cliente.findUnique({ where: { id } });
    if (cliente && cliente.saldoCuenta !== 0) throw new BadRequestException('No se puede eliminar cliente con saldo pendiente');
    return this.prisma.tenant.cliente.delete({ where: { id } });
  }

  async registrarPago(id: string, monto: number, descripcion?: string) {
    const cliente = await this.findOne(id);
    if (monto <= 0) throw new BadRequestException('Monto debe ser positivo');
    if (monto > cliente.saldoCuenta) throw new BadRequestException(`Monto excede saldo. Saldo: $${cliente.saldoCuenta}`);
    return this.prisma.tenant.cliente.update({
      where: { id },
      data: { saldoCuenta: { decrement: monto } },
    });
  }

  async getCuentaCorriente(id: string) {
    const cliente = await this.findOne(id);
    const ventas = await this.prisma.tenant.venta.findMany({
      where: { clienteId: id, metodoPago: 'CUENTA_CORRIENTE' },
      orderBy: { fecha: 'desc' },
      include: { detalles: { include: { producto: true } } },
    });
    return { cliente, ventas, saldo: cliente.saldoCuenta };
  }
}