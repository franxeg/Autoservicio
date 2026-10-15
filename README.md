# Autoservicio - Sistema de Gestión

Stack: **NestJS + React + PostgreSQL + Prisma + Docker**

## Estructura
```
/backend   -> API NestJS (Puerto 3000)
/frontend  -> Web React + Vite (Puerto 5173)
/docker-compose.yml -> Orquestación completa
```

## Módulos Planificados
- [ ] Auth + Roles (ADMIN, CAJERO)
- [ ] Categorías / Productos / Stock
- [ ] Proveedores / Compras
- [ ] Clientes / Cuenta Corriente
- [ ] Ventas (POS con lector código de barras)
- [ ] Caja (Apertura/Cierre, Movimientos)
- [ ] Empleados
- [ ] Reportes

## Inicio Rápido

### Con Docker (recomendado)
```bash
cp backend/.env.example backend/.env
docker compose up --build
```

### Sin Docker (desarrollo local)
```bash
# Terminal 1 - Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

- API: http://localhost:3000/api
- Docs Swagger: http://localhost:3000/api/docs
- Web: http://localhost:5173

## Lector Código de Barras
Los lectores USB HID funcionan como teclado. El POS captura el `onKeyDown` + `Enter`.
Para cámara: usar `html5-qrcode` (ya previsto en frontend).
