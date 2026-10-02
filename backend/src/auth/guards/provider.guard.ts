import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ProviderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.proveedor !== true) {
      throw new ForbiddenException('Acceso exclusivo del proveedor.');
    }
    return true;
  }
}