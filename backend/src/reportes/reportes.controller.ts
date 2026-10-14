import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private service: ReportesService) {}

  @Get('dashboard')
  dashboard(@Query('sucursalId') sucursalId?: string) {
    return this.service.dashboard(sucursalId);
  }

  @Get('ventas-por-dia')
  ventasPorDia(@Query('sucursalId') sucursalId?: string, @Query('dias') dias?: string) {
    return this.service.ventasPorDia(sucursalId, dias ? parseInt(dias) : 7);
  }

  @Get('desglose')
  desglose(@Query('sucursalId') sucursalId?: string, @Query('periodo') periodo?: string) {
    return this.service.desglose(sucursalId, periodo);
  }

  @Get('movimientos')
  movimientos(
    @Query('sucursalId') sucursalId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.movimientos(sucursalId, desde, hasta);
  }

  @Get('stock-critico')
  stockCritico(@Query('sucursalId') sucursalId?: string) {
    return this.service.stockCritico(sucursalId);
  }
}
