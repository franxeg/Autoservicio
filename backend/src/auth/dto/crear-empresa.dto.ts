import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CrearEmpresaDto {
  @IsString()
  @IsNotEmpty()
  nombreEmpresa: string;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsString()
  @IsNotEmpty()
  usuarioSetup: string;
}