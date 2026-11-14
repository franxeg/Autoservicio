import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambiarPasswordAdminDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  empresaId: string;

  @ApiProperty({ required: false, description: 'Contraseña nueva (vacío = autogenerada)' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  passwordNueva?: string;
}