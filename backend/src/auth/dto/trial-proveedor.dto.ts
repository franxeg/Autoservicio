import { IsBoolean } from 'class-validator';

export class TrialProveedorDto {
  @IsBoolean()
  activo: boolean;
}
