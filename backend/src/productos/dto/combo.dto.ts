import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComboItemDto {
  @ApiProperty()
  @IsString()
  productoId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.001)
  cantidad: number;
}

export class CreateComboDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiProperty({ type: [ComboItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items: ComboItemDto[];

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber()
  precioVenta?: number;
}

export class UpdateComboDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiPropertyOptional({ type: [ComboItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items?: ComboItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  precioVenta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
