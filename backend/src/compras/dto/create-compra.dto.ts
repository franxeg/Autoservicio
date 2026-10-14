import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsIn, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompraItemDto {
  @ApiProperty({ example: 'cmt93...' })
  @IsString()
  productoId: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  @Min(0)
  precioCosto: number;

  @ApiPropertyOptional({ example: 30, description: '% de venta aplicado al costo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeVenta?: number;

  @ApiPropertyOptional({ example: 10, description: '% de crecimiento aplicado sobre el precio con margen' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeCrecimiento?: number;
}

export class CreateCompraDto {
  @ApiProperty({ example: 'sucursal-central' })
  @IsString()
  sucursalId: string;

  @ApiProperty({ example: 'proveedor-id', required: false, description: 'Opcional: sin asignar' })
  @IsOptional()
  @IsString()
  proveedorId?: string;

  @ApiPropertyOptional({ example: 'F001-000123' })
  @IsOptional()
  @IsString()
  nroFactura?: string;

  @ApiPropertyOptional({ example: 'EFECTIVO', enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CUENTA_CORRIENTE'] })
  @IsOptional()
  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CUENTA_CORRIENTE'])
  metodoPago?: string;

  @ApiPropertyOptional({ description: 'true = guarda como borrador, sin tocar stock ni caja' })
  @IsOptional()
  @IsBoolean()
  borrador?: boolean;

  @ApiProperty({ type: [CompraItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompraItemDto)
  items: CompraItemDto[];
}
