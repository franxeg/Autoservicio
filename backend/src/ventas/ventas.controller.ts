import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ventas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ventas')
export class VentasController {
  constructor(private service: VentasService) {}

  @Get()
  findAll(
    @Query('sucursalId') sucursalId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.service.findAll({
      sucursalId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      fecha,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateVentaDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}
