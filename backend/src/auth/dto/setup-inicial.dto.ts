import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class SetupInicialDto {
  @IsString()
  @IsNotEmpty()
  nombreEmpresa: string;

  @IsOptional()
  @IsString()
  nombre?: string; // nombre visible del administrador (opcional)

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
