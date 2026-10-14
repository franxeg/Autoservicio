import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecetaItemDto {
  @ApiProperty({ description: 'ID del producto insumo (no puede ser un elaborado)' })
  @IsString()
  insumoId: string;

  @ApiProperty({ example: 0.1, description: 'Cantidad de insumo por unidad del elaborado (en la unidad base del insumo)' })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiPropertyOptional({ example: 0, description: '% de merma del insumo (ej. 10 = se pierde el 10%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  merma?: number;
}

export class GuardarRecetaDto {
  @ApiProperty({ type: [RecetaItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecetaItemDto)
  items: RecetaItemDto[];

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeVenta?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentajeCrecimiento?: number;
}
