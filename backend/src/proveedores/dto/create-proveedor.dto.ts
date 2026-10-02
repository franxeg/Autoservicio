import { IsString, IsOptional, IsEmail, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProveedorDto {
  @ApiProperty({ example: 'Distribuidora Sur' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ example: '30-12345678-9' })
  @IsOptional()
  @IsString()
  cuit?: string;

  @ApiPropertyOptional({ example: '1122334455' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ example: 'contacto@sur.com', description: 'Opcional' })
  @IsOptional()
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: 'Debe ingresar un email válido' })
  email?: string;

  @ApiPropertyOptional({ example: 'Calle 123' })
  @IsOptional()
  @IsString()
  direccion?: string;
}
