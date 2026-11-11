import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

export default function licenseRoutes(prisma: PrismaClient) {
  const router = Router();

  // Verificar estado de licencia (requiere auth)
  router.get('/status', requireAuth, async (req: AuthRequest, res, next) => {
    try {
      const company = await prisma.company.findUnique({ where: { id: req.company!.id } });
      if (!company) return res.status(404).json({ message: 'Empresa no encontrada' });

      const now = new Date();
      const isTrial = !company.isPremium && now < company.trialEnd;
      const trialDaysLeft = isTrial ? Math.max(0, Math.ceil((company.trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
      const isPremium = company.isPremium && (!company.premiumExpiry || now < company.premiumExpiry);

      res.json({
        isPremium: isPremium || isTrial,
        isTrial,
        trialDaysLeft,
        premiumExpiry: company.premiumExpiry,
        trialEnd: company.trialEnd,
        licenseKey: company.licenseKey,
        nombre: company.nombre,
      });
    } catch (err) {
      next(err);
    }
  });

  // Cambiar contraseña (requiere auth)
  router.post('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
    try {
      const { passwordActual, passwordNueva } = req.body;
      if (!passwordActual || !passwordNueva) {
        return res.status(400).json({ message: 'passwordActual y passwordNueva son requeridos' });
      }
      if (passwordNueva.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      }

      const company = await prisma.company.findUnique({ where: { id: req.company!.id } });
      if (!company) return res.status(404).json({ message: 'Empresa no encontrada' });

      const bcrypt = require('bcryptjs');
      const valid = await bcrypt.compare(passwordActual, company.password);
      if (!valid) {
        return res.status(401).json({ message: 'La contraseña actual no es correcta' });
      }

      const hashed = await bcrypt.hash(passwordNueva, 10);
      await prisma.company.update({
        where: { id: company.id },
        data: { password: hashed },
      });

      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      next(err);
    }
  });

  // Activar premium con código (se validará con el admin o webhook de pago)
  router.post('/activate', requireAuth, async (req: AuthRequest, res, next) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: 'Código requerido' });

      // Por ahora, el código es el licenseKey de la misma empresa (activación manual por admin).
      // En el futuro, se validará contra un sistema de pagos.
      const company = await prisma.company.findUnique({ where: { id: req.company!.id } });
      if (!company) return res.status(404).json({ message: 'Empresa no encontrada' });

      // Activar por 30 días (se renueva con cada pago)
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.company.update({
        where: { id: company.id },
        data: { isPremium: true, premiumExpiry: expiry },
      });

      res.json({ message: 'Premium activado', expiry });
    } catch (err) {
      next(err);
    }
  });

  return router;
}