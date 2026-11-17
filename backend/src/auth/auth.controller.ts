import { Controller, Post, Body, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { SetupInicialDto } from './dto/setup-inicial.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ActualizarEmpresaDto } from './dto/actualizar-empresa.dto';
import { ReiniciarSistemaDto } from './dto/reiniciar-sistema.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('has-users')
  async hasUsers() {
    return this.authService.hasUsers();
  }

  /** Elimina los datos locales (con respaldo previo) para registrar otra empresa. */
  @Post('reiniciar-sistema')
  async reiniciarSistema(@Body() dto: ReiniciarSistemaDto) {
    return this.authService.reiniciarSistema(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const usuario = (dto as any).usuario || (dto as any).email;
    return this.authService.login(usuario, dto.password);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('empresa')
  async obtenerEmpresa(@CurrentUser() user: any) {
    return this.authService.obtenerEmpresa(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('empresa')
  async actualizarEmpresa(@CurrentUser() user: any, @Body() dto: ActualizarEmpresaDto) {
    return this.authService.actualizarEmpresa(user, dto);
  }

  @Post('setup-inicial')
  async setupInicial(@Body() dto: SetupInicialDto) {
    return this.authService.setupInicial(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('setup-admin')
  async setupAdmin(@CurrentUser() user: any, @Body() dto: SetupAdminDto) {
    return this.authService.setupAdmin(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: any) {
    return this.authService.me(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('cambiar-password')
  async cambiarPassword(@CurrentUser() user: any, @Body() body: any) {
    return this.authService.cambiarPasswordUsuario(user.id, body.passwordActual, body.passwordNueva);
  }
}