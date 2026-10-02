import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VentaItemDto {
  @ApiProperty({ example: 'cmt93...' })
  @IsString()
  productoId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiPropertyOptional({ example: 3200, description: 'Si no se envía, usa precioVenta del producto' })
  @IsOptional()
  @IsNumber()
  precioUnitario?: number;
}

export class CreateVentaDto {
  @ApiProperty({ example: 'sucursal-central' })
  @IsString()
  sucursalId: string;

  @ApiPropertyOptional({ example: 'client-id' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiProperty({ type: [VentaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentaItemDto)
  items: VentaItemDto[];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  descuento?: number;

  @ApiPropertyOptional({ enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CUENTA_CORRIENTE'], example: 'EFECTIVO' })
  @IsOptional()
  @IsString()
  metodoPago?: string;

  @ApiPropertyOptional({ example: 'caja-id', description: 'Si no se envía, usa la caja abierta de la sucursal' })
  @IsOptional()
  @IsString()
  cajaId?: string;
}
