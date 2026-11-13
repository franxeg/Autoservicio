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
          username: true,
          email: true,
          licenseKey: true,
          isPremium: true,
          premiumExpiry: true,
          resetCode: true,
          resetCodeExpiry: true,
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

  // Generar código de recuperación de contraseña (4 dígitos, válido 30 minutos)
  router.post('/companies/:id/reset-code', requireAdmin, async (req, res, next) => {
    try {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const resetCodeExpiry = new Date(Date.now() + 30 * 60 * 1000);
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: { resetCode: code, resetCodeExpiry },
      });
      res.json({
        id: company.id,
        nombre: company.nombre,
        username: company.username,
        resetCode: company.resetCode,
        resetCodeExpiry: company.resetCodeExpiry,
      });
    } catch (err) {
      next(err);
    }
  });

  // Resetear contraseña (admin)
  router.patch('/companies/:id/password', requireAdmin, async (req, res, next) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      }
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash(password, 10);
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: { password: hashed },
      });
      res.json({ id: company.id, nombre: company.nombre, message: 'Contraseña actualizada' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}