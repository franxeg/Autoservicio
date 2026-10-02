import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AbrirCajaDto {
  @ApiProperty({ example: 'sucursal-central' })
  @IsString()
  sucursalId: string;

  @ApiProperty({ example: 5000, description: 'Monto inicial en efectivo' })
  @IsNumber()
  @Min(0)
  montoInicial: number;

  @ApiPropertyOptional({ example: 2000, description: 'Monto inicial virtual (Mercado Pago, etc.)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoInicialVirtual?: number;
}

export class CerrarCajaDto {
  @ApiPropertyOptional({ example: 12500 })
  @IsOptional()
  @IsNumber()
  montoFinal?: number;

  @ApiPropertyOptional({ example: 8000, description: 'Monto final virtual' })
  @IsOptional()
  @IsNumber()
  montoFinalVirtual?: number;
}

export class MovimientoCajaDto {
  @ApiProperty({ enum: ['VENTA', 'COMPRA', 'GASTO', 'RETIRO'], example: 'GASTO' })
  @IsString()
  tipo: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  monto: number;

  @ApiPropertyOptional({ example: 'Pago luz' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
