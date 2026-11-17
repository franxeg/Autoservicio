import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Observable, firstValueFrom, from } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Rutas públicas (login): sin contexto de tenant
    if (!user) return next.handle();

    // Usuario temporal (SETUP): solo puede completar la configuración inicial del admin
    const path = (req.originalUrl || '').split('?')[0];
    if (user.rol === 'SETUP' && !path.endsWith('/api/auth/setup-admin')) {
      throw new ForbiddenException('Debe completar la configuración inicial de su cuenta.');
    }

    const empresaId: string | undefined = user.empresaId;
    if (!empresaId) {
      throw new UnauthorizedException('Token inválido. Inicie sesión nuevamente.');
    }

    return from(this.prisma.runWithTenant(empresaId, () => firstValueFrom(next.handle())));
  }
}