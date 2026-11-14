-- =============================================================================
-- RLS: la llave anon no lee el schema cartera
-- Ejecutar en el SQL Editor de Supabase (schema: cartera)
--
-- Idempotente. No crea ni borra políticas: las que ya existan para
-- authenticated se quedan. anon queda sin privilegio, así que una política
-- permisiva no le devuelve filas.
--
-- Postgres no permite ROW LEVEL SECURITY sobre una vista. Las vistas quedan
-- con security_invoker, y el RLS de las tablas de abajo se aplica al usuario
-- que consulta. service_role tiene BYPASSRLS y sigue entrando.
-- =============================================================================

-- 1. Tablas y particiones: RLS encendido y forzado.
--    Vistas: security_invoker para que no corran como el dueño.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'cartera'
      AND c.relkind IN ('r', 'p', 'v')
  LOOP
    IF r.relkind = 'v' THEN
      EXECUTE format(
        'ALTER VIEW cartera.%I SET (security_invoker = on)',
        r.relname
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE cartera.%I ENABLE ROW LEVEL SECURITY',
        r.relname
      );
      EXECUTE format(
        'ALTER TABLE cartera.%I FORCE ROW LEVEL SECURITY',
        r.relname
      );
    END IF;
  END LOOP;
END $$;

-- 2. Quitar privilegios de anon y de PUBLIC.
--    Un GRANT a PUBLIC sigue aplicando a anon aunque se revoque solo a anon.
REVOKE ALL ON ALL TABLES IN SCHEMA cartera FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA cartera FROM anon, PUBLIC;

-- 3. Reafirmar quién sí entra. La app usa service_role.
--    authenticated conserva DML para las políticas que ya existan.
GRANT ALL ON ALL TABLES IN SCHEMA cartera TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA cartera TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cartera TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cartera TO authenticated;

-- 4. La misma regla para tablas y secuencias que se creen después,
--    cuando las cree el rol que ejecuta este script.
ALTER DEFAULT PRIVILEGES IN SCHEMA cartera REVOKE ALL ON TABLES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA cartera REVOKE ALL ON SEQUENCES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA cartera GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cartera GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cartera GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cartera GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- 5. Verificación. Cero filas = aplicado.
--    Una fila politica_anon_o_public no se borra aquí: hay que revisarla a mano.
--    Una política PUBLIC con USING (true) seguiría abierta para quien conserve el GRANT.
SELECT hallazgo, relacion, detalle
FROM (
  SELECT
    'sin_rls'::text AS hallazgo,
    c.relname AS relacion,
    'relrowsecurity = false'::text AS detalle
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'cartera'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity

  UNION ALL

  SELECT
    'sin_force',
    c.relname,
    'relforcerowsecurity = false'
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'cartera'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relforcerowsecurity

  UNION ALL

  SELECT
    'vista_sin_security_invoker',
    c.relname,
    'security_invoker apagado'
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'cartera'
    AND c.relkind = 'v'
    AND NOT (
      COALESCE(c.reloptions, ARRAY[]::text[])
      && ARRAY['security_invoker=true', 'security_invoker=on']
    )

  UNION ALL

  SELECT
    'politica_anon_o_public',
    c.relname,
    p.polname
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'cartera'
    AND (
      cardinality(p.polroles) = 0
      OR EXISTS (
        SELECT 1
        FROM pg_roles rol
        WHERE rol.rolname = 'anon'
          AND rol.oid = ANY (p.polroles)
      )
    )
) hallazgos
ORDER BY hallazgo, relacion, detalle;
