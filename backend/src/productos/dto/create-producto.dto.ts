import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductoDto {
  @ApiPropertyOptional({ example: '7790000000011' })
  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @ApiPropertyOptional({ example: '0001' })
  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @ApiProperty({ example: 'Yerba Mate 1kg' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0)
  precioCosto: number;

  @ApiProperty({ example: 3200 })
  @IsNumber()
  @Min(0)
  precioVenta: number;

  @ApiPropertyOptional({ example: 21 })
  @IsOptional()
  @IsNumber()
  iva?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Para crear stock inicial
  @ApiPropertyOptional({ example: 100, description: 'Stock inicial para sucursal principal' })
  @IsOptional()
  @IsNumber()
  stockInicial?: number;

  @ApiPropertyOptional({ description: 'Sucursal donde cargar stock inicial' })
  @IsOptional()
  @IsString()
  sucursalId?: string;
}
