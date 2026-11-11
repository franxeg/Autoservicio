import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class SetupInicialDto {
  @IsString()
  @IsNotEmpty()
  nombreEmpresa: string;

  @IsString()
  @IsNotEmpty()
  nombre: string; // nombre y apellido del admin

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}