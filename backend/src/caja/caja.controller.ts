import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CajaService } from './caja.service';
import { AbrirCajaDto, CerrarCajaDto, MovimientoCajaDto } from './dto/abrir-caja.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('caja')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('caja')
export class CajaController {
  constructor(private service: CajaService) {}

  @Get('abierta')
  getAbierta(@Query('sucursalId') sucursalId: string) {
    return this.service.getAbierta(sucursalId);
  }

  @Get('sucursal/:sucursalId')
  findBySucursal(@Param('sucursalId') sucursalId: string) {
    return this.service.findBySucursal(sucursalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('abrir')
  abrir(@Body() dto: AbrirCajaDto, @CurrentUser() user: any) {
    return this.service.abrir(dto.sucursalId, user.id, dto.montoInicial, dto.montoInicialVirtual || 0);
  }

  @Patch(':id/cerrar')
  cerrar(@Param('id') id: string, @Body() dto: CerrarCajaDto) {
    return this.service.cerrar(id, dto.montoFinal, dto.montoFinalVirtual);
  }

  @Post(':id/movimiento')
  addMovimiento(@Param('id') id: string, @Body() dto: MovimientoCajaDto) {
    return this.service.addMovimiento(id, dto.tipo, dto.monto, dto.descripcion, dto.metodoPago);
  }
}
