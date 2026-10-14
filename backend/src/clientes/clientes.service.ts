import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, PagoDto } from './dto/create-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string, sucursalId?: string) {
    const where: any = {};
    if (search) where.OR = [{ nombre: { contains: search, mode: 'insensitive' } }, { telefono: { contains: search, mode: 'insensitive' } }];
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

  private sanitizar(dto: CreateClienteDto) {
    const data: any = {};
    for (const key of ['nombre', 'dni', 'telefono', 'email', 'direccion', 'sucursalId']) {
      const valor = (dto as any)[key];
      if (valor === undefined || valor === null) continue;
      if (typeof valor === 'string' && valor.trim() === '') continue;
      data[key] = typeof valor === 'string' ? valor.trim() : valor;
    }
    return data;
  }

  async create(dto: CreateClienteDto) {
    const empresaId = this.prisma.empresaId!;
    const data = this.sanitizar(dto);
    if (data.dni) {
      const exists = await this.prisma.tenant.cliente.findFirst({ where: { empresaId, dni: data.dni } });
      if (exists) throw new ConflictException('DNI ya registrado');
    }
    return this.prisma.tenant.cliente.create({ data: { ...data, empresaId } });
  }

  async update(id: string, dto: CreateClienteDto) {
    await this.findOne(id);
    const data = this.sanitizar(dto);
    if (data.dni) {
      const exists = await this.prisma.tenant.cliente.findFirst({ where: { empresaId: this.prisma.empresaId!, dni: data.dni, NOT: { id } } });
      if (exists) throw new ConflictException('DNI ya registrado');
    }
    return this.prisma.tenant.cliente.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Borrado lógico: no hay campo activo, así que eliminamos solo si saldo 0
    const cliente = await this.prisma.tenant.cliente.findUnique({ where: { id } });
    if (cliente && cliente.saldoCuenta !== 0) throw new BadRequestException('No se puede eliminar cliente con saldo pendiente');
    return this.prisma.tenant.cliente.delete({ where: { id } });
  }

  async registrarPago(id: string, dto: PagoDto, usuarioId?: string) {
    const cliente = await this.findOne(id);
    const monto = Math.round(Number(dto.monto));
    if (monto <= 0) throw new BadRequestException('Monto debe ser positivo');
    if (monto > cliente.saldoCuenta) {
      throw new BadRequestException(`Monto excede el saldo pendiente: $${Math.round(Number(cliente.saldoCuenta))}`);
    }
    const empresaId = this.prisma.empresaId!;
    const tx = this.prisma.tenant;
    const metodoPago = dto.metodoPago ?? 'EFECTIVO';

    if (!dto.sucursalId) throw new BadRequestException('Seleccioná la sucursal para cobrar');
    const caja = await tx.caja.findFirst({ where: { sucursalId: dto.sucursalId, estado: 'ABIERTA' } });
    if (!caja) throw new BadRequestException('No hay caja abierta en esta sucursal. Abrí la caja para poder cobrar.');
    const cajaId: string = caja.id;

    const pago = await tx.pagoCliente.create({
      data: {
        monto,
        metodoPago,
        descripcion: dto.descripcion || null,
        empresaId,
        clienteId: id,
        sucursalId: dto.sucursalId,
        usuarioId: usuarioId || null,
        cajaId,
      },
    });

    await tx.cliente.update({ where: { id }, data: { saldoCuenta: { decrement: monto } } });

await tx.movimientoCaja.create({
      data: {
        cajaId,
        tipo: 'PAGO_CUENTA',
        monto,
        descripcion: `Pago cuenta corriente - ${cliente.nombre} (${metodoPago})`,
        empresaId,
      },
    });

    return { pago, saldo: Number(cliente.saldoCuenta) - monto };
  }

  async getCuentaCorriente(id: string) {
    const cliente = await this.findOne(id);
    const [ventas, pagos] = await Promise.all([
      this.prisma.tenant.venta.findMany({
        where: { clienteId: id, metodoPago: 'CUENTA_CORRIENTE' },
        orderBy: { fecha: 'desc' },
        include: { detalles: { include: { producto: true } } },
      }),
      this.prisma.tenant.pagoCliente.findMany({
        where: { clienteId: id },
        orderBy: { fecha: 'desc' },
        include: { usuario: { select: { nombre: true } }, sucursal: { select: { nombre: true } } },
      }),
    ]);

    const totalDeuda = ventas.filter((v) => v.estado !== 'CANCELADA').reduce((a, v) => a + v.total, 0);
    const totalPagado = pagos.reduce((a, p) => a + p.monto, 0);
    const detalleVentas = ventas.map((v) => ({
      ...v,
      estado: v.estado,
      montoPagado: pagos
        .filter((p) => p.fecha <= v.fecha)
        .reduce((a, p) => a + p.monto, 0),
    }));

    return {
      cliente,
      saldo: cliente.saldoCuenta,
      totalDeuda,
      totalPagado,
      ventas: detalleVentas,
      pagos,
    };
  }
}