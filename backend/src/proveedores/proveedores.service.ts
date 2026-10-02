import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';

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
    const where: any = {};
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
      if (exists) throw new ConflictException('CUIT ya registrado');
    }
    return this.prisma.tenant.proveedor.create({ data: { ...data, empresaId } });
  }

  async update(id: string, dto: CreateProveedorDto) {
    await this.findOne(id);
    return this.prisma.tenant.proveedor.update({ where: { id }, data: limpiarDto(dto) });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.proveedor.update({ where: { id }, data: { activo: false } });
  }
}