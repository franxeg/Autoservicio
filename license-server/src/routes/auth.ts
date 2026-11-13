import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TRIAL_DAYS = 30;

export default function authRoutes(prisma: PrismaClient) {
  const router = Router();

  // Verificar si un username está disponible
  router.get('/check-username/:username', async (req, res, next) => {
    try {
      const { username } = req.params;
      if (!username || username.length < 3) {
        return res.status(400).json({ available: false, message: 'El usuario debe tener al menos 3 caracteres' });
      }
      const exists = await prisma.company.findUnique({ where: { username } });
      res.json({ available: !exists, message: exists ? 'El usuario ya está en uso' : 'Usuario disponible' });
    } catch (err) {
      next(err);
    }
  });

  // Registro de nueva empresa
  router.post('/register', async (req, res, next) => {
    try {
      const { nombre, username, password, cuit, direccion, telefono } = req.body;
      if (!nombre || !username || !password) {
        return res.status(400).json({ message: 'nombre, username y password son requeridos' });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: 'El usuario debe tener al menos 3 caracteres' });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      }

      // Verificar username disponible
      const existsUser = await prisma.company.findUnique({ where: { username } });
      if (existsUser) {
        return res.status(409).json({ message: 'El usuario ya está en uso. Elegí otro.' });
      }

      // El nombre de empresa es local y no se valida por duplicado.

      const hashed = await bcrypt.hash(password, 10);
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      const company = await prisma.company.create({
        data: {
          nombre,
          username,
          password: hashed,
          trialEnd,
        },
      });

      const token = jwt.sign(
        { sub: company.id, username: company.username },
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
          username: company.username,
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
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'username y password son requeridos' });
      }

      const company = await prisma.company.findUnique({ where: { username } });
      if (!company || !company.activo) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const valid = await bcrypt.compare(password, company.password);
      if (!valid) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        { sub: company.id, username: company.username },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' },
      );

      const now = new Date();
      const isTrial = !company.isPremium && now < company.trialEnd;
      const trialDaysLeft = isTrial ? Math.max(0, Math.ceil((company.trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
      const isPremium = company.isPremium && (!company.premiumExpiry || now < company.premiumExpiry);

      res.json({
        access_token: token,
        company: {
          id: company.id,
          nombre: company.nombre,
          username: company.username,
          licenseKey: company.licenseKey,
          isPremium: isPremium || isTrial,
          isTrial,
          trialDaysLeft,
          trialEnd: company.trialEnd,
          premiumExpiry: company.premiumExpiry,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Recuperar contraseña con código generado por el proveedor.
  // Valida el código de 4 dígitos, cambia la contraseña en el license-server
  // (para mantenerla sincronizada) y consume el código.
  router.post('/reset-password', async (req, res, next) => {
    try {
      const { username, code, newPassword } = req.body;
      if (!username || !code || !newPassword) {
        return res.status(400).json({ message: 'Usuario, código y nueva contraseña son requeridos' });
      }
      if (String(newPassword).length < 4) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres' });
      }

      const company = await prisma.company.findUnique({ where: { username } });
      if (!company) {
        return res.status(400).json({ message: 'Código inválido o expirado' });
      }
      const codigoValido =
        !!company.resetCode &&
        company.resetCode === String(code).trim() &&
        !!company.resetCodeExpiry &&
        company.resetCodeExpiry.getTime() > Date.now();
      if (!codigoValido) {
        return res.status(400).json({ message: 'Código inválido o expirado' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.company.update({
        where: { id: company.id },
        data: { password: hashed, resetCode: null, resetCodeExpiry: null },
      });

      res.json({ ok: true, message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      next(err);
    }
  });

  // Admin login
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