import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TRIAL_DAYS = 30;

export default function authRoutes(prisma: PrismaClient) {
  const router = Router();

  // Registro de nueva empresa
  router.post('/register', async (req, res, next) => {
    try {
      const { nombre, email, password } = req.body;
      if (!nombre || !email || !password) {
        return res.status(400).json({ message: 'nombre, email y password son requeridos' });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      }

      const exists = await prisma.company.findUnique({ where: { email } });
      if (exists) {
        return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
      }

      // Verificar que el nombre de empresa no esté tomado
      const nameExists = await prisma.company.findFirst({ where: { nombre } });
      if (nameExists) {
        return res.status(409).json({ message: 'Ya existe una empresa con ese nombre. Agregá algo para diferenciarla (ej: "Panadería El Sol - Centro").' });
      }

      const hashed = await bcrypt.hash(password, 10);
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      const company = await prisma.company.create({
        data: {
          nombre,
          email,
          password: hashed,
          trialEnd,
        },
      });

      const token = jwt.sign(
        { sub: company.id, email: company.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' },
      );

      res.status(201).json({
        message: 'Empresa registrada. Tenés 30 días de prueba gratis.',
        licenseKey: company.licenseKey,
        token,
        company: {
          id: company.id,
          nombre: company.nombre,
          email: company.email,
          isPremium: false,
          isTrial: true,
          trialDaysLeft: TRIAL_DAYS,
          trialEnd: company.trialEnd,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Login
  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'email y password son requeridos' });
      }

      const company = await prisma.company.findUnique({ where: { email } });
      if (!company || !company.activo) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const valid = await bcrypt.compare(password, company.password);
      if (!valid) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        { sub: company.id, email: company.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' },
      );

      res.json({
        access_token: token,
        company: {
          id: company.id,
          nombre: company.nombre,
          email: company.email,
          licenseKey: company.licenseKey,
          isPremium: company.isPremium,
          isTrial: !company.isPremium && new Date() < company.trialEnd,
          trialDaysLeft: company.isPremium ? 0 : Math.max(0, Math.ceil((company.trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
          trialEnd: company.trialEnd,
          premiumExpiry: company.premiumExpiry,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Admin login (para el panel de administración)
  router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';
    if (username !== adminUser || password !== adminPass) {
      return res.status(401).json({ message: 'Credenciales de admin inválidas' });
    }
    const token = jwt.sign({ sub: 'admin', isAdmin: true }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ access_token: token });
  });

  return router;
}