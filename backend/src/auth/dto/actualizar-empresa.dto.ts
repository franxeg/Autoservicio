import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ActualizarEmpresaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}
