-- =============================================================================
-- Admin explícito en cartera.t_usuario
-- Ejecutar en el SQL Editor de Supabase ANTES de desplegar el código que
-- lee es_admin. Si la columna no existe, las lecturas y los permisos
-- quedan cerrados.
-- =============================================================================

ALTER TABLE cartera.t_usuario
  ADD COLUMN IF NOT EXISTS es_admin smallint NOT NULL DEFAULT 0;

-- Conserva el admin implícito de hoy: cero filas en t_menu_usuario.
-- Quien ya tiene filas de menú sigue restringido a esas filas.
-- Un usuario nuevo queda en 0 y no hereda el catálogo completo.
UPDATE cartera.t_usuario AS usuario
SET es_admin = 1
WHERE usuario.es_admin = 0
  AND NOT EXISTS (
    SELECT 1
    FROM cartera.t_menu_usuario AS menu
    WHERE menu.cuenta = usuario.cuenta
      AND menu.userid = usuario.userid
  );
