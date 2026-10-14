import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('compras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compras')
export class ComprasController {
  constructor(private service: ComprasService) {}

  @Get()
  @ApiQuery({ name: 'estado', required: false, description: 'BORRADOR o CONFIRMADA' })
  findAll(
    @Query('sucursalId') sucursalId?: string,
    @Query('proveedorId') proveedorId?: string,
    @Query('estado') estado?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      sucursalId,
      proveedorId,
      estado,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateCompraDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateCompraDto) { return this.service.update(id, dto); }

  @Post(':id/confirmar')
  confirmar(@Param('id') id: string) { return this.service.confirmar(id); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
