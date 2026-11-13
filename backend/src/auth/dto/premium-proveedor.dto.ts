import { IsBoolean, IsOptional, IsNumber, Min } from 'class-validator';

export class PremiumProveedorDto {
  @IsBoolean()
  isPremium: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  days?: number;
}
