import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @MinLength(6)
  passwordNueva: string;

  @IsString()
  @IsNotEmpty()
  codigo: string;
}
