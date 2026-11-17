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
          archivada: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Orden pedido por el proveedor: premium vigente, luego trial vigente y
      // por último las que están en free. Dentro de cada grupo, la más nueva
      // primero.
      const now = new Date();
      const rango = (c: (typeof companies)[number]) => {
        const premium = c.isPremium && (!c.premiumExpiry || new Date(c.premiumExpiry) > now);
        if (premium) return 0;
        if (new Date(c.trialEnd) > now) return 1;
        return 2;
      };
      companies.sort(
        (a, b) => rango(a) - rango(b) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      res.json(companies);
    } catch (err) {
      next(err);
    }
  });

  // Activar/desactivar premium. La duración puede indicarse en días o
  // solicitarse sin vencimiento (premiumExpiry = null).
  router.patch('/companies/:id/premium', requireAdmin, async (req, res, next) => {
    try {
      const { isPremium, days, sinVencimiento } = req.body;
      const data: any = { isPremium: !!isPremium };
      if (isPremium && sinVencimiento === true) {
        data.premiumExpiry = null;
      } else if (isPremium) {
        const dias = Number(days);
        const duracion = Number.isFinite(dias) && dias > 0 ? dias : 30;
        data.premiumExpiry = new Date(Date.now() + duracion * 24 * 60 * 60 * 1000);
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

  // Finalizar o reiniciar el período de prueba. Sirve para probar el plan
  // Free sin esperar a que venza el trial. No toca el premium pago.
  router.patch('/companies/:id/trial', requireAdmin, async (req, res, next) => {
    try {
      const activo = req.body?.activo !== false;
      const trialEnd = activo
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 60 * 1000);
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: { trialEnd },
      });
      res.json({
        id: company.id,
        nombre: company.nombre,
        isPremium: company.isPremium,
        premiumExpiry: company.premiumExpiry,
        trialEnd: company.trialEnd,
      });
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

  // Archivar/desarchivar empresa (solo la oculta del listado del proveedor)
  router.patch('/companies/:id/archivar', requireAdmin, async (req, res, next) => {
    try {
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: { archivada: req.body.archivada !== false },
      });
      res.json({ id: company.id, nombre: company.nombre, archivada: company.archivada });
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

  // Eliminar empresa definitivamente (libera el usuario para volver a registrarse)
  router.delete('/companies/:id', requireAdmin, async (req, res, next) => {
    try {
      const company = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!company) return res.status(404).json({ message: 'Empresa no encontrada' });
      await prisma.company.delete({ where: { id: req.params.id } });
      res.json({ id: company.id, nombre: company.nombre, message: 'Empresa eliminada' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}