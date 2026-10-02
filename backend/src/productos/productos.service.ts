import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { search?: string; codigoBarras?: string; categoriaId?: string; page?: number; limit?: number; sucursalId?: string }) {
    const { search, codigoBarras, categoriaId, page = 1, limit = 20, sucursalId } = query;
    const where: any = { empresaId: this.prisma.empresaId };
    if (search) where.nombre = { contains: search, mode: 'insensitive' };
    if (codigoBarras) where.codigoBarras = codigoBarras;
    if (categoriaId) where.categoriaId = categoriaId;

    const [data, total] = await Promise.all([
      this.prisma.tenant.producto.findMany({
        where,
        include: { categoria: true, stocks: sucursalId ? { where: { sucursalId } } : true },
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenant.producto.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const producto = await this.prisma.tenant.producto.findUnique({
      where: { id },
      include: { categoria: true, stocks: { include: { sucursal: true } } },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  async findByCodigo(codigo: string) {
    const producto = await this.prisma.tenant.producto.findFirst({
      where: { empresaId: this.prisma.empresaId, OR: [{ codigoBarras: codigo }, { codigoInterno: codigo }] },
      include: { categoria: true, stocks: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado por código');
    return producto;
  }

  async create(dto: CreateProductoDto) {
    const empresaId = this.prisma.empresaId!;
    if (dto.codigoBarras) {
      const exists = await this.prisma.tenant.producto.findFirst({ where: { empresaId, codigoBarras: dto.codigoBarras } });
      if (exists) throw new ConflictException('Código de barras ya existe');
    }
    const { stockInicial, sucursalId, ...data } = dto;
    const producto = await this.prisma.tenant.producto.create({ data: { ...data, iva: dto.iva ?? 21, empresaId } });

    if (stockInicial !== undefined && sucursalId) {
      await this.prisma.tenant.stock.create({
        data: { productoId: producto.id, sucursalId, cantidad: stockInicial, empresaId },
      });
    }
    return producto;
  }

  async update(id: string, dto: UpdateProductoDto) {
    await this.findOne(id);
    if (dto.codigoBarras) {
      const exists = await this.prisma.tenant.producto.findFirst({ where: { empresaId: this.prisma.empresaId!, codigoBarras: dto.codigoBarras, NOT: { id } } });
      if (exists) throw new ConflictException('Código de barras ya existe en otro producto');
    }
    const { stockInicial, sucursalId, ...data } = dto;
    return this.prisma.tenant.producto.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.producto.update({ where: { id }, data: { activo: false } });
  }

  // Stock por sucursal
  async updateStock(productoId: string, sucursalId: string, cantidad: number) {
    return this.prisma.tenant.stock.upsert({
      where: { productoId_sucursalId: { productoId, sucursalId } },
      update: { cantidad },
      create: { productoId, sucursalId, cantidad, empresaId: this.prisma.empresaId! },
    });
  }
}