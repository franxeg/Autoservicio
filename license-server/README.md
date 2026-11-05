# Autoservicio - License Server

Servidor de licencias para el sistema SaaS de Autoservicio.

## Desarrollo local

```bash
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Deploy (Render / Railway / Fly.io)

1. Crear base de datos PostgreSQL.
2. Configurar variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `CORS_ORIGIN`.
3. Deploy con `npm run build && npm start`.

## Endpoints

### Auth
- `POST /api/auth/register` - `{ nombre, email, password }` → crea empresa + trial 30 días
- `POST /api/auth/login` - `{ email, password }` → JWT + datos de empresa
- `POST /api/auth/admin/login` - `{ username, password }` → JWT admin

### License (requiere auth)
- `GET /api/license/status` → estado de licencia
- `POST /api/license/activate` - `{ code }` → activa premium

### Admin (requiere admin auth)
- `GET /api/admin/companies` → lista de empresas
- `PATCH /api/admin/companies/:id/premium` - `{ isPremium, days }` → activar/desactivar premium
- `PATCH /api/admin/companies/:id/activo` - `{ activo }` → bloquear/desbloquear

## Flujo del cliente
1. El cliente se registra con nombre de empresa + email + contraseña.
2. Recibe 30 días de prueba gratis.
3. El sistema local guarda el `licenseKey` y el token.
4. Al iniciar, consulta `/api/license/status` (con grace period de 7 días offline).
5. Si el trial vence o no paga, las pestañas premium se bloquean.
6. Vos (admin) activás premium desde el panel cuando recibís el pago.