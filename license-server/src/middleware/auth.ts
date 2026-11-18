import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  company?: { id: string; email: string };
  isAdmin?: boolean;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.company = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

/**
 * Autenticación opcional: si viene un token válido se asocia la empresa;
 * si no viene o es inválido, la petición continúa de forma anónima.
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'secret') as any;
    req.company = { id: payload.sub, email: payload.email };
  } catch {
    // Token inválido: se procesa igual, pero sin empresa asociada.
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    if (!payload.isAdmin) {
      return res.status(403).json({ message: 'Acceso solo para administradores' });
    }
    req.isAdmin = true;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}