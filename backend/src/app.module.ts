import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriasModule } from './categorias/categorias.module';
import { ProductosModule } from './productos/productos.module';
import { CajaModule } from './caja/caja.module';
import { VentasModule } from './ventas/ventas.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { ComprasModule } from './compras/compras.module';
import { ClientesModule } from './clientes/clientes.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, CategoriasModule, ProductosModule, CajaModule, VentasModule, ProveedoresModule, ComprasModule, ClientesModule, ReportesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
