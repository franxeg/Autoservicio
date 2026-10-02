import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SetupAdminDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @MinLength(6)
  password: string;
}