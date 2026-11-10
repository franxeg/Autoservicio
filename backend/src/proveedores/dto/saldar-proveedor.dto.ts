import { IsNumber, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaldarProveedorDto {
  @ApiProperty({ example: 5000, description: 'Monto a saldar (positivo)' })
  @IsNumber()
  monto: number;

  @ApiProperty({ example: 'EFECTIVO', enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] })
  @IsString()
  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
  metodoPago: string;

  @ApiProperty({ example: 'sucursal-central' })
  @IsString()
  sucursalId: string;

  @ApiPropertyOptional({ example: 'Pago parcial a proveedor' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}