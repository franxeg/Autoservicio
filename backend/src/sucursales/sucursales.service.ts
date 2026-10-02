import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SucursalesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenant.sucursal.findMany({ orderBy: { nombre: 'asc' }, include: { _count: { select: { usuarios: true } } } });
  }

  async findOne(id: string) {
    const s = await this.prisma.tenant.sucursal.findUnique({ where: { id }, include: { usuarios: true } });
    if (!s) throw new NotFoundException('Sucursal no encontrada');
    return s;
  }

  create(data: { nombre: string; direccion?: string; telefono?: string }) {
    return this.prisma.tenant.sucursal.create({ data: { ...data, empresaId: this.prisma.empresaId! } });
  }

  update(id: string, data: any) {
    return this.prisma.tenant.sucursal.update({ where: { id }, data });
  }
}