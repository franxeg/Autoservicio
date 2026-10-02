import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CambiarPasswordProveedorDto {
  @IsString()
  @IsNotEmpty()
  passwordActual: string;

  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  passwordNueva: string;
}