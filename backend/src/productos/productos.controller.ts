import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { GuardarRecetaDto } from './dto/guardar-receta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('productos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('productos')
export class ProductosController {
  constructor(private service: ProductosService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'codigoBarras', required: false })
  @ApiQuery({ name: 'categoriaId', required: false })
  @ApiQuery({ name: 'sucursalId', required: false })
  @ApiQuery({ name: 'esElaborado', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('codigoBarras') codigoBarras?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('esElaborado') esElaborado?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      search,
      codigoBarras,
      categoriaId,
      sucursalId,
      esElaborado: esElaborado === undefined ? undefined : esElaborado === 'true',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('elaborados')
  getElaborados(@Query('sucursalId') sucursalId?: string) {
    return this.service.getElaborados(sucursalId);
  }

  @Get('codigo/:codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.service.findByCodigo(codigo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/receta')
  getReceta(@Param('id') id: string, @Query('sucursalId') sucursalId?: string) {
    return this.service.getReceta(id, sucursalId);
  }

  @Get(':id/max-producible')
  maxProducible(@Param('id') id: string, @Query('sucursalId') sucursalId: string) {
    return this.service.maxProducible(id, sucursalId);
  }

  @Put(':id/receta')
  guardarReceta(@Param('id') id: string, @Body() dto: GuardarRecetaDto, @Query('sucursalId') sucursalId?: string) {
    return this.service.guardarReceta(id, dto, sucursalId);
  }

  @Post(':id/producir')
  producir(@Param('id') id: string, @Body() body: { sucursalId: string; cantidad: number }, @CurrentUser() user: any) {
    return this.service.producir(id, body.sucursalId, body.cantidad, user?.id);
  }

  @Post()
  create(@Body() dto: CreateProductoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/stock')
  updateStock(@Param('id') id: string, @Body() body: { sucursalId: string; cantidad: number; stockMinimo?: number }) {
    return this.service.updateStock(id, body.sucursalId, body.cantidad, body.stockMinimo);
  }

  @Post(':id/conteo')
  conteo(
    @Param('id') id: string,
    @Body() body: { sucursalId: string; cantidadContada: number; descripcion?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.conteo(id, body.sucursalId, body.cantidadContada, body.descripcion, user?.id);
  }
}
