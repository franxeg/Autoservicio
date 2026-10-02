import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  // Contexto de sistema: permite operar aunque RLS esté activo
  await prisma.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'true', false)`);

  const empresa = await prisma.empresa.upsert({
    where: { id: 'empresa-demo' },
    update: {},
    create: {
      id: 'empresa-demo',
      nombre: 'Empresa Demo',
      cuit: '30-00000000-1',
    },
  });

  const sucursal = await prisma.sucursal.upsert({
    where: { id: 'sucursal-central' },
    update: {},
    create: {
      id: 'sucursal-central',
      nombre: 'Casa Central',
      direccion: 'Av. Principal 123',
      telefono: '0000-000000',
      empresaId: empresa.id,
    },
  });

  const password = await bcrypt.hash('admin123', 10);

  await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@autoservicio.com',
      password,
      nombre: 'Administrador',
      rol: Rol.ADMIN,
      sucursalId: sucursal.id,
      empresaId: empresa.id,
    },
  });

  const catAlmacen = await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: empresa.id, nombre: 'Almacén' } },
    update: {},
    create: { nombre: 'Almacén', descripcion: 'Productos de almacén', empresaId: empresa.id },
  });

  await prisma.categoria.upsert({
    where: { empresaId_nombre: { empresaId: empresa.id, nombre: 'Bebidas' } },
    update: {},
    create: { nombre: 'Bebidas', empresaId: empresa.id },
  });

  const prod = await prisma.producto.upsert({
    where: { empresaId_codigoBarras: { empresaId: empresa.id, codigoBarras: '7790000000011' } },
    update: {},
    create: {
      codigoBarras: '7790000000011',
      codigoInterno: '0001',
      nombre: 'Yerba Mate 1kg',
      categoriaId: catAlmacen.id,
      precioCosto: 2500,
      precioVenta: 3200,
      iva: 21,
      empresaId: empresa.id,
    },
  });

  await prisma.stock.upsert({
    where: {
      productoId_sucursalId: { productoId: prod.id, sucursalId: sucursal.id },
    },
    update: { cantidad: 100 },
    create: {
      productoId: prod.id,
      sucursalId: sucursal.id,
      cantidad: 100,
      stockMinimo: 10,
      empresaId: empresa.id,
    },
  });

  console.log('Seed completado: admin / admin123 (empresa-demo)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });