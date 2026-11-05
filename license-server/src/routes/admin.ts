import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';

export default function adminRoutes(prisma: PrismaClient) {
  const router = Router();

  // Listar empresas
  router.get('/companies', requireAdmin, async (_req, res, next) => {
    try {
      const companies = await prisma.company.findMany({
        select: {
          id: true,
          nombre: true,
          email: true,
          licenseKey: true,
          isPremium: true,
          premiumExpiry: true,
          trialEnd: true,
          activo: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(companies);
    } catch (err) {
      next(err);
    }
  });

  // Activar/desactivar premium
  router.patch('/companies/:id/premium', requireAdmin, async (req, res, next) => {
    try {
      const { isPremium, days } = req.body;
      const data: any = { isPremium: !!isPremium };
      if (isPremium) {
        data.premiumExpiry = new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000);
      } else {
        data.premiumExpiry = null;
      }
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ id: company.id, nombre: company.nombre, isPremium: company.isPremium, premiumExpiry: company.premiumExpiry });
    } catch (err) {
      next(err);
    }
  });

  // Desactivar empresa (bloquear acceso)
  router.patch('/companies/:id/activo', requireAdmin, async (req, res, next) => {
    try {
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: { activo: req.body.activo !== false },
      });
      res.json({ id: company.id, nombre: company.nombre, activo: company.activo });
    } catch (err) {
      next(err);
    }
  });

  return router;
}