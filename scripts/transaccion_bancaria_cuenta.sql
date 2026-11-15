-- =============================================================================
-- Cuenta y proyecto en cartera.t_transaccion_bancaria
-- Ejecutar en el SQL Editor de Supabase ANTES de desplegar el código que
-- filtra los movimientos por cuenta. La llave (empresa, cuenta_bancaria,
-- numero_transaccion) se repite entre cuentas.
-- =============================================================================

ALTER TABLE cartera.t_transaccion_bancaria
  ADD COLUMN IF NOT EXISTS cuenta varchar,
  ADD COLUMN IF NOT EXISTS proyecto integer;

-- Asigna la cuenta solo cuando todas las cuentas bancarias con ese
-- (empresa, codigo) pertenecen a una sola cuenta. Si el par es único,
-- también copia el proyecto. Un par compartido entre cuentas queda en
-- NULL y la aplicación no lo muestra ni lo modifica.
UPDATE cartera.t_transaccion_bancaria AS movimiento
SET cuenta = unico.cuenta,
    proyecto = CASE WHEN unico.filas = 1 THEN unico.proyecto ELSE movimiento.proyecto END
FROM (
  SELECT empresa, codigo,
         min(cuenta) AS cuenta,
         min(proyecto) AS proyecto,
         count(*) AS filas,
         count(DISTINCT cuenta) AS cuentas
  FROM cartera.t_cuenta_bancaria
  GROUP BY empresa, codigo
) AS unico
WHERE movimiento.cuenta IS NULL
  AND unico.empresa = movimiento.empresa
  AND unico.codigo = movimiento.cuenta_bancaria
  AND unico.cuentas = 1;

CREATE OR REPLACE FUNCTION cartera.fn_transaccion_bancaria_cuenta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = cartera, pg_temp
AS $$
DECLARE
  v_cuenta varchar;
  v_proyecto integer;
  v_filas integer;
  v_cuentas integer;
BEGIN
  IF NEW.cuenta IS NOT NULL AND NEW.proyecto IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*), count(DISTINCT cuenta)
    INTO v_filas, v_cuentas
  FROM cartera.t_cuenta_bancaria
  WHERE empresa = NEW.empresa
    AND codigo = NEW.cuenta_bancaria;

  IF v_cuentas = 1 THEN
    SELECT min(cuenta), min(proyecto)
      INTO v_cuenta, v_proyecto
    FROM cartera.t_cuenta_bancaria
    WHERE empresa = NEW.empresa
      AND codigo = NEW.cuenta_bancaria;
    NEW.cuenta := COALESCE(NEW.cuenta, v_cuenta);
    IF v_filas = 1 THEN
      NEW.proyecto := COALESCE(NEW.proyecto, v_proyecto);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaccion_bancaria_cuenta ON cartera.t_transaccion_bancaria;

CREATE TRIGGER trg_transaccion_bancaria_cuenta
  BEFORE INSERT ON cartera.t_transaccion_bancaria
  FOR EACH ROW
  EXECUTE FUNCTION cartera.fn_transaccion_bancaria_cuenta();

REVOKE ALL ON FUNCTION cartera.fn_transaccion_bancaria_cuenta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cartera.fn_transaccion_bancaria_cuenta() TO service_role;
