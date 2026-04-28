-- =============================================================
-- Función transaccional: cartera.fn_crear_reserva
-- Ejecuta las 4 operaciones en una sola transacción implícita:
--   1. Verifica y bloquea el lote    (concurrencia optimista con modifico_fecha)
--   2. INSERT t_reserva              (numero generado por trigger)
--   3. INSERT t_recibo_caja          (numero: trigger si recibo_automatico=1, manual si =0)
--   4. INSERT t_detalle_recibo_caja
--   5. INSERT t_transaccion_bancaria (si forma pago es 3,4)
--   6. UPDATE t_reserva              (actualiza campo recibo_numero con el numero real)
--   7. UPDATE t_lote                 (marca como reservado)
-- Retorna: jsonb { ok: bool, numero?: bigint, recibo?: bigint, error?: text }
-- =============================================================
create or replace function cartera.fn_crear_reserva (
  p_cuenta varchar,
  p_empresa integer,
  p_proyecto integer,
  p_fase integer,
  p_manzana varchar,
  p_lote varchar,
  p_cliente bigint,
  p_vendedor integer,
  p_cobrador integer,
  p_serie varchar,
  p_recibo_automatico smallint, -- 1 = trigger genera numero; 0 = p_recibo_manual
  p_recibo_manual bigint, -- usado solo cuando p_recibo_automatico = 0
  p_fecha date,
  p_monto numeric,
  p_forma_pago smallint,
  p_banco integer,
  p_numero_cuenta varchar,
  p_numero_documento varchar,
  p_cuenta_deposito integer, -- codigo de cuenta bancaria (depósito/transferencia)
  p_moneda varchar,
  p_agrego_usuario uuid,
  p_lote_modifico_fecha timestamp, -- token de concurrencia optimista
  p_cliente_nombre varchar,        -- nombre del cliente para t_transaccion_bancaria
  p_fase_nombre varchar            -- nombre de la fase para t_transaccion_bancaria
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER as $$
DECLARE
  v_reserva_numero      bigint;
  v_recibo_numero       bigint;
  v_tipo_transaccion    smallint;
  v_transaccion_numero  varchar(11);
  v_lote_row            cartera.t_lote%ROWTYPE;
BEGIN

  -- ── 1. Bloquear fila del lote y verificar disponibilidad ─────────────────
  SELECT * INTO v_lote_row
  FROM cartera.t_lote
  WHERE cuenta = p_cuenta AND empresa  = p_empresa AND proyecto = p_proyecto AND fase = p_fase AND manzana = p_manzana AND codigo = p_lote
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lote no encontrado.');
  END IF;

  IF v_lote_row.recibo_numero <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'El lote ya fue reservado. Recarga los datos e intenta de nuevo.');
  END IF;

  IF v_lote_row.promesa <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'El lote ya fue vendido. Recarga los datos e intenta de nuevo.');
  END IF;

  IF v_lote_row.modifico_fecha <> p_lote_modifico_fecha THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'El lote fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.');
  END IF;

  -- ── 2. INSERT t_reserva (numero lo genera el trigger) ────────────────────
  -- recibo_numero=0 temporalmente; se actualiza en paso 5 con el numero real del recibo.
  INSERT INTO cartera.t_reserva (cuenta, empresa, proyecto, fase, manzana, lote, cliente, vendedor, recibo_serie, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha) 
  VALUES (p_cuenta, p_empresa, p_proyecto, p_fase, p_manzana, p_lote, p_cliente, p_vendedor, p_serie, 1, p_agrego_usuario, now(), p_agrego_usuario, now())
  RETURNING numero INTO v_reserva_numero;

  -- ── 3. INSERT t_recibo_caja ───────────────────────────────────────────────
  IF p_recibo_automatico = 1 THEN
    -- No se especifica numero: el trigger asigna el siguiente correlativo.
    INSERT INTO cartera.t_recibo_caja (cuenta, empresa, proyecto, serie, fecha, cliente, fase, manzana, lote, forma_pago, banco, numero_cuenta, numero_documento,
    cuenta_deposito, cobrador, moneda, tasa_cambio, monto, reserva, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha)
    VALUES (p_cuenta, p_empresa, p_proyecto, p_serie, p_fecha, p_cliente, p_fase, p_manzana, p_lote, p_forma_pago, p_banco, p_numero_cuenta, p_numero_documento, p_cuenta_deposito, p_cobrador, p_moneda, 1, p_monto, v_reserva_numero, 1, p_agrego_usuario, now(), p_agrego_usuario, now())
    RETURNING numero INTO v_recibo_numero;
  ELSE
    -- El usuario proporcionó el numero de recibo.
    v_recibo_numero := p_recibo_manual;

    INSERT INTO cartera.t_recibo_caja (cuenta, empresa, proyecto, serie, numero, fecha, cliente, fase, manzana, lote, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, cobrador, moneda, tasa_cambio, monto, reserva, estado, agrego_usuario,  agrego_fecha, modifico_usuario, modifico_fecha) 
    VALUES (p_cuenta, p_empresa, p_proyecto, p_serie, p_recibo_manual, p_fecha, p_cliente, p_fase, p_manzana, p_lote, p_forma_pago, p_banco, p_numero_cuenta, p_numero_documento, p_cuenta_deposito, p_cobrador, p_moneda, v_reserva_numero, 1, p_monto, 1, p_agrego_usuario, now(), p_agrego_usuario, now());
  END IF;

  -- ── 4. INSERT t_detalle_recibo_caja ──────────────────────────────────────
  -- tipo_cuota=1, cuota=0, monto completo como capital.
  INSERT INTO cartera.t_detalle_recibo_caja (cuenta, empresa, proyecto, serie_recibo, recibo, fecha_cuota, tipo_cuota, capital) 
  VALUES (p_cuenta, p_empresa, p_proyecto, p_serie, v_recibo_numero, p_fecha, 1, p_monto);

  -- ── 5. Si forma de pago es depósito (3) o transferencia (4), registrar en t_transaccion_bancaria ─
  IF p_forma_pago IN (3, 4) THEN
    -- Determina tipo transaccion.
    IF p_forma_pago = 3 THEN -- forma pago deposito
      v_tipo_transaccion := 2; -- tipo transaccion deposito
    ELSE
      v_tipo_transaccion := 5; -- tipo transaccion transferencia
    END IF;

    INSERT INTO cartera.t_transaccion_bancaria (
      cuenta, empresa, proyecto, cuenta_bancaria, tipo_transaccion, fecha, numero_documento, valor, tipo_saldo, a_nombre_de, comentario,
      estado, usuario_agrego, fecha_agrego, usuario_modifico, fecha_modifico) 
      VALUES (p_cuenta, p_empresa, p_proyecto, p_cuenta_deposito, v_tipo_transaccion, p_fecha, p_numero_documento, p_monto, 2, p_cliente_nombre,
      'RESERVA LOTE ' || p_lote || ', MANZANA ' || p_manzana || ', FASE ' || p_fase_nombre, 1, p_agrego_usuario, now(), p_agrego_usuario, now())
    RETURNING numero_transaccion INTO v_transaccion_numero;

    UPDATE cartera.t_recibo_caja
    SET transaccion_bancaria = v_transaccion_numero
    WHERE cuenta = p_cuenta AND empresa = p_empresa AND proyecto = p_proyecto AND serie = p_serie AND numero = v_recibo_numero;

  END IF;

  -- ── 6. UPDATE t_reserva: completar con el numero real del recibo ──────────
  UPDATE cartera.t_reserva 
  SET recibo_numero = v_recibo_numero
  WHERE cuenta = p_cuenta AND empresa = p_empresa AND proyecto = p_proyecto AND numero = v_reserva_numero;

  -- ── 7. UPDATE t_lote: marcar como reservado ───────────────────────────────
  UPDATE cartera.t_lote 
  SET recibo_serie = p_serie, recibo_numero = v_recibo_numero, modifico_usuario = p_agrego_usuario, modifico_fecha = now()::timestamp
  WHERE cuenta = p_cuenta AND empresa = p_empresa AND proyecto = p_proyecto AND fase = p_fase AND manzana = p_manzana AND codigo = p_lote;
  
  -- ── Devuelve todo OK ───────────────────────────────
  RETURN jsonb_build_object('ok', true, 'numero', v_reserva_numero, 'recibo', v_recibo_numero);

EXCEPTION WHEN OTHERS THEN
  -- ── Devuelve NOK ───────────────────────────────
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);

END;
$$;

-- Permitir ejecución desde el rol authenticado (usado por service role vía PostgREST)
grant
execute on FUNCTION cartera.fn_crear_reserva (
  varchar,
  integer,
  integer,
  integer,
  varchar,
  varchar,
  bigint,
  integer,
  integer,
  varchar,
  smallint,
  bigint,
  date,
  numeric,
  smallint,
  integer,
  varchar,
  varchar,
  integer,
  varchar,
  uuid,
  timestamp,
  varchar,
  varchar
) to authenticated;