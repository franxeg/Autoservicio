import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, PagoDto, AjusteSaldoDto } from './dto/create-cliente.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private service: ClientesService) {}

  @Get()
  findAll(@Query('search') search?: string, @Query('sucursalId') sucursalId?: string) {
    return this.service.findAll(search, sucursalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/cuenta')
  getCuenta(@Param('id') id: string) { return this.service.getCuentaCorriente(id); }

  @Post()
  create(@Body() dto: CreateClienteDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateClienteDto) { return this.service.update(id, dto); }

  @Post(':id/pago')
  pago(@Param('id') id: string, @Body() dto: PagoDto, @CurrentUser() user: any) {
    return this.service.registrarPago(id, dto, user?.id);
  }

  @Post(':id/ajuste')
  ajuste(@Param('id') id: string, @Body() dto: AjusteSaldoDto) {
    return this.service.ajustarSaldo(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
