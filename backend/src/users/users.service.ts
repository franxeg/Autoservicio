import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private async countAdminsActivos() {
    return this.prisma.tenant.usuario.count({ where: { rol: Rol.ADMIN, activo: true } });
  }

  // Trabajamos con una sucursal única por empresa: si no se especifica, se asigna la existente.
  private async sucursalIdDefault(): Promise<string | undefined> {
    const s = await this.prisma.tenant.sucursal.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    return s?.id;
  }

  private async verificarNombreDuplicado(nombre: string, ignorarId?: string) {
    const existe = await this.prisma.tenant.usuario.findFirst({
      where: {
        nombre: { equals: nombre.trim(), mode: 'insensitive' },
        NOT: { id: ignorarId ?? '__ninguno__' },
      },
      select: { username: true },
    });
    if (existe) {
      throw new ConflictException(`Ya existe un empleado con ese nombre (usuario: '${existe.username}'). Elegí otro.`);
    }
  }

  async findAll(sucursalId?: string) {
    return this.prisma.tenant.usuario.findMany({
      where: sucursalId ? { sucursalId } : {},
      select: { id: true, username: true, email: true, nombre: true, rol: true, activo: true, sucursalId: true, sucursal: true, createdAt: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.tenant.usuario.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, nombre: true, rol: true, activo: true, sucursalId: true, sucursal: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.tenant.usuario.findFirst({ where: { OR: [{ username: dto.username }, { email: dto.username }] } });
    if (exists) throw new ConflictException('Usuario ya registrado');
    if (dto.email) {
      const emailExists = await this.prisma.tenant.usuario.findUnique({ where: { email: dto.email } });
      if (emailExists) throw new ConflictException('Email ya registrado');
    }
    await this.verificarNombreDuplicado(dto.nombre);
    const hashed = await bcrypt.hash(dto.password, 10);
    if (dto.rol === Rol.ADMIN && (await this.countAdminsActivos()) > 0) {
      throw new ConflictException('La empresa ya tiene un ADMIN. El rol de administrador es único.');
    }
    const data: any = { username: dto.username, password: hashed, nombre: dto.nombre, rol: dto.rol, sucursalId: dto.sucursalId || await this.sucursalIdDefault(), empresaId: this.prisma.empresaId! };
    if (dto.email) data.email = dto.email;
    try {
      const user = await this.prisma.tenant.usuario.create({
        data,
        select: { id: true, username: true, email: true, nombre: true, rol: true, activo: true, sucursalId: true },
      });
      return user;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Usuario o email ya registrado');
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    if (dto.nombre && dto.nombre.trim() !== user.nombre) await this.verificarNombreDuplicado(dto.nombre, id);
    if (user.rol === Rol.ADMIN) {
      if (dto.activo === false) throw new ConflictException('El ADMIN de la empresa no se puede desactivar.');
      if (dto.rol && dto.rol !== Rol.ADMIN) throw new ConflictException('El ADMIN de la empresa no puede cambiar de rol.');
    }
    if (dto.rol === Rol.ADMIN && user.rol !== Rol.ADMIN && (await this.countAdminsActivos()) > 0) {
      throw new ConflictException('La empresa ya tiene un ADMIN. El rol de administrador es único.');
    }
    const data: any = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.tenant.usuario.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, nombre: true, rol: true, activo: true, sucursalId: true },
    });
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    if (user.rol === Rol.ADMIN) throw new ConflictException('El ADMIN de la empresa no se puede eliminar.');
    const [ventas, cajas] = await Promise.all([
      this.prisma.tenant.venta.count({ where: { usuarioId: id } }),
      this.prisma.tenant.caja.count({ where: { usuarioId: id } }),
    ]);
    if (ventas > 0 || cajas > 0) {
      throw new ConflictException(
        `No se puede eliminar: el empleado tiene ${ventas} venta(s) y ${cajas} caja(s) registradas. Desactivá su cuenta en su lugar.`,
      );
    }
    await this.prisma.tenant.usuario.delete({ where: { id } });
    return { eliminado: true };
  }
}