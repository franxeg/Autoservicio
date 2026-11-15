import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, InternalServerErrorException, NotFoundException, BadGatewayException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Rol, Prisma } from '@prisma/client';
import { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { SetupInicialDto } from './dto/setup-inicial.dto';
import { ResetearCredencialesDto } from './dto/resetear-credenciales.dto';
import { CambiarPasswordAdminDto } from './dto/cambiar-password-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ActualizarEmpresaDto } from './dto/actualizar-empresa.dto';
import { sembrarCatalogoInicial } from './catalogo-inicial';
import { INSTANCIA_APP } from './instancia';
import * as bcrypt from 'bcryptjs';
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

  private lsTokenCache: { token: string; expires: number } | null = null;
  private readonly logger = new Logger(AuthService.name);

  private getLicenseUrl(): string {
    return process.env.LICENSE_SERVER_URL || 'https://autoservicio-license-server.onrender.com';
  }

  /**
   * Token de administrador del license-server para que el backend actúe como
   * proxy autenticado del panel de proveedor (las credenciales admin nunca
   * viajan al frontend).
   */
  private async lsAdminToken(): Promise<string> {
    if (this.lsTokenCache && this.lsTokenCache.expires > Date.now()) {
      return this.lsTokenCache.token;
    }
    const adminUser = process.env.LICENSE_SERVER_ADMIN_USER || process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.LICENSE_SERVER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin';
    let res: any;
    try {
      res = await fetch(`${this.getLicenseUrl()}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUser, password: adminPass }),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con el servidor de licencias. Verificá tu conexión a internet.');
    }
    if (!res.ok) {
      throw new BadGatewayException('No se pudo autenticar con el servidor de licencias. Configurá LICENSE_SERVER_ADMIN_USER y LICENSE_SERVER_ADMIN_PASSWORD en config.env con las credenciales de administrador del license-server (ADMIN_USER / ADMIN_PASSWORD).');
    }
    const data = await res.json();
    this.lsTokenCache = { token: data.access_token, expires: Date.now() + 5 * 60 * 1000 };
    return data.access_token;
  }

  private async lsRequest(path: string, init: any = {}): Promise<any> {
    const token = await this.lsAdminToken();
    let res: any;
    try {
      res = await fetch(`${this.getLicenseUrl()}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con el servidor de licencias. Verificá tu conexión a internet.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) this.lsTokenCache = null;
      throw new BadGatewayException(data?.message || 'El servidor de licencias devolvió un error.');
    }
    return data;
  }

  /** Indica si la instalación local ya tiene usuarios (para decidir setup o login). */
  async hasUsers() {
    const count = await this.prisma.runAsSystem((tx) => tx.usuario.count());
    return { hasUsers: count > 0 };
  }

  /** Cambio de contraseña local validando el código generado por el proveedor. */
  async forgotPassword(dto: ForgotPasswordDto) {
    const usuario = dto.usuario.trim();
    const codigo = dto.codigo.trim();
    if (!usuario || !codigo) throw new BadRequestException('Ingresá tu usuario y el código de recuperación.');

    const user = await this.prisma.runAsSystem((tx) =>
      tx.usuario.findFirst({ where: { OR: [{ username: usuario }, { email: usuario }] } }),
    );
    if (!user || !user.activo) {
      throw new BadRequestException(`El usuario '${usuario}' no existe en esta instalación o está inactivo.`);
    }

    const validacion = await this.validarCodigoProveedor(user, codigo, dto.passwordNueva);
    if (!validacion.ok) {
      throw new BadRequestException(validacion.mensaje || 'Código inválido o expirado.');
    }

    const password = await bcrypt.hash(dto.passwordNueva, 10);
    await this.prisma.runAsSystem((tx) => tx.usuario.update({ where: { id: user.id }, data: { password } }));
    return { ok: true, message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.' };
  }

  /**
   * Valida el código de recuperación que entrega el proveedor.
   *
   * 1) Camino normal: se lo envía al endpoint público del license-server junto
   *    con el usuario local. Ese endpoint compara el código contra la empresa
   *    cuyo `username` coincide exactamente, así que falla si el usuario local
   *    y el de la empresa no son idénticos (mayúsculas, espacios, etc.).
   * 2) Respaldo: se consulta la lista de empresas del panel de proveedor, que
   *    incluye el código vigente. Si el código coincide con alguno vigente se
   *    acepta, sin depender de que los nombres de usuario coincidan. Esto
   *    también cubre instalaciones con una versión anterior del license-server.
   *
   * El código lo genera únicamente el proveedor (4 dígitos, 30 minutos, un solo
   * uso), por eso se considera suficiente para autorizar el cambio.
   */
  private async validarCodigoProveedor(
    user: any,
    codigo: string,
    passwordNueva: string,
  ): Promise<{ ok: boolean; mensaje?: string }> {
    const licenseUrl = this.getLicenseUrl();

    // 1) Endpoint público de recuperación.
    try {
      const res = await fetch(`${licenseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, code: codigo, newPassword: passwordNueva }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };
      this.logger.warn(
        `Recuperación rechazada por el servidor de licencias (usuario '${user.username}', HTTP ${res.status}): ${data?.message || 'sin detalle'}`,
      );
    } catch (e: any) {
      this.logger.warn(`No se pudo contactar al servidor de licencias en la recuperación: ${e?.message || e}`);
      return { ok: false, mensaje: 'No se pudo validar el código. Verificá tu conexión a internet.' };
    }

    // 2) Respaldo: código vigente según el panel del proveedor.
    const detalleUsuario = `Usuario de esta instalación: '${user.username}'.`;
    try {
      const empresas: any[] = (await this.proveedorListarEmpresas()) || [];
      const ahora = Date.now();
      const empresa = empresas.find(
        (c: any) => c?.resetCode && String(c.resetCode).trim() === codigo,
      );
      const vigente = !!empresa && !!empresa.resetCodeExpiry && new Date(empresa.resetCodeExpiry).getTime() > ahora;

      if (!vigente) {
        const proximo = empresas
          .filter((c: any) => c?.resetCode && c?.resetCodeExpiry)
          .map((c: any) => new Date(c.resetCodeExpiry))
          .filter((d: Date) => !isNaN(d.getTime()) && d.getTime() > ahora)
          .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
        const vence = proximo
          ? ` El código vigente vence el ${proximo.toLocaleString('es-AR')}.`
          : '';
        return { ok: false, mensaje: `Código inválido o expirado. ${detalleUsuario}${vence}` };
      }

      // Consumir el código en el servidor de licencias (mantiene la contraseña
      // de la empresa sincronizada). Si el servidor no lo acepta igual sirve:
      // el código era válido y vigente según el panel del proveedor.
      if (empresa.username) {
        try {
          const res = await fetch(`${licenseUrl}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: empresa.username, code: codigo, newPassword: passwordNueva }),
          });
          if (!res.ok) {
            this.logger.warn(
              `El servidor de licencias no consumió el código de '${empresa.username}' (HTTP ${res.status}); la contraseña local se actualiza igual.`,
            );
          }
        } catch (e: any) {
          this.logger.warn(`No se pudo consumir el código en el servidor de licencias: ${e?.message || e}`);
        }
      }
      this.logger.log(
        `Recuperación aceptada con el código del panel (empresa '${empresa.username || 'sin usuario'}') para el usuario local '${user.username}'.`,
      );
      return { ok: true };
    } catch (e: any) {
      this.logger.warn(`No se pudo consultar el panel del proveedor para validar el código: ${e?.message || e}`);
    }

    return { ok: false, mensaje: `Código inválido o expirado. ${detalleUsuario}` };
  }

  async obtenerEmpresa(user: any) {
    const empresa = await this.prisma.tenant.empresa.findUnique({ where: { id: user.empresaId } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    const sucursal = user.sucursalId
      ? await this.prisma.tenant.sucursal.findUnique({ where: { id: user.sucursalId } })
      : await this.prisma.tenant.sucursal.findFirst({ where: { empresaId: user.empresaId } });
    return {
      id: empresa.id,
      nombre: empresa.nombre,
      telefono: sucursal?.telefono || '',
      direccion: sucursal?.direccion || '',
    };
  }

  async actualizarEmpresa(user: any, dto: ActualizarEmpresaDto) {
    const nombre = dto.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre de la empresa es obligatorio.');
    await this.prisma.tenant.empresa.update({
      where: { id: user.empresaId },
      data: { nombre },
    });

    let sucursalId = user.sucursalId;
    if (!sucursalId) {
      const sucursal = await this.prisma.tenant.sucursal.findFirst({ where: { empresaId: user.empresaId } });
      sucursalId = sucursal?.id;
    }
    if (sucursalId) {
      await this.prisma.tenant.sucursal.update({
        where: { id: sucursalId },
        data: { telefono: dto.telefono?.trim() || null, direccion: dto.direccion?.trim() || null },
      });
    }
    return { ok: true, nombre, telefono: dto.telefono?.trim() || '', direccion: dto.direccion?.trim() || '' };
  }

  // --- Proxy de proveedor hacia el license-server ---

  async proveedorListarEmpresas() {
    return this.lsRequest('/api/admin/companies');
  }

  async proveedorCambiarPremium(id: string, isPremium: boolean, days = 30) {
    return this.lsRequest(`/api/admin/companies/${encodeURIComponent(id)}/premium`, {
      method: 'PATCH',
      body: JSON.stringify({ isPremium, days }),
    });
  }

  async proveedorGenerarCodigo(id: string) {
    return this.lsRequest(`/api/admin/companies/${encodeURIComponent(id)}/reset-code`, {
      method: 'POST',
    });
  }

  async login(usuario: string, password: string) {
    return this.prisma.runAsSystem(async (tx) => {
      const user = await tx.usuario.findFirst({
        where: { OR: [{ username: usuario }, { email: usuario }] },
        include: { empresa: true, sucursal: true },
      });
      if (!user || !user.activo) throw new UnauthorizedException('Credenciales inválidas. Verifique usuario y contraseña.');
      const valid = await bcrypt.compare(password, user.password);

      // Si la contraseña local no coincide, intentar sincronizar con el license-server
      // (el proveedor pudo haber reseteado la contraseña en la nube)
      if (!valid) {
        const licenseUrl = process.env.LICENSE_SERVER_URL || 'https://autoservicio-license-server.onrender.com';
        try {
          const res = await fetch(`${licenseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usuario, password }),
          });
          if (res.ok) {
            const data = await res.json();
            // La contraseña es válida en el license-server: actualizar localmente
            const hashed = await bcrypt.hash(password, 10);
            await tx.usuario.update({ where: { id: user.id }, data: { password: hashed } });
            // Continuar con el login normal
          } else {
            throw new UnauthorizedException('Credenciales inválidas. Verifique usuario y contraseña.');
          }
        } catch (e: any) {
          if (e instanceof UnauthorizedException) throw e;
          // Sin conexión: usar solo contraseña local
          throw new UnauthorizedException('Credenciales inválidas. Verifique usuario y contraseña.');
        }
      }

      const payload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        rol: user.rol,
        sucursalId: user.sucursalId,
        empresaId: user.empresaId,
        instancia: INSTANCIA_APP,
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

  async cambiarPasswordUsuario(userId: string, passwordActual: string, passwordNueva: string) {
    const user = await this.prisma.tenant.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const valid = await bcrypt.compare(passwordActual, user.password);
    if (!valid) throw new UnauthorizedException('La contraseña actual no es correcta');
    if (!passwordNueva || passwordNueva.length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    const password = await bcrypt.hash(passwordNueva, 10);
    await this.prisma.tenant.usuario.update({ where: { id: userId }, data: { password } });
    return { ok: true, message: 'Contraseña actualizada correctamente' };
  }

  async loginProveedor(usuario: string, password: string) {
    const expectedUser = process.env.PROVIDER_USER;
    const expectedPass = process.env.PROVIDER_PASSWORD;
    if (!expectedUser || !expectedPass || !credencialesCoinciden(usuario, expectedUser) || !credencialesCoinciden(password, expectedPass)) {
      throw new UnauthorizedException('Credenciales de proveedor inválidas.');
    }
    const payload = { sub: 'proveedor', rol: 'PROVEEDOR', proveedor: true, instancia: INSTANCIA_APP };
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
      if (passwordNueva.length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
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

  async setupInicial(dto: SetupInicialDto) {
    /**
     * Registro inicial obligatorio:
     * 1) La empresa/usuario se registra en el license-server (requiere internet).
     * 2) Recién después se crean empresa, sucursal y admin locales.
     * Si ya existe el usuario en el license-server (reinstalación), se valida
     * el login con la misma contraseña para poder continuar.
     */
    const usuario = dto.usuario.trim();
    const nombreEmpresa = dto.nombreEmpresa.trim();
    if (!usuario || !nombreEmpresa) throw new BadRequestException('Usuario y nombre de la empresa son obligatorios.');

    const existentes = await this.prisma.runAsSystem((tx) => tx.usuario.count());
    if (existentes > 0) {
      throw new ConflictException('El sistema ya está configurado. Iniciá sesión con tu usuario.');
    }
    const localExists = await this.prisma.runAsSystem((tx) =>
      tx.usuario.findFirst({ where: { OR: [{ username: usuario }, { email: usuario }] } }),
    );
    if (localExists) throw new ConflictException(`El usuario '${usuario}' ya está en uso. Elegí otro.`);

    // 1) Registrar (o recuperar) la empresa en el license-server.
    const licenseUrl = this.getLicenseUrl();
    let license: { token: string; licenseKey: string | null; company: any } | null = null;

    let registerRes: any;
    try {
      registerRes = await fetch(`${licenseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreEmpresa, username: usuario, password: dto.password }),
      });
    } catch {
      throw new BadRequestException('No se pudo conectar al servidor de licencias. Verificá tu conexión a internet e intentá nuevamente.');
    }

    if (registerRes.ok) {
      const data = await registerRes.json();
      license = { token: data.token, licenseKey: data.licenseKey, company: data.company };
    } else if (registerRes.status === 409) {
      // El usuario ya existe en el license-server: puede ser una reinstalación.
      let loginRes: any;
      try {
        loginRes = await fetch(`${licenseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usuario, password: dto.password }),
        });
      } catch {
        throw new BadRequestException('No se pudo conectar al servidor de licencias. Verificá tu conexión a internet e intentá nuevamente.');
      }
      if (!loginRes.ok) {
        throw new ConflictException('Ese usuario ya está registrado en el servidor de licencias con otra contraseña. Ingresá la contraseña original o elegí otro usuario.');
      }
      const data = await loginRes.json();
      license = { token: data.access_token, licenseKey: data.company?.licenseKey ?? null, company: data.company };
    } else {
      const data = await registerRes.json().catch(() => ({}));
      throw new BadRequestException(data?.message || 'No se pudo registrar en el servidor de licencias. Intentá nuevamente.');
    }

    // 2) Con el registro confirmado, creamos los datos locales.
    const resultado = await this.prisma.runAsSystem(async (tx) => {
      const empresaId = 'empresa-principal';
      const sucursalId = 'sucursal-central';

      const empresa = await tx.empresa.upsert({
        where: { id: empresaId },
        update: { nombre: nombreEmpresa },
        create: { id: empresaId, nombre: nombreEmpresa },
      });

      await tx.sucursal.upsert({
        where: { id: sucursalId },
        update: { nombre: 'Casa Central', direccion: dto.direccion?.trim() || null, telefono: dto.telefono?.trim() || null, empresaId: empresa.id },
        create: { id: sucursalId, nombre: 'Casa Central', direccion: dto.direccion?.trim() || null, telefono: dto.telefono?.trim() || null, empresaId: empresa.id },
      });

      const password = await bcrypt.hash(dto.password, 10);
      const admin = await tx.usuario.create({
        data: {
          username: usuario,
          password,
          nombre: dto.nombre?.trim() || usuario,
          rol: Rol.ADMIN,
          sucursalId,
          empresaId: empresa.id,
        },
      });

      const payload = {
        sub: admin.id,
        username: admin.username,
        email: admin.email,
        rol: admin.rol,
        sucursalId: admin.sucursalId,
        empresaId: admin.empresaId,
        instancia: INSTANCIA_APP,
      };
      const access_token = this.jwtService.sign(payload);
      const { password: _, ...result } = admin;
      return { access_token, user: result, setupCompletado: true, license };
    });

    // 3) Catálogo de productos precargado (solo si el instalador lo incluye).
    // Se hace fuera de la transacción para que un problema con el catálogo no
    // impida completar el registro de la empresa.
    try {
      const cargado = await this.prisma.runAsSystem((tx) =>
        sembrarCatalogoInicial(tx, 'empresa-principal', 'sucursal-central'),
      );
      if (cargado.productos > 0) {
        this.logger.log(`Catálogo inicial cargado: ${cargado.categorias} categorías, ${cargado.productos} productos.`);
      }
    } catch (e: any) {
      this.logger.warn(`No se pudo cargar el catálogo inicial: ${e?.message || e}`);
    }

    return resultado;
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
        instancia: INSTANCIA_APP,
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
