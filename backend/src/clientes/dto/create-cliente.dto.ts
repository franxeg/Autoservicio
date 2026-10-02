import { IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';
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
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ example: 'juan@mail.com' })
  @IsOptional()
  @IsEmail()
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

  @ApiPropertyOptional({ example: 'Pago en efectivo' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
