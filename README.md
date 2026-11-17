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

## Descarga e instalación (versión 1.0.1)

- Página del producto: https://franxeg.github.io/Web-design/autoservicio.html
- Instalador directo: https://github.com/franxeg/Autoservicio/releases/latest/download/Autoservicio-1.0.1-Setup.exe
- Todas las versiones: https://github.com/franxeg/Autoservicio/releases

El instalador incluye PostgreSQL y el backend, no necesita Docker ni internet
para funcionar día a día. Sí se necesita conexión al registrar la empresa por
primera vez y para consultar el estado de la licencia.

### Primer inicio

1. Ejecutar `iniciar.bat` y esperar a que se abra http://localhost:3000.
2. Ingresar a http://localhost:3000/registro y crear la cuenta (30 días de prueba).
3. Si la licencia ya existe, usar la pestaña "Iniciar sesión".

## Consola del proveedor (solo administrador)

La administración de licencias **no está incluida en el instalador de clientes**.
Se sirve desde el license-server en:

- https://autoservicio-license-server.onrender.com/admin

Desde esa consola se pueden activar/renovar Premium (30 días, 1 año o sin
vencimiento), finalizar o reiniciar el trial, activar/desactivar empresas,
archivarlas, generar códigos de recuperación y cambiar contraseñas.

Para habilitar el acceso, configurar estas variables de entorno en el
license-server (Render) antes de iniciar sesión:

```
ADMIN_USER=<usuario elegido>
ADMIN_PASSWORD=<contraseña larga y única>
```

No hay credenciales por defecto. Si no están configuradas, el login responde
`503` y la consola indica cómo configurarlas. La sesión del panel se guarda solo
en memoria del navegador: se cierra al recargar la página.

Para desarrollo local:

```bash
cd license-server
npm install
npx prisma generate
npm run dev
```

La consola queda en http://localhost:4000/admin.
