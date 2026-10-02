import { Module } from '@nestjs/common';
import { SucursalesService } from './sucursales.service';
import { SucursalesController } from './sucursales.controller';

@Module({
  controllers: [SucursalesController],
  providers: [SucursalesService],
})
export class SucursalesModule {}
