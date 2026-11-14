import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetearCredencialesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  empresaId: string;

  @ApiProperty({ required: false, description: 'Usuario temporal (vacío = autogenerado)' })
  @IsOptional()
  @IsString()
  usuarioSetup?: string;

  @ApiProperty({ required: false, description: 'Contraseña temporal (vacío = autogenerada)' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  passwordTemporal?: string;
}