import { IsEmail, IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'cajero' })
  @IsString({ message: 'El usuario es obligatorio' })
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  username: string;

  @ApiPropertyOptional({ example: 'cajero@autoservicio.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Debe ingresar un email válido' })
  email?: string;

  @ApiProperty({ example: 'cajero123' })
  @IsString({ message: 'La contraseña es obligatoria' })
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres' })
  password: string;

  @ApiProperty({ example: 'Juan Perez' })
  @IsString({ message: 'El nombre es obligatorio' })
  nombre: string;

  @ApiProperty({ enum: Rol, example: Rol.CAJERO })
  @IsEnum(Rol, { message: 'Rol inválido. Use ADMIN, GERENTE, CAJERO o REPOSITOR' })
  rol: Rol;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'ID de sucursal inválido' })
  sucursalId?: string;
}
