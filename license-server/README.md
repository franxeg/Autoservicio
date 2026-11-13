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
- `GET /api/auth/check-username/:username` → disponibilidad de usuario
- `POST /api/auth/register` - `{ nombre, username, password }` → crea empresa + trial 30 días (devuelve `licenseKey`, `token`, datos de empresa)
- `POST /api/auth/login` - `{ username, password }` → `access_token` + datos de empresa/licencia
- `POST /api/auth/admin/login` - `{ username, password }` → JWT admin (valida `ADMIN_USER`/`ADMIN_PASSWORD` del servidor)

### License (requiere auth de empresa)
- `GET /api/license/status` → estado de licencia (premium/trial, días restantes, vencimientos)
- `POST /api/license/change-password` - `{ passwordActual, passwordNueva }` → cambia contraseña de la empresa
- `POST /api/license/activate` - `{ code }` → activa premium (30 días)

### Admin (requiere auth admin)
- `GET /api/admin/companies` → lista de empresas registradas
- `PATCH /api/admin/companies/:id/premium` - `{ isPremium, days }` → activar/desactivar premium
- `PATCH /api/admin/companies/:id/activo` - `{ activo }` → bloquear/desbloquear
- `PATCH /api/admin/companies/:id/password` - `{ password }` → resetear contraseña de la empresa en el LS

## Flujo del cliente
1. El cliente configura su empresa en el Setup del sistema y se registra con `nombre` + `username` + `password` en el servidor de licencias.
2. Recibe 30 días de prueba gratis (`trialEnd`).
3. El sistema local guarda el `licenseKey` y el token (`license_token`, `license_key`, cache de estado).
4. Periódicamente consulta `GET /api/license/status`. Si no hay conexión, usa el último estado cacheado dentro de un grace period de 7 días; fuera de grace degrada a modo free.
5. Si el trial vence o no paga, las funciones/pestañas premium se bloquean.
6. Vos (admin del LS) activás/desactivás Premium desde el panel de proveedor (sección "Gestión Premium - License Server") al recibir el pago (30 días por activación, renovable).

## Deploy / actualización (Render + Neon)
- Variables de entorno: `DATABASE_URL` (Neon), `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `CORS_ORIGIN` (o `*` según config), `PORT`.
- Build (ejemplo): `npm install && npx prisma generate && npm run build`
- **Start command recomendado:** `npm run start:render` (ejecuta `prisma db push --accept-data-loss` y luego arranca). Si usás `npx prisma db push && npm start`, Prisma puede abortar ante advertencias de esquema (p.ej. agregar `@unique` en `username`) y el servicio no levanta.
- Si preferís migraciones formales: `npx prisma migrate deploy` en deploy y start solo `npm start`. Verificar que la tabla `Company` exista en Neon.
- Tras actualizar, confirmar `GET /health` responde `{ ok: true, service: "autoservicio-license-server" }`. Si Render está en plan free puede tardar en "despertar" (primer request con 503/latencia).