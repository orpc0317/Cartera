-- =============================================================================
-- Seed: Catálogo de Monedas
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================

DO $$
DECLARE
  v_seed UUID        := '00000000-0000-0000-0000-000000000001';
  v_now  TIMESTAMPTZ := now();
BEGIN

INSERT INTO cartera.t_moneda (codigo, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha)
VALUES
  ('ARS', v_seed, v_now, v_seed, v_now),
  ('BOB', v_seed, v_now, v_seed, v_now),
  ('BRL', v_seed, v_now, v_seed, v_now),
  ('CAD', v_seed, v_now, v_seed, v_now),
  ('CLP', v_seed, v_now, v_seed, v_now),
  ('COP', v_seed, v_now, v_seed, v_now),
  ('CRC', v_seed, v_now, v_seed, v_now),
  ('CUP', v_seed, v_now, v_seed, v_now),
  ('DOP', v_seed, v_now, v_seed, v_now),
  ('EUR', v_seed, v_now, v_seed, v_now),
  ('GBP', v_seed, v_now, v_seed, v_now),
  ('GTQ', v_seed, v_now, v_seed, v_now),
  ('HNL', v_seed, v_now, v_seed, v_now),
  ('MXN', v_seed, v_now, v_seed, v_now),
  ('NIO', v_seed, v_now, v_seed, v_now),
  ('PAB', v_seed, v_now, v_seed, v_now),
  ('PEN', v_seed, v_now, v_seed, v_now),
  ('PYG', v_seed, v_now, v_seed, v_now),
  ('SVC', v_seed, v_now, v_seed, v_now),
  ('USD', v_seed, v_now, v_seed, v_now),
  ('UYU', v_seed, v_now, v_seed, v_now),
  ('VES', v_seed, v_now, v_seed, v_now)
ON CONFLICT DO NOTHING;

END $$;
