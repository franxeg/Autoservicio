import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenant.categoria.findMany({ orderBy: { nombre: 'asc' }, include: { _count: { select: { productos: true } } } });
  }

  async findOne(id: string) {
    const cat = await this.prisma.tenant.categoria.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }

  async create(dto: CreateCategoriaDto) {
    const empresaId = this.prisma.empresaId!;
    const exists = await this.prisma.tenant.categoria.findFirst({ where: { empresaId, nombre: dto.nombre } });
    if (exists) throw new ConflictException('Categoría ya existe');
    return this.prisma.tenant.categoria.create({ data: { ...dto, empresaId } });
  }

  async update(id: string, dto: CreateCategoriaDto) {
    await this.findOne(id);
    return this.prisma.tenant.categoria.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.categoria.delete({ where: { id } });
  }
}