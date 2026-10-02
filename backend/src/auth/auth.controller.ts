import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { CambiarPasswordProveedorDto } from './dto/cambiar-password-proveedor.dto';
import { ResetearCredencialesDto } from './dto/resetear-credenciales.dto';
import { CambiarPasswordAdminDto } from './dto/cambiar-password-admin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ProviderGuard } from './guards/provider.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const usuario = (dto as any).usuario || (dto as any).email;
    return this.authService.login(usuario, dto.password);
  }

  @Post('login-proveedor')
  async loginProveedor(@Body() dto: LoginDto) {
    return this.authService.loginProveedor(dto.usuario, dto.password);
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
}