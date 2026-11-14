import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Catálogo de productos precargado que se incluye en el instalador.
 *
 * El JSON vive en `prisma/preload/catalogo.json` y contiene las categorías y
 * los productos vendidos por unidad (sin combos, elaborados, stock, costos ni
 * precios). Se carga una sola vez, al completar el registro inicial.
 */
interface CategoriaPrecargada {
  nombre: string;
  descripcion?: string | null;
  esSistema?: boolean;
}

interface ProductoPrecargado {
  nombre: string;
  codigoBarras?: string | null;
  categoria?: string | null;
}

export interface CatalogoPrecargado {
  categorias: CategoriaPrecargada[];
  productos: ProductoPrecargado[];
}

function rutaCatalogo(): string | null {
  const candidatos = [
    // Instalación empaquetada: <app>/prisma/preload/catalogo.json
    join(process.cwd(), 'prisma', 'preload', 'catalogo.json'),
    // Ejecución desde dist/ (backend/dist/auth -> backend/prisma/preload)
    join(__dirname, '..', '..', 'prisma', 'preload', 'catalogo.json'),
  ];
  return candidatos.find((p) => existsSync(p)) || null;
}

export function leerCatalogoPrecargado(): CatalogoPrecargado | null {
  const ruta = rutaCatalogo();
  if (!ruta) return null;
  try {
    const data = JSON.parse(readFileSync(ruta, 'utf8'));
    if (!Array.isArray(data?.categorias) || !Array.isArray(data?.productos)) return null;
    return data as CatalogoPrecargado;
  } catch {
    return null;
  }
}

/**
 * Crea las categorías y los productos del catálogo para la empresa.
 * Es idempotente: si la empresa ya tiene categorías, no hace nada.
 * Los productos quedan con stock 0, costo 0 y precio 0.
 */
export async function sembrarCatalogoInicial(
  tx: any,
  empresaId: string,
  sucursalId: string,
): Promise<{ categorias: number; productos: number }> {
  const catalogo = leerCatalogoPrecargado();
  if (!catalogo || catalogo.categorias.length === 0) return { categorias: 0, productos: 0 };

  const yaHayCategorias = await tx.categoria.count({ where: { empresaId } });
  if (yaHayCategorias > 0) return { categorias: 0, productos: 0 };

  const idsPorNombre = new Map<string, string>();
  for (const categoria of catalogo.categorias) {
    const creada = await tx.categoria.create({
      data: {
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || null,
        esSistema: !!categoria.esSistema,
        empresaId,
      },
    });
    idsPorNombre.set(categoria.nombre, creada.id);
  }

  const productos = catalogo.productos
    .filter((p) => p?.nombre?.trim())
    .map((p) => ({
      nombre: p.nombre.trim(),
      codigoBarras: p.codigoBarras || null,
      categoriaId: p.categoria ? idsPorNombre.get(p.categoria) || null : null,
      precioCosto: 0,
      precioVenta: 0,
      porcentajeVenta: 30,
      porcentajeCrecimiento: 10,
      unidad: 'UNIDAD',
      iva: 21,
      activo: true,
      esElaborado: false,
      esCombo: false,
      empresaId,
    }));

  // Inserción por lotes para no superar el límite de parámetros de Postgres.
  const LOTE_PRODUCTOS = 200;
  for (let i = 0; i < productos.length; i += LOTE_PRODUCTOS) {
    await tx.producto.createMany({ data: productos.slice(i, i + LOTE_PRODUCTOS) });
  }

  // Stock en cero para que aparezcan en la planilla de stock de la sucursal.
  const creados = await tx.producto.findMany({ where: { empresaId }, select: { id: true } });
  const stocks = creados.map((p: any) => ({
    productoId: p.id,
    sucursalId,
    cantidad: 0,
    stockMinimo: 5,
    empresaId,
  }));
  const LOTE_STOCK = 500;
  for (let i = 0; i < stocks.length; i += LOTE_STOCK) {
    await tx.stock.createMany({ data: stocks.slice(i, i + LOTE_STOCK) });
  }

  return { categorias: idsPorNombre.size, productos: productos.length };
}
