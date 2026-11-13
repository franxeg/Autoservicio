import { Controller, Post, Body, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { SetupInicialDto } from './dto/setup-inicial.dto';
import { CambiarPasswordProveedorDto } from './dto/cambiar-password-proveedor.dto';
import { ResetearCredencialesDto } from './dto/resetear-credenciales.dto';
import { CambiarPasswordAdminDto } from './dto/cambiar-password-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ActualizarEmpresaDto } from './dto/actualizar-empresa.dto';
import { PremiumProveedorDto } from './dto/premium-proveedor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ProviderGuard } from './guards/provider.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('has-users')
  async hasUsers() {
    return this.authService.hasUsers();
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

  @Post('login-proveedor')
  async loginProveedor(@Body() dto: LoginDto) {
    return this.authService.loginProveedor(dto.usuario, dto.password);
  }

  // Panel de proveedor: proxy autenticado hacia el license-server.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Get('proveedor/empresas')
  async proveedorEmpresas() {
    return this.authService.proveedorListarEmpresas();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Patch('proveedor/empresas/:id/premium')
  async proveedorPremium(@Param('id') id: string, @Body() dto: PremiumProveedorDto) {
    return this.authService.proveedorCambiarPremium(id, dto.isPremium, dto.days);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Post('proveedor/empresas/:id/reset-code')
  async proveedorResetCode(@Param('id') id: string) {
    return this.authService.proveedorGenerarCodigo(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Get('empresas')
  async listarEmpresas() {
    return this.authService.listarEmpresas();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Post('crear-empresa')
  async crearEmpresa(@Body() dto: CrearEmpresaDto) {
    return this.authService.crearEmpresa(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Post('cambiar-password-proveedor')
  async cambiarPasswordProveedor(@Body() dto: CambiarPasswordProveedorDto) {
    return this.authService.cambiarPasswordProveedor(dto.passwordActual, dto.passwordNueva);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Post('resetear-credenciales')
  async resetearCredenciales(@Body() dto: ResetearCredencialesDto) {
    return this.authService.resetearCredenciales(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProviderGuard)
  @Post('cambiar-password-admin')
  async cambiarPasswordAdmin(@Body() dto: CambiarPasswordAdminDto) {
    return this.authService.cambiarPasswordAdmin(dto);
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