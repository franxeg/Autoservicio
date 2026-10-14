import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { GuardarRecetaDto } from './dto/guardar-receta.dto';
import { redondearCantidad } from '../common/numeros';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { search?: string; codigoBarras?: string; categoriaId?: string; page?: number; limit?: number; sucursalId?: string; esElaborado?: boolean }) {
    const { search, codigoBarras, categoriaId, page = 1, limit = 20, sucursalId, esElaborado } = query;
    const where: any = { empresaId: this.prisma.empresaId };
    if (search) where.nombre = { contains: search, mode: 'insensitive' };
    if (codigoBarras) where.codigoBarras = codigoBarras;
    if (categoriaId) where.categoriaId = categoriaId;
    if (esElaborado !== undefined) where.esElaborado = esElaborado;

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

  // precioVenta nunca se edita a mano: se calcula con costo + %venta + %crecimiento
  private calcularVenta(costo: number, pctVenta: number | null | undefined, pctCrec: number | null | undefined) {
    return Math.round(costo * (1 + (pctVenta ?? 30) / 100) * (1 + (pctCrec ?? 10) / 100));
  }

  async create(dto: CreateProductoDto) {
    const empresaId = this.prisma.empresaId!;
    if (dto.codigoBarras) {
      const exists = await this.prisma.tenant.producto.findFirst({ where: { empresaId, codigoBarras: dto.codigoBarras } });
      if (exists) throw new ConflictException('Código de barras ya existe');
    }
    const { stockInicial, sucursalId, stockMinimo, ...data } = dto;
    const precioCosto = Math.round(dto.precioCosto ?? 0);
    const porcentajeVenta = dto.porcentajeVenta ?? 30;
    const porcentajeCrecimiento = dto.porcentajeCrecimiento ?? 10;
    delete data.precioVenta;
    const producto = await this.prisma.tenant.producto.create({
      data: {
        ...data,
        precioCosto,
        precioVenta: this.calcularVenta(precioCosto, porcentajeVenta, porcentajeCrecimiento),
        porcentajeVenta,
        porcentajeCrecimiento,
        iva: dto.iva ?? 21,
        empresaId,
      },
    });

    if (sucursalId && producto.unidad !== 'KG') {
      await this.prisma.tenant.stock.upsert({
        where: { productoId_sucursalId: { productoId: producto.id, sucursalId } },
        update: { ...(stockMinimo !== undefined ? { stockMinimo: redondearCantidad(stockMinimo) } : {}) },
        create: {
          productoId: producto.id,
          sucursalId,
          cantidad: redondearCantidad(stockInicial ?? 0),
          stockMinimo: redondearCantidad(stockMinimo ?? 5),
          empresaId,
        },
      });
    }
    return producto;
  }

  async update(id: string, dto: UpdateProductoDto) {
    const actual = await this.findOne(id);
    if (dto.codigoBarras) {
      const exists = await this.prisma.tenant.producto.findFirst({ where: { empresaId: this.prisma.empresaId!, codigoBarras: dto.codigoBarras, NOT: { id } } });
      if (exists) throw new ConflictException('Código de barras ya existe en otro producto');
    }
    const { stockInicial, sucursalId, stockMinimo, ...data } = dto;
    if (data.precioCosto !== undefined) data.precioCosto = Math.round(data.precioCosto);
    if (data.porcentajeVenta !== undefined) data.porcentajeVenta = Math.round(data.porcentajeVenta * 100) / 100;
    if (data.porcentajeCrecimiento !== undefined) data.porcentajeCrecimiento = Math.round(data.porcentajeCrecimiento * 100) / 100;
    delete data.precioVenta;
    if (data.precioCosto !== undefined || data.porcentajeVenta !== undefined || data.porcentajeCrecimiento !== undefined) {
      data.precioVenta = this.calcularVenta(
        data.precioCosto ?? actual.precioCosto ?? 0,
        data.porcentajeVenta ?? actual.porcentajeVenta,
        data.porcentajeCrecimiento ?? actual.porcentajeCrecimiento,
      );
    }
    const producto = await this.prisma.tenant.producto.update({ where: { id }, data });

    const unidadFinal = data.unidad ?? actual.unidad;
    if (sucursalId && stockMinimo !== undefined && unidadFinal !== 'KG') {
      await this.prisma.tenant.stock.upsert({
        where: { productoId_sucursalId: { productoId: id, sucursalId } },
        update: { stockMinimo: redondearCantidad(stockMinimo) },
        create: { productoId: id, sucursalId, cantidad: redondearCantidad(stockInicial ?? 0), stockMinimo: redondearCantidad(stockMinimo), empresaId: this.prisma.empresaId! },
      });
    }
    return producto;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.producto.update({ where: { id }, data: { activo: false } });
  }

  // Stock por sucursal
  async updateStock(productoId: string, sucursalId: string, cantidad: number, stockMinimo?: number) {
    return this.prisma.tenant.stock.upsert({
      where: { productoId_sucursalId: { productoId, sucursalId } },
      update: { cantidad: redondearCantidad(cantidad), ...(stockMinimo !== undefined ? { stockMinimo: redondearCantidad(stockMinimo) } : {}) },
      create: { productoId, sucursalId, cantidad: redondearCantidad(cantidad), stockMinimo: redondearCantidad(stockMinimo ?? 5), empresaId: this.prisma.empresaId! },
    });
  }

  // Conteo físico de stock: fija la cantidad contada y registra la diferencia como MERMA (faltante) o AJUSTE (sobrante)
  async conteo(productoId: string, sucursalId: string, cantidadContada: number, descripcion?: string, usuarioId?: string) {
    const empresaId = this.prisma.empresaId!;
    const producto = await this.prisma.tenant.producto.findUnique({ where: { id: productoId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.unidad === 'KG') throw new BadRequestException('Los productos por peso no usan control de stock');
    const stock = await this.prisma.tenant.stock.findUnique({
      where: { productoId_sucursalId: { productoId, sucursalId } },
    });
    const antes = redondearCantidad(stock?.cantidad ?? 0);
    const contada = redondearCantidad(cantidadContada);
    const diferencia = redondearCantidad(contada - antes);
    const costo = Math.round(producto.precioCosto);

    await this.prisma.tenant.stock.upsert({
      where: { productoId_sucursalId: { productoId, sucursalId } },
      update: { cantidad: contada },
      create: { productoId, sucursalId, cantidad: contada, empresaId },
    });

    const movimiento = await this.prisma.tenant.movimientoStock.create({
      data: {
        tipo: diferencia < 0 ? 'MERMA' : 'AJUSTE',
        cantidad: diferencia,
        stockAntes: antes,
        stockDespues: contada,
        costoUnitario: costo,
        descripcion,
        productoId,
        sucursalId,
        empresaId,
        usuarioId: usuarioId || null,
      },
    });

    return { ...movimiento, valor: Math.round(Math.abs(diferencia) * costo) };
  }

  // ---------- Productos elaborados (recetas) ----------

  // Cantidad de insumo necesaria por unidad considerando la merma (10% => se necesita cantidad/0.9)
  private requeridoInsumo(cantidad: number, merma?: number | null) {
    const m = Math.min(99.99, Math.max(0, merma ?? 0));
    return cantidad / (1 - m / 100);
  }

  private calcularCostoReceta(items: { cantidad: number; merma?: number | null; insumo: { precioCosto: number } }[]) {
    let costo = 0;
    for (const it of items) costo += (it.insumo.precioCosto || 0) * this.requeridoInsumo(it.cantidad, it.merma);
    return Math.round(costo);
  }

  // Recalcula costo y precio de venta de un elaborado a partir de los costos actuales de sus insumos
  async recalcularElaborado(id: string) {
    const receta = await this.prisma.tenant.recetaItem.findMany({ where: { elaboradoId: id }, include: { insumo: true } });
    if (receta.length === 0) return null;
    const producto = await this.prisma.tenant.producto.findUnique({ where: { id } });
    if (!producto) return null;
    const costo = this.calcularCostoReceta(receta);
    const precioVenta = this.calcularVenta(costo, producto.porcentajeVenta, producto.porcentajeCrecimiento);
    await this.prisma.tenant.producto.update({ where: { id }, data: { precioCosto: costo, precioVenta } });
    return { id, costo, precioVenta };
  }

  // Recalcula todos los elaborados que usan estos insumos (se llama al confirmar una compra)
  async recalcularPorInsumos(insumoIds: string[]) {
    const ids = [...new Set((insumoIds || []).filter(Boolean))];
    if (ids.length === 0) return [];
    const usados = await this.prisma.tenant.recetaItem.findMany({ where: { insumoId: { in: ids } }, select: { elaboradoId: true } });
    const elaborados = [...new Set(usados.map(u => u.elaboradoId))];
    for (const id of elaborados) await this.recalcularElaborado(id);
    return elaborados;
  }

  async getReceta(id: string, sucursalId?: string) {
    const producto = await this.findOne(id);
    const items = await this.prisma.tenant.recetaItem.findMany({
      where: { elaboradoId: id },
      include: { insumo: { include: { stocks: sucursalId ? { where: { sucursalId } } : true } } },
    });
    const costo = this.calcularCostoReceta(items);
    return {
      producto,
      items: items.map(it => {
        const requerido = this.requeridoInsumo(it.cantidad, it.merma);
        return {
          insumoId: it.insumoId,
          nombre: it.insumo.nombre,
          unidad: it.insumo.unidad,
          precioCosto: it.insumo.precioCosto,
          cantidad: it.cantidad,
          merma: it.merma,
          requerido: redondearCantidad(requerido),
          aporte: Math.round((it.insumo.precioCosto || 0) * requerido),
          stock: it.insumo.stocks?.[0]?.cantidad ?? 0,
        };
      }),
      costo,
      precioVenta: this.calcularVenta(costo, producto.porcentajeVenta, producto.porcentajeCrecimiento),
      maxProducible: sucursalId ? await this.maxProducible(id, sucursalId) : null,
    };
  }

  async guardarReceta(id: string, dto: GuardarRecetaDto, sucursalId?: string) {
    const empresaId = this.prisma.empresaId!;
    await this.findOne(id);
    for (const it of dto.items) {
      if (it.insumoId === id) throw new BadRequestException('Un producto no puede ser insumo de sí mismo');
      const insumo = await this.prisma.tenant.producto.findUnique({ where: { id: it.insumoId } });
      if (!insumo || !insumo.activo) throw new NotFoundException('Insumo no encontrado');
      if (insumo.esElaborado) throw new BadRequestException(`"${insumo.nombre}" es un elaborado y no puede usarse como insumo`);
    }
    await this.prisma.tenant.recetaItem.deleteMany({ where: { elaboradoId: id } });
    await this.prisma.tenant.recetaItem.createMany({
      data: dto.items.map(it => ({ elaboradoId: id, insumoId: it.insumoId, cantidad: redondearCantidad(it.cantidad), merma: it.merma ?? 0, empresaId })),
    });
    const data: any = { esElaborado: true };
    if (dto.porcentajeVenta !== undefined) data.porcentajeVenta = dto.porcentajeVenta;
    if (dto.porcentajeCrecimiento !== undefined) data.porcentajeCrecimiento = dto.porcentajeCrecimiento;
    await this.prisma.tenant.producto.update({ where: { id }, data });
    await this.recalcularElaborado(id);
    return this.getReceta(id, sucursalId);
  }

  // Cuántas unidades se pueden producir con el stock actual de insumos
  async maxProducible(id: string, sucursalId: string) {
    const items = await this.prisma.tenant.recetaItem.findMany({
      where: { elaboradoId: id },
      include: { insumo: { include: { stocks: { where: { sucursalId } } } } },
    });
    if (items.length === 0) return 0;
    let max = Infinity;
    for (const it of items) {
      const req = this.requeridoInsumo(it.cantidad, it.merma);
      if (req <= 0) continue;
      const stock = it.insumo.stocks?.[0]?.cantidad ?? 0;
      max = Math.min(max, stock / req);
    }
    return max === Infinity ? 0 : Math.floor(max + 1e-9);
  }

  // Produce N unidades: descuenta insumos y suma stock del elaborado
  async producir(id: string, sucursalId: string, cantidad: number, usuarioId?: string) {
    const empresaId = this.prisma.empresaId!;
    const cant = redondearCantidad(cantidad);
    if (cant <= 0) throw new BadRequestException('Cantidad inválida');
    const elaborado = await this.findOne(id);
    const items = await this.prisma.tenant.recetaItem.findMany({ where: { elaboradoId: id }, include: { insumo: true } });
    if (items.length === 0) throw new BadRequestException('El producto no tiene receta cargada');

    // Validar stock de todos los insumos antes de tocar nada
    const calculo: { insumo: any; req: number; antes: number; stockId?: string }[] = [];
    for (const it of items) {
      // Los insumos por peso no controlan stock: no se validan ni descuentan
      if (it.insumo.unidad === 'KG') continue;
      const req = redondearCantidad(this.requeridoInsumo(it.cantidad, it.merma) * cant);
      const stock = await this.prisma.tenant.stock.findUnique({
        where: { productoId_sucursalId: { productoId: it.insumoId, sucursalId } },
      });
      const antes = redondearCantidad(stock?.cantidad ?? 0);
      if (antes + 0.0001 < req) {
        throw new BadRequestException(`Stock insuficiente de ${it.insumo.nombre}. Necesario: ${req}, disponible: ${antes}`);
      }
      calculo.push({ insumo: it.insumo, req, antes, stockId: stock?.id });
    }

    for (const c of calculo) {
      const despues = redondearCantidad(c.antes - c.req);
      await this.prisma.tenant.stock.update({ where: { id: c.stockId! }, data: { cantidad: despues } });
      await this.prisma.tenant.movimientoStock.create({
        data: {
          tipo: 'PRODUCCION', cantidad: -c.req, stockAntes: c.antes, stockDespues: despues,
          costoUnitario: c.insumo.precioCosto, descripcion: `Producción: ${elaborado.nombre}`,
          productoId: c.insumo.id, sucursalId, empresaId, usuarioId: usuarioId || null,
        },
      });
    }

    let stockFinal: number | null = null;
    if (elaborado.unidad !== 'KG') {
      const stockElab = await this.prisma.tenant.stock.findUnique({ where: { productoId_sucursalId: { productoId: id, sucursalId } } });
      const antesElab = redondearCantidad(stockElab?.cantidad ?? 0);
      const despuesElab = redondearCantidad(antesElab + cant);
      await this.prisma.tenant.stock.upsert({
        where: { productoId_sucursalId: { productoId: id, sucursalId } },
        update: { cantidad: despuesElab },
        create: { productoId: id, sucursalId, cantidad: cant, empresaId },
      });
      await this.prisma.tenant.movimientoStock.create({
        data: {
          tipo: 'PRODUCCION', cantidad: cant, stockAntes: antesElab, stockDespues: despuesElab,
          costoUnitario: elaborado.precioCosto, descripcion: `Producción: ${elaborado.nombre}`,
          productoId: id, sucursalId, empresaId, usuarioId: usuarioId || null,
        },
      });
      stockFinal = despuesElab;
    }

    return { producido: cant, stock: stockFinal, maxProducible: await this.maxProducible(id, sucursalId) };
  }

  async getElaborados(sucursalId?: string) {
    const elaborados = await this.prisma.tenant.producto.findMany({
      where: { empresaId: this.prisma.empresaId, esElaborado: true, activo: true },
      include: {
        stocks: sucursalId ? { where: { sucursalId } } : true,
        receta: { include: { insumo: { include: { stocks: sucursalId ? { where: { sucursalId } } : true } } } },
      },
      orderBy: { nombre: 'asc' },
    });
    return elaborados.map(p => {
      let max = Infinity;
      for (const it of p.receta) {
        const req = this.requeridoInsumo(it.cantidad, it.merma);
        if (req <= 0) continue;
        max = Math.min(max, (it.insumo.stocks?.[0]?.cantidad ?? 0) / req);
      }
      return {
        id: p.id,
        nombre: p.nombre,
        unidad: p.unidad,
        precioCosto: p.precioCosto,
        precioVenta: p.precioVenta,
        porcentajeVenta: p.porcentajeVenta,
        porcentajeCrecimiento: p.porcentajeCrecimiento,
        stock: p.stocks?.[0]?.cantidad ?? 0,
        maxProducible: p.receta.length === 0 || max === Infinity ? 0 : Math.floor(max + 1e-9),
        insumos: p.receta.map(it => ({
          insumoId: it.insumoId,
          nombre: it.insumo.nombre,
          unidad: it.insumo.unidad,
          cantidad: it.cantidad,
          merma: it.merma,
          precioCosto: it.insumo.precioCosto,
          stock: it.insumo.stocks?.[0]?.cantidad ?? 0,
        })),
      };
    });
  }
}