-- =============================================================================
-- MIGRACIÓN: Monedas y restricciones de llave foránea
-- Ejecutar en el SQL Editor de Supabase (schema: cartera)
-- =============================================================================

-- 1. Insertar GTQ y USD en t_moneda (incluye campos de auditoría NOT NULL)
DO $$
DECLARE
  v_seed UUID        := '00000000-0000-0000-0000-000000000001';
  v_now  TIMESTAMPTZ := now();
BEGIN
  INSERT INTO cartera.t_moneda (codigo, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha)
  VALUES
    ('GTQ', v_seed, v_now, v_seed, v_now),
    ('USD', v_seed, v_now, v_seed, v_now)
  ON CONFLICT DO NOTHING;
END $$;

-- 2. Sincronizar cualquier otro código de moneda que ya exista en t_lote o t_proyecto
DO $$
DECLARE
  v_seed UUID        := '00000000-0000-0000-0000-000000000001';
  v_now  TIMESTAMPTZ := now();
BEGIN
  INSERT INTO cartera.t_moneda (codigo, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha)
  SELECT DISTINCT moneda, v_seed, v_now, v_seed, v_now
  FROM (
    SELECT moneda FROM cartera.t_lote    WHERE moneda IS NOT NULL
    UNION
    SELECT moneda FROM cartera.t_proyecto WHERE moneda IS NOT NULL
  ) sub
  ON CONFLICT DO NOTHING;
END $$;

-- 3. Asegurar FK en t_lote (crea solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 't_lote_moneda_fkey'
      AND conrelid = 'cartera.t_lote'::regclass
  ) THEN
    ALTER TABLE cartera.t_lote
      ADD CONSTRAINT t_lote_moneda_fkey
      FOREIGN KEY (moneda) REFERENCES cartera.t_moneda(codigo);
  END IF;
END $$;

-- 4. Crear FK en t_proyecto (crea solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 't_proyecto_moneda_fkey'
      AND conrelid = 'cartera.t_proyecto'::regclass
  ) THEN
    ALTER TABLE cartera.t_proyecto
      ADD CONSTRAINT t_proyecto_moneda_fkey
      FOREIGN KEY (moneda) REFERENCES cartera.t_moneda(codigo);
  END IF;
END $$;
