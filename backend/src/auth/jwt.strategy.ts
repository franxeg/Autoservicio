import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { INSTANCIA_APP } from './instancia';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'cambia-esto-por-un-secreto-super-seguro-min-32-caracteres',
    });
  }

  async validate(payload: any) {
    // Las sesiones se invalidan cuando se reinicia el backend (nueva instancia).
    if (!payload || payload.instancia !== INSTANCIA_APP) {
      throw new UnauthorizedException('La sesion expiro. Inicie sesion nuevamente.');
    }
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      rol: payload.rol,
      sucursalId: payload.sucursalId,
      empresaId: payload.empresaId,
      proveedor: payload.proveedor === true,
    };
  }
}
