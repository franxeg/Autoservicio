import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Rol, Prisma } from '@prisma/client';
import { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { ResetearCredencialesDto } from './dto/resetear-credenciales.dto';
import { CambiarPasswordAdminDto } from './dto/cambiar-password-admin.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function generarPasswordTemporal(): string {
  return randomBytes(6).toString('base64url');
}

function credencialesCoinciden(ingresada: string, esperada: string): boolean {
  const a = Buffer.from(ingresada);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(usuario: string, password: string) {
    return this.prisma.runAsSystem(async (tx) => {
      const user = await tx.usuario.findFirst({
        where: { OR: [{ username: usuario }, { email: usuario }] },
        include: { empresa: true, sucursal: true },
      });
      if (!user || !user.activo) throw new UnauthorizedException('Credenciales inválidas. Verifique usuario y contraseña.');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new UnauthorizedException('Credenciales inválidas. Verifique usuario y contraseña.');

      const payload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        rol: user.rol,
        sucursalId: user.sucursalId,
        empresaId: user.empresaId,
      };
      const access_token = this.jwtService.sign(payload);
      const { password: _, ...result } = user;
      return { access_token, user: result, setupPendiente: user.rol === Rol.SETUP };
    });
  }

  async me(userId: string) {
    const user = await this.prisma.tenant.usuario.findUnique({
      where: { id: userId },
      include: { sucursal: true, empresa: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const { password: _, ...result } = user;
    return result;
  }

  async loginProveedor(usuario: string, password: string) {
    const expectedUser = process.env.PROVIDER_USER;
    const expectedPass = process.env.PROVIDER_PASSWORD;
    if (!expectedUser || !expectedPass || !credencialesCoinciden(usuario, expectedUser) || !credencialesCoinciden(password, expectedPass)) {
      throw new UnauthorizedException('Credenciales de proveedor inválidas.');
    }
    const payload = { sub: 'proveedor', rol: 'PROVEEDOR', proveedor: true };
    return { access_token: this.jwtService.sign(payload), rol: 'PROVEEDOR', empresa: 'Panel de proveedor' };
  }

  async cambiarPasswordProveedor(passwordActual: string, passwordNueva: string) {
    const esperada = process.env.PROVIDER_PASSWORD;
    if (!esperada || !credencialesCoinciden(passwordActual, esperada)) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    if (credencialesCoinciden(passwordNueva, esperada)) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    }
    try {
      const envPath = join(process.cwd(), '.env');
      const contenido = readFileSync(envPath, 'utf8');
      const escapada = passwordNueva.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const nuevaLinea = `PROVIDER_PASSWORD="${escapada}"`;
      const actualizado = contenido.includes('PROVIDER_PASSWORD=')
        ? contenido.replace(/^PROVIDER_PASSWORD=.*$/m, nuevaLinea)
        : `${contenido}\n${nuevaLinea}\n`;
      writeFileSync(envPath, actualizado, 'utf8');
      process.env.PROVIDER_PASSWORD = passwordNueva;
      return { ok: true, mensaje: 'Contraseña de proveedor actualizada. Se aplicó al instante.' };
    } catch {
      throw new InternalServerErrorException('No se pudo guardar el cambio. Revisá los permisos del archivo .env.');
    }
  }

  async crearEmpresa(dto: CrearEmpresaDto) {
    return this.prisma.runAsSystem(async (tx) => {
      const exists = await tx.usuario.findFirst({
        where: { OR: [{ username: dto.usuarioSetup }, { email: dto.usuarioSetup }] },
      });
      if (exists) throw new ConflictException(`El usuario '${dto.usuarioSetup}' ya está en uso. Elegí otro para el acceso inicial.`);

      const passwordTemporal = generarPasswordTemporal();
      const password = await bcrypt.hash(passwordTemporal, 10);

      const empresa = await tx.empresa.create({
        data: { nombre: dto.nombreEmpresa, cuit: dto.cuit ?? null },
      });
      const sucursal = await tx.sucursal.create({
        data: { nombre: 'Casa Central', empresaId: empresa.id },
      });
      const setup = await tx.usuario.create({
        data: {
          username: dto.usuarioSetup,
          password,
          nombre: 'Configuración inicial',
          rol: Rol.SETUP,
          sucursalId: sucursal.id,
          empresaId: empresa.id,
        },
      });

      return {
        empresa,
        sucursal,
        credenciales: {
          usuario: setup.username,
          password: passwordTemporal,
          passwordTemporal: true,
        },
        nota: 'Entregá estas credenciales al cliente. Al primer ingreso deberá crear su usuario administrador.',
      };
    });
  }

  async resetearCredenciales(dto: ResetearCredencialesDto) {
    return this.prisma.runAsSystem(async (tx) => {
      const empresa = await tx.empresa.findUnique({
        where: { id: dto.empresaId },
        include: { sucursales: true },
      });
      if (!empresa) throw new NotFoundException('Empresa no encontrada.');
      if (empresa.sucursales.length === 0) {
        throw new BadRequestException('La empresa no tiene sucursales.');
      }

      await tx.usuario.updateMany({ where: { empresaId: empresa.id }, data: { activo: false } });

      const passwordTemporal = dto.passwordTemporal?.trim() || generarPasswordTemporal();
      const password = await bcrypt.hash(passwordTemporal, 10);
      const username = dto.usuarioSetup?.trim()
        || `acceso_${randomBytes(4).toString('hex')}`;

      let setup;
      try {
        setup = await tx.usuario.create({
          data: {
            username,
            password,
            nombre: 'Configuración inicial',
            rol: Rol.SETUP,
            sucursalId: empresa.sucursales[0].id,
            empresaId: empresa.id,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(`El usuario '${username}' ya está en uso. Elegí otro.`);
        }
        throw error;
      }

      return {
        empresa,
        credenciales: {
          usuario: setup.username,
          password: passwordTemporal,
          passwordTemporal: true,
        },
        nota: 'Se bloquearon los accesos anteriores. El cliente deberá crear un nuevo administrador al ingresar con estas credenciales.',
      };
    });
  }

  async listarEmpresas() {
    return this.prisma.runAsSystem(async (tx) => {
      const empresas = await tx.empresa.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sucursales: true, usuarios: true } } },
      });
      const pendientes = await tx.usuario.groupBy({
        by: ['empresaId'],
        where: { rol: Rol.SETUP, activo: true },
        _count: true,
      });
      const pendientesPorEmpresa = new Map(pendientes.map(p => [p.empresaId, p._count]));
      const admins = await tx.usuario.findMany({
        where: { rol: Rol.ADMIN, activo: true },
        select: { empresaId: true, username: true },
      });
      const adminPorEmpresa = new Map(admins.map(a => [a.empresaId, a.username]));
      return empresas.map((e) => {
        const setupPendiente = (pendientesPorEmpresa.get(e.id) ?? 0) > 0;
        return {
          id: e.id,
          nombre: e.nombre,
          cuit: e.cuit,
          activa: e.activa,
          createdAt: e.createdAt,
          sucursales: e._count.sucursales,
          usuarios: e._count.usuarios,
          adminUsuario: adminPorEmpresa.get(e.id) ?? null,
          setupPendiente,
          configurada: !setupPendiente,
        };
      });
    });
  }

  async cambiarPasswordAdmin(dto: CambiarPasswordAdminDto) {
    return this.prisma.runAsSystem(async (tx) => {
      const admin = await tx.usuario.findFirst({
        where: { empresaId: dto.empresaId, rol: Rol.ADMIN, activo: true },
      });
      if (!admin) throw new NotFoundException('La empresa no tiene un ADMIN activo.');
      const passwordNueva = dto.passwordNueva?.trim() || generarPasswordTemporal();
      if (passwordNueva.length < 4) throw new BadRequestException('La contraseña debe tener al menos 4 caracteres');
      const password = await bcrypt.hash(passwordNueva, 10);
      await tx.usuario.update({ where: { id: admin.id }, data: { password } });
      return {
        empresa: { id: admin.empresaId },
        credenciales: {
          usuario: admin.username,
          password: passwordNueva,
          passwordTemporal: !dto.passwordNueva,
        },
        nota: 'La contraseña del ADMIN fue actualizada. Los demás usuarios no se vieron afectados.',
      };
    });
  }

  async setupAdmin(userId: string, dto: SetupAdminDto) {
    const setupUser = await this.prisma.tenant.usuario.findUnique({ where: { id: userId } });
    if (!setupUser) throw new UnauthorizedException('Usuario no encontrado o ya configurado.');
    if (setupUser.rol !== Rol.SETUP) throw new ForbiddenException('Esta operación es solo para cuentas pendientes de configuración.');

    try {
      const password = await bcrypt.hash(dto.password, 10);
      const admin = await this.prisma.tenant.usuario.create({
        data: {
          username: dto.usuario,
          password,
          nombre: dto.nombre,
          rol: Rol.ADMIN,
          sucursalId: setupUser.sucursalId,
          empresaId: setupUser.empresaId,
        },
      });
      await this.prisma.tenant.usuario.delete({ where: { id: setupUser.id } });

      const payload = {
        sub: admin.id,
        username: admin.username,
        email: admin.email,
        rol: admin.rol,
        sucursalId: admin.sucursalId,
        empresaId: admin.empresaId,
      };
      const access_token = this.jwtService.sign(payload);
      const { password: _, ...result } = admin;
      return { access_token, user: result, setupCompletado: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ese nombre de usuario ya está en uso. Elegí otro.');
      }
      throw error;
    }
  }
}