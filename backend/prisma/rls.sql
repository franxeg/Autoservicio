-- Row Level Security multi-tenant — bootstrap (ejecutar con el usuario con
-- privilegios de administración, p.ej. `prisma db execute --url $MIGRATE_DATABASE_URL --file prisma/rls.sql`).
--
-- Motivo de este archivo: la imagen oficial de postgres crea al POSTGRES_USER como
-- SUPERUSER (bootstrap) y PostgreSQL prohíbe demotarlo; además los superusuarios
-- SIEMPRE omiten RLS. Por eso la aplicación se conecta con un rol dedicado
-- (autoservicio_app) sin privilegios de superusuario: a ese rol RLS sí le aplica.
--
-- Semántica RLS: cada fila es visible/escribible solo si el tenant de la sesión
-- coincide ("app.empresa_id"), salvo operación de sistema ("app.bypass_rls" = 'true').
-- Un solo DO es OBLIGATORIO: Prisma ejecuta raw SQL como prepared statement y no
-- admite múltiples comandos.

DO $$
DECLARE
  app_role text := 'autoservicio_app';
  app_pass text := 'autoservicioapp123';
  t text;
  tables text[] := ARRAY[
    'Sucursal','Usuario','Categoria','Producto','Stock','Proveedor',
    'Cliente','Venta','DetalleVenta','Compra','DetalleCompra','Caja','MovimientoCaja'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', app_role, app_pass);
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE autoservicio IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE autoservicio IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', app_role);

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_policy ON %I USING (' ||
      'current_setting(''app.bypass_rls'', true) = ''true'' OR "empresaId" = current_setting(''app.empresa_id'', true)' ||
      ') WITH CHECK (' ||
      'current_setting(''app.bypass_rls'', true) = ''true'' OR "empresaId" = current_setting(''app.empresa_id'', true)' ||
      ')',
      t
    );
  END LOOP;
END $$;