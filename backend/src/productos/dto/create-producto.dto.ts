import { IsString, IsOptional, IsNumber, IsBoolean, IsIn, Min } from 'class-validator';
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

  @ApiPropertyOptional({ example: 2500, description: 'Se asigna desde las compras' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioCosto?: number;

  @ApiPropertyOptional({ example: 3200, description: 'Ignorado: se calcula con costo + %venta + %crecimiento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioVenta?: number;

  @ApiPropertyOptional({ example: 30, description: '% de venta sobre el costo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeVenta?: number;

  @ApiPropertyOptional({ example: 10, description: '% de crecimiento sobre el precio ya marcado' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeCrecimiento?: number;

  @ApiPropertyOptional({ example: 5, description: 'Mínimo en stock para alertas de stock crítico' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMinimo?: number;

  @ApiPropertyOptional({ enum: ['UNIDAD', 'KG'], description: 'Unidad de venta; KG permite cantidades con decimales' })
  @IsOptional()
  @IsIn(['UNIDAD', 'KG'])
  unidad?: 'UNIDAD' | 'KG';

  @ApiPropertyOptional({ example: false, description: 'Producto elaborado (tiene receta de insumos)' })
  @IsOptional()
  @IsBoolean()
  esElaborado?: boolean;

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
