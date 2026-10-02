import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Usuario (antes email)' })
  @IsString({ message: 'El usuario es obligatorio' })
  usuario: string;

  @ApiProperty({ example: 'admin123' })
  @IsString({ message: 'La contraseña es obligatoria' })
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres' })
  password: string;
}
