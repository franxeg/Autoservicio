import { IsOptional, IsString } from 'class-validator';

export class ReiniciarSistemaDto {
  /**
   * Identidad de la empresa en el license-server. Se usa solo en
   * instalaciones anteriores a la version que guarda estos datos en la base
   * local (el backend valida que el usuario coincida antes de desactivarla).
   */
  @IsOptional()
  @IsString()
  licenseCompanyId?: string;

  @IsOptional()
  @IsString()
  licenseUsername?: string;
}
