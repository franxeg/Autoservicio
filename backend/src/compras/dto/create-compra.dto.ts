import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
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

  @ApiProperty({ type: [CompraItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompraItemDto)
  items: CompraItemDto[];
}
