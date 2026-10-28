import { IsString, IsOptional, IsNumber, IsIn, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({ example: 'Juan Perez' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ example: '30123456' })
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiPropertyOptional({ example: '1122334455' })
  @IsOptional()
  @Matches(/^\d*$/, { message: 'El teléfono solo puede tener números' })
  telefono?: string;

  @ApiPropertyOptional({ example: 'juan@mail.com', description: 'Opcional, sin validación' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Calle 123' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: 'sucursal-central' })
  @IsOptional()
  @IsString()
  sucursalId?: string;
}

export class PagoDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  monto: number;

  @ApiProperty({ example: 'EFECTIVO', enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] })
  @IsIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'])
  metodoPago: string;

  @ApiPropertyOptional({ example: 'sucursal-central' })
  @IsOptional()
  @IsString()
  sucursalId?: string;

  @ApiPropertyOptional({ example: 'Pago en efectivo' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class AjusteSaldoDto {
  @ApiProperty({ example: 15000, description: 'Positivo = suma deuda (saldo anterior), negativo = resta deuda' })
  @IsNumber()
  monto: number;

  @ApiPropertyOptional({ example: 'AJUSTE', enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'AJUSTE'] })
  @IsOptional()
  @IsIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'AJUSTE'])
  metodoPago?: string;

  @ApiPropertyOptional({ example: 'Deuda anterior al sistema' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
