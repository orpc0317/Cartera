-- =============================================================================
-- Vistas de lista (una lectura por grilla)
-- Ejecutar en el SQL Editor de Supabase (schema: cartera).
--
-- Cada vista nombra todas las columnas. No usa SELECT *.
-- INNER JOIN solo a empresa y proyecto (parte de la llave).
-- LEFT JOIN al resto: un código 0 o un dato geográfico vacío no esconde la fila.
-- security_invoker conserva la RLS de las tablas base.
-- =============================================================================

-- ── Empresas ────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_empresa_lista;
CREATE VIEW cartera.v_empresa_lista
WITH (security_invoker = true) AS
SELECT
  e.cuenta,
  e.codigo,
  e.nombre,
  e.razon_social,
  e.identificacion_tributaria,
  e.direccion_pais,
  e.direccion_departamento,
  e.direccion_municipio,
  e.direccion,
  e.codigo_postal,
  e.regimen_isr,
  e.agrego_usuario,
  e.agrego_fecha,
  e.modifico_usuario,
  e.modifico_fecha,
  pais.nombre AS pais_nombre,
  depto.nombre AS departamento_nombre,
  muni.nombre AS municipio_nombre
FROM cartera.t_empresa e
LEFT JOIN cartera.t_pais pais
  ON pais.codigo = e.direccion_pais
LEFT JOIN cartera.t_departamento depto
  ON depto.pais = e.direccion_pais
 AND depto.codigo = e.direccion_departamento
LEFT JOIN cartera.t_municipio muni
  ON muni.pais = e.direccion_pais
 AND muni.departamento = e.direccion_departamento
 AND muni.codigo = e.direccion_municipio;

-- ── Proyectos ───────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_proyecto_lista;
CREATE VIEW cartera.v_proyecto_lista
WITH (security_invoker = true) AS
SELECT
  pr.cuenta,
  pr.empresa,
  pr.codigo,
  pr.nombre,
  pm.moneda,
  pr.direccion_pais,
  pr.direccion_departamento,
  pr.direccion_municipio,
  pr.direccion,
  pr.codigo_postal,
  pr.telefono1,
  pr.telefono2,
  pr.mora_automatica,
  pr.fijar_parametros_mora,
  pr.forma_mora,
  pr.interes_mora,
  pr.fijo_mora,
  pr.mora_enganche,
  pr.dias_gracia,
  pr.dias_afectos,
  pr.inicio_calculo_mora,
  pr.calcular_mora_antes,
  pr.minimo_mora,
  pr.minimo_abono_capital,
  pr.inicio_abono_capital_estricto,
  pr.promesa_vencida,
  pr.promesa_correlativo,
  pr.visibilidad_ventas,
  pr.visibilidad_cobros,
  pr.logo_url,
  pr.agrego_usuario,
  pr.agrego_fecha,
  pr.modifico_usuario,
  pr.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pais.nombre AS pais_nombre,
  depto.nombre AS departamento_nombre,
  muni.nombre AS municipio_nombre
FROM cartera.t_proyecto pr
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = pr.cuenta
 AND emp.codigo = pr.empresa
INNER JOIN cartera.t_proyecto_moneda pm
  ON pm.cuenta = pr.cuenta
 AND pm.empresa = pr.empresa
 AND pm.proyecto = pr.codigo
 AND pm.predeterminado = 1
LEFT JOIN cartera.t_pais pais
  ON pais.codigo = pr.direccion_pais
LEFT JOIN cartera.t_departamento depto
  ON depto.pais = pr.direccion_pais
 AND depto.codigo = pr.direccion_departamento
LEFT JOIN cartera.t_municipio muni
  ON muni.pais = pr.direccion_pais
 AND muni.departamento = pr.direccion_departamento
 AND muni.codigo = pr.direccion_municipio;

-- ── Fases ───────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_fase_lista;
CREATE VIEW cartera.v_fase_lista
WITH (security_invoker = true) AS
SELECT
  f.cuenta,
  f.empresa,
  f.proyecto,
  f.codigo,
  f.nombre,
  f.medida,
  f.agrego_usuario,
  f.agrego_fecha,
  f.modifico_usuario,
  f.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_fase f
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = f.cuenta AND emp.codigo = f.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = f.cuenta AND pry.empresa = f.empresa AND pry.codigo = f.proyecto;

-- ── Manzanas ────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_manzana_lista;
CREATE VIEW cartera.v_manzana_lista
WITH (security_invoker = true) AS
SELECT
  m.cuenta,
  m.empresa,
  m.proyecto,
  m.fase,
  m.codigo,
  m.agrego_usuario,
  m.agrego_fecha,
  m.modifico_usuario,
  m.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  fas.nombre AS fase_nombre
FROM cartera.t_manzana m
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = m.cuenta AND emp.codigo = m.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = m.cuenta AND pry.empresa = m.empresa AND pry.codigo = m.proyecto
LEFT JOIN cartera.t_fase fas
  ON fas.cuenta = m.cuenta AND fas.empresa = m.empresa AND fas.proyecto = m.proyecto AND fas.codigo = m.fase;

-- ── Lotes ───────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_lote_lista;
CREATE VIEW cartera.v_lote_lista
WITH (security_invoker = true) AS
SELECT
  l.cuenta,
  l.empresa,
  l.proyecto,
  l.fase,
  l.manzana,
  l.codigo,
  l.moneda,
  l.valor,
  l.extension,
  l.finca,
  l.folio,
  l.libro,
  l.norte,
  l.sur,
  l.este,
  l.oeste,
  l.otro,
  l.promesa,
  l.recibo_serie,
  l.recibo_numero,
  l.agrego_usuario,
  l.agrego_fecha,
  l.modifico_usuario,
  l.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  fas.nombre AS fase_nombre
FROM cartera.t_lote l
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = l.cuenta AND emp.codigo = l.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = l.cuenta AND pry.empresa = l.empresa AND pry.codigo = l.proyecto
LEFT JOIN cartera.t_fase fas
  ON fas.cuenta = l.cuenta AND fas.empresa = l.empresa AND fas.proyecto = l.proyecto AND fas.codigo = l.fase;

-- ── Clientes ────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_cliente_lista;
CREATE VIEW cartera.v_cliente_lista
WITH (security_invoker = true) AS
SELECT
  c.cuenta,
  c.empresa,
  c.proyecto,
  c.codigo,
  c.nombre,
  c.direccion,
  c.direccion_pais,
  c.direccion_departamento,
  c.direccion_municipio,
  c.codigo_postal,
  c.telefono1,
  c.telefono2,
  c.correo,
  c.nombre_factura,
  c.identificacion_tributaria,
  c.tipo_identificacion,
  c.regimen_iva,
  c.agrego_usuario,
  c.agrego_fecha,
  c.modifico_usuario,
  c.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  pais.nombre AS pais_nombre,
  depto.nombre AS departamento_nombre,
  muni.nombre AS municipio_nombre
FROM cartera.t_cliente c
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = c.cuenta AND emp.codigo = c.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = c.cuenta AND pry.empresa = c.empresa AND pry.codigo = c.proyecto
LEFT JOIN cartera.t_pais pais
  ON pais.codigo = c.direccion_pais
LEFT JOIN cartera.t_departamento depto
  ON depto.pais = c.direccion_pais AND depto.codigo = c.direccion_departamento
LEFT JOIN cartera.t_municipio muni
  ON muni.pais = c.direccion_pais
 AND muni.departamento = c.direccion_departamento
 AND muni.codigo = c.direccion_municipio;

-- ── Supervisores ────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_supervisor_lista;
CREATE VIEW cartera.v_supervisor_lista
WITH (security_invoker = true) AS
SELECT
  s.cuenta,
  s.empresa,
  s.proyecto,
  s.codigo,
  s.nombre,
  s.userid,
  s.activo,
  s.agrego_usuario,
  s.agrego_fecha,
  s.modifico_usuario,
  s.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_supervisor s
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = s.cuenta AND emp.codigo = s.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = s.cuenta AND pry.empresa = s.empresa AND pry.codigo = s.proyecto;

-- ── Cobradores ──────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_cobrador_lista;
CREATE VIEW cartera.v_cobrador_lista
WITH (security_invoker = true) AS
SELECT
  c.cuenta,
  c.empresa,
  c.proyecto,
  c.codigo,
  c.nombre,
  c.userid,
  c.activo,
  c.agrego_usuario,
  c.agrego_fecha,
  c.modifico_usuario,
  c.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_cobrador c
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = c.cuenta AND emp.codigo = c.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = c.cuenta AND pry.empresa = c.empresa AND pry.codigo = c.proyecto;

-- ── Coordinadores ───────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_coordinador_lista;
CREATE VIEW cartera.v_coordinador_lista
WITH (security_invoker = true) AS
SELECT
  c.cuenta,
  c.empresa,
  c.proyecto,
  c.codigo,
  c.nombre,
  c.supervisor,
  c.userid,
  c.activo,
  c.agrego_usuario,
  c.agrego_fecha,
  c.modifico_usuario,
  c.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  sup.nombre AS supervisor_nombre
FROM cartera.t_coordinador c
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = c.cuenta AND emp.codigo = c.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = c.cuenta AND pry.empresa = c.empresa AND pry.codigo = c.proyecto
LEFT JOIN cartera.t_supervisor sup
  ON c.supervisor > 0
 AND sup.cuenta = c.cuenta
 AND sup.empresa = c.empresa
 AND sup.proyecto = c.proyecto
 AND sup.codigo = c.supervisor;

-- ── Vendedores ──────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_vendedor_lista;
CREATE VIEW cartera.v_vendedor_lista
WITH (security_invoker = true) AS
SELECT
  v.cuenta,
  v.empresa,
  v.proyecto,
  v.codigo,
  v.nombre,
  v.userid,
  v.activo,
  v.coordinador,
  v.agrego_usuario,
  v.agrego_fecha,
  v.modifico_usuario,
  v.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  coo.nombre AS coordinador_nombre
FROM cartera.t_vendedor v
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = v.cuenta AND emp.codigo = v.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = v.cuenta AND pry.empresa = v.empresa AND pry.codigo = v.proyecto
LEFT JOIN cartera.t_coordinador coo
  ON v.coordinador > 0
 AND coo.cuenta = v.cuenta
 AND coo.empresa = v.empresa
 AND coo.proyecto = v.proyecto
 AND coo.codigo = v.coordinador;

-- ── Bancos ──────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_banco_lista;
CREATE VIEW cartera.v_banco_lista
WITH (security_invoker = true) AS
SELECT
  b.cuenta,
  b.empresa,
  b.proyecto,
  b.codigo,
  b.nombre,
  b.agrego_usuario,
  b.agrego_fecha,
  b.modifico_usuario,
  b.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_banco b
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = b.cuenta AND emp.codigo = b.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = b.cuenta AND pry.empresa = b.empresa AND pry.codigo = b.proyecto;

-- ── Cuentas bancarias ───────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_cuenta_bancaria_lista;
CREATE VIEW cartera.v_cuenta_bancaria_lista
WITH (security_invoker = true) AS
SELECT
  cb.cuenta,
  cb.empresa,
  cb.proyecto,
  cb.codigo,
  cb.numero,
  cb.nombre,
  cb.banco,
  cb.moneda,
  cb.activo,
  cb.agrego_usuario,
  cb.agrego_fecha,
  cb.modifico_usuario,
  cb.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  ban.nombre AS banco_nombre
FROM cartera.t_cuenta_bancaria cb
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = cb.cuenta AND emp.codigo = cb.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = cb.cuenta AND pry.empresa = cb.empresa AND pry.codigo = cb.proyecto
LEFT JOIN cartera.t_banco ban
  ON cb.banco > 0
 AND ban.cuenta = cb.cuenta
 AND ban.empresa = cb.empresa
 AND ban.proyecto = cb.proyecto
 AND ban.codigo = cb.banco;

-- ── Series de recibos ───────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_serie_recibo_lista;
CREATE VIEW cartera.v_serie_recibo_lista
WITH (security_invoker = true) AS
SELECT
  s.cuenta,
  s.empresa,
  s.proyecto,
  s.serie,
  s.serie_factura,
  s.dias_fecha,
  s.correlativo,
  s.formato,
  s.predeterminado,
  s.recibo_automatico,
  s.activo,
  s.agrego_usuario,
  s.agrego_fecha,
  s.modifico_usuario,
  s.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_serie_recibo s
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = s.cuenta AND emp.codigo = s.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = s.cuenta AND pry.empresa = s.empresa AND pry.codigo = s.proyecto;

-- ── Series de facturas ──────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_serie_factura_lista;
CREATE VIEW cartera.v_serie_factura_lista
WITH (security_invoker = true) AS
SELECT
  s.cuenta,
  s.empresa,
  s.proyecto,
  s.serie,
  s.gface,
  s.id_docto_gface,
  s.establecimiento,
  s.dispositivo,
  s.carpeta_dtes,
  s.formato,
  s.predeterminado,
  s.activo,
  s.agrego_usuario,
  s.agrego_fecha,
  s.modifico_usuario,
  s.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  gf.nombre AS gface_nombre
FROM cartera.t_serie_factura s
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = s.cuenta AND emp.codigo = s.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = s.cuenta AND pry.empresa = s.empresa AND pry.codigo = s.proyecto
LEFT JOIN cartera.t_gface gf
  ON s.gface > 0
 AND gf.cuenta = s.cuenta
 AND gf.empresa = s.empresa
 AND gf.proyecto = s.proyecto
 AND gf.codigo = s.gface;

-- ── Tipos de ingreso ────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_tipo_ingreso_lista;
CREATE VIEW cartera.v_tipo_ingreso_lista
WITH (security_invoker = true) AS
SELECT
  t.cuenta,
  t.empresa,
  t.proyecto,
  t.codigo,
  t.nombre,
  t.etiqueta,
  t.forma_pago,
  t.monto,
  t.moneda,
  t.hasta_monto,
  t.facturacion_item,
  t.facturacion_descripcion,
  t.mora,
  t.impuesto,
  t.editable,
  t.fijo,
  t.activo,
  t.agrego_usuario,
  t.agrego_fecha,
  t.modifico_usuario,
  t.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_tipo_ingreso t
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = t.cuenta AND emp.codigo = t.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = t.cuenta AND pry.empresa = t.empresa AND pry.codigo = t.proyecto;

-- ── Tipos de documento ──────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_tipo_documento_lista;
CREATE VIEW cartera.v_tipo_documento_lista
WITH (security_invoker = true) AS
SELECT
  t.cuenta,
  t.empresa,
  t.proyecto,
  t.codigo,
  t.descripcion,
  t.agrego_usuario,
  t.agrego_fecha,
  t.modifico_usuario,
  t.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_tipo_documento t
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = t.cuenta AND emp.codigo = t.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = t.cuenta AND pry.empresa = t.empresa AND pry.codigo = t.proyecto;

-- ── GFACE (sin token ni contraseña del certificado) ────────────────────────

DROP VIEW IF EXISTS cartera.v_gface_lista;
CREATE VIEW cartera.v_gface_lista
WITH (security_invoker = true) AS
SELECT
  g.cuenta,
  g.empresa,
  g.proyecto,
  g.codigo,
  g.nombre,
  g.requestor,
  g.entity,
  g.user_name,
  g.web_service,
  g.web_service_documento,
  g.certificado_post,
  g.certificado_ruta,
  g.certificado_nombre,
  g.correo_envio,
  g.correo_copia,
  g.primera_firma,
  g.validar_identificacion,
  g.agrego_usuario,
  g.agrego_fecha,
  g.modifico_usuario,
  g.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_gface g
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = g.cuenta AND emp.codigo = g.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = g.cuenta AND pry.empresa = g.empresa AND pry.codigo = g.proyecto;

-- ── Tasas de cambio ─────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_tasa_cambio_lista;
CREATE VIEW cartera.v_tasa_cambio_lista
WITH (security_invoker = true) AS
SELECT
  t.cuenta,
  t.empresa,
  t.proyecto,
  t.moneda,
  t.fecha,
  t.tasa_cambio,
  t.agrego_usuario,
  t.agrego_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre
FROM cartera.t_moneda_tasa_cambio t
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = t.cuenta AND emp.codigo = t.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = t.cuenta AND pry.empresa = t.empresa AND pry.codigo = t.proyecto;

-- ── Transacciones bancarias ─────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_transaccion_bancaria_lista;
CREATE VIEW cartera.v_transaccion_bancaria_lista
WITH (security_invoker = true) AS
SELECT
  t.empresa,
  t.proyecto,
  t.cuenta_bancaria,
  t.numero_transaccion,
  t.tipo_transaccion,
  t.fecha,
  t.numero_documento,
  t.valor,
  t.estado,
  t.origen,
  t.a_nombre_de,
  t.comentario,
  t.partida,
  t.tipo_saldo,
  t.en_circulacion,
  t.fecha_conciliacion,
  t.tasa_cambio,
  t.cuenta_transferencia,
  t.transaccion_transferencia,
  t.usuario_agrego,
  t.fecha_agrego,
  t.usuario_modifico,
  t.fecha_modifico,
  t.cuenta,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  CASE
    WHEN ban.nombre IS NOT NULL THEN ban.nombre || ' · ' || cb.numero
    WHEN cb.numero IS NOT NULL THEN cb.numero
    ELSE NULL
  END AS cuenta_bancaria_nombre
FROM cartera.t_transaccion_bancaria t
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = t.cuenta AND emp.codigo = t.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = t.cuenta AND pry.empresa = t.empresa AND pry.codigo = t.proyecto
LEFT JOIN cartera.t_cuenta_bancaria cb
  ON cb.cuenta = t.cuenta
 AND cb.empresa = t.empresa
 AND cb.proyecto = t.proyecto
 AND cb.codigo = t.cuenta_bancaria
LEFT JOIN cartera.t_banco ban
  ON cb.banco > 0
 AND ban.cuenta = cb.cuenta
 AND ban.empresa = cb.empresa
 AND ban.proyecto = cb.proyecto
 AND ban.codigo = cb.banco;

-- ── Recibos de caja ─────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_recibo_caja_lista;
CREATE VIEW cartera.v_recibo_caja_lista
WITH (security_invoker = true) AS
SELECT
  r.cuenta,
  r.empresa,
  r.proyecto,
  r.serie,
  r.numero,
  r.fecha,
  r.promesa,
  r.reserva,
  r.cliente,
  r.fase,
  r.manzana,
  r.lote,
  r.forma_pago,
  r.banco,
  r.numero_cuenta,
  r.numero_documento,
  r.cuenta_deposito,
  r.transaccion_bancaria,
  r.cobrador,
  r.moneda,
  r.tasa_cambio,
  r.monto,
  r.mora,
  r.abono_capital,
  r.tipo_ingreso,
  r.factura_serie,
  r.factura_numero,
  r.observaciones,
  r.estado,
  r.agrego_usuario,
  r.agrego_fecha,
  r.modifico_usuario,
  r.modifico_fecha,
  r.secuencia,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  cli.nombre AS cliente_nombre,
  cob.nombre AS cobrador_nombre,
  ban.nombre AS banco_nombre
FROM cartera.t_recibo_caja r
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = r.cuenta AND emp.codigo = r.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = r.cuenta AND pry.empresa = r.empresa AND pry.codigo = r.proyecto
LEFT JOIN cartera.t_cliente cli
  ON r.cliente > 0
 AND cli.cuenta = r.cuenta
 AND cli.empresa = r.empresa
 AND cli.proyecto = r.proyecto
 AND cli.codigo = r.cliente
LEFT JOIN cartera.t_cobrador cob
  ON r.cobrador > 0
 AND cob.cuenta = r.cuenta
 AND cob.empresa = r.empresa
 AND cob.proyecto = r.proyecto
 AND cob.codigo = r.cobrador
LEFT JOIN cartera.t_banco ban
  ON r.banco > 0
 AND ban.cuenta = r.cuenta
 AND ban.empresa = r.empresa
 AND ban.proyecto = r.proyecto
 AND ban.codigo = r.banco;

-- ── Reservas (recibo en la misma fila) ──────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_reserva_lista;
CREATE VIEW cartera.v_reserva_lista
WITH (security_invoker = true) AS
SELECT
  r.cuenta,
  r.numero,
  r.empresa,
  r.proyecto,
  r.fase,
  r.manzana,
  r.lote,
  r.cliente,
  r.vendedor,
  COALESCE(r.recibo_serie, '') AS recibo_serie,
  r.recibo_numero,
  r.estado,
  rc.fecha AS fecha,
  COALESCE(rc.monto, 0) AS monto,
  COALESCE(rc.moneda, 'GTQ') AS moneda,
  COALESCE(rc.forma_pago, 0) AS forma_pago,
  COALESCE(rc.banco, 0) AS banco,
  COALESCE(rc.numero_cuenta, '') AS numero_cuenta,
  COALESCE(rc.numero_documento, '') AS numero_documento,
  COALESCE(rc.cuenta_deposito, 0) AS cuenta_deposito,
  COALESCE(rc.cobrador, 0) AS cobrador,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  fas.nombre AS fase_nombre,
  cli.nombre AS cliente_nombre,
  ven.nombre AS vendedor_nombre,
  ban.nombre AS banco_nombre,
  CASE
    WHEN depb.nombre IS NOT NULL THEN depb.nombre || ' · ' || dep.numero
    WHEN dep.numero IS NOT NULL THEN dep.numero
    ELSE NULL
  END AS cuenta_deposito_nombre
FROM cartera.t_reserva r
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = r.cuenta AND emp.codigo = r.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = r.cuenta AND pry.empresa = r.empresa AND pry.codigo = r.proyecto
LEFT JOIN cartera.t_fase fas
  ON fas.cuenta = r.cuenta AND fas.empresa = r.empresa AND fas.proyecto = r.proyecto AND fas.codigo = r.fase
LEFT JOIN cartera.t_cliente cli
  ON r.cliente > 0
 AND cli.cuenta = r.cuenta AND cli.empresa = r.empresa AND cli.proyecto = r.proyecto AND cli.codigo = r.cliente
LEFT JOIN cartera.t_vendedor ven
  ON r.vendedor > 0
 AND ven.cuenta = r.cuenta AND ven.empresa = r.empresa AND ven.proyecto = r.proyecto AND ven.codigo = r.vendedor
LEFT JOIN cartera.t_recibo_caja rc
  ON r.recibo_numero > 0
 AND rc.cuenta = r.cuenta
 AND rc.empresa = r.empresa
 AND rc.proyecto = r.proyecto
 AND rc.serie = r.recibo_serie
 AND rc.numero = r.recibo_numero
LEFT JOIN cartera.t_banco ban
  ON rc.banco > 0
 AND ban.cuenta = rc.cuenta AND ban.empresa = rc.empresa AND ban.proyecto = rc.proyecto AND ban.codigo = rc.banco
LEFT JOIN cartera.t_cuenta_bancaria dep
  ON rc.cuenta_deposito > 0
 AND dep.cuenta = rc.cuenta AND dep.empresa = rc.empresa AND dep.proyecto = rc.proyecto AND dep.codigo = rc.cuenta_deposito
LEFT JOIN cartera.t_banco depb
  ON dep.banco > 0
 AND depb.cuenta = dep.cuenta AND depb.empresa = dep.empresa AND depb.proyecto = dep.proyecto AND depb.codigo = dep.banco;

-- ── Promesas ────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS cartera.v_promesa_lista;
CREATE VIEW cartera.v_promesa_lista
WITH (security_invoker = true) AS
SELECT
  p.cuenta,
  p.empresa,
  p.proyecto,
  p.numero,
  p.referencia,
  p.fecha,
  p.cliente,
  p.vendedor,
  p.fase,
  p.manzana,
  p.lote,
  p.moneda,
  p.valor_lote,
  p.subsidio,
  p.arras,
  p.monto_enganche,
  p.primer_enganche,
  p.plazo_enganche,
  p.interes_anual,
  p.forma_mora,
  p.interes_mora,
  p.fijo_mora,
  p.mora_enganche,
  p.dias_gracia,
  p.dias_afectos,
  p.forma_financiamiento,
  p.fecha_financiamiento,
  p.monto_financiamiento,
  p.plazo_financiamiento,
  p.fecha_cancelacion,
  p.venta,
  p.observacion,
  p.estado,
  p.agrego_usuario,
  p.agrego_fecha,
  p.modifico_usuario,
  p.modifico_fecha,
  emp.nombre AS empresa_nombre,
  pry.nombre AS proyecto_nombre,
  fas.nombre AS fase_nombre,
  cli.nombre AS cliente_nombre,
  ven.nombre AS vendedor_nombre
FROM cartera.t_promesa p
INNER JOIN cartera.t_empresa emp
  ON emp.cuenta = p.cuenta AND emp.codigo = p.empresa
INNER JOIN cartera.t_proyecto pry
  ON pry.cuenta = p.cuenta AND pry.empresa = p.empresa AND pry.codigo = p.proyecto
LEFT JOIN cartera.t_fase fas
  ON fas.cuenta = p.cuenta AND fas.empresa = p.empresa AND fas.proyecto = p.proyecto AND fas.codigo = p.fase
LEFT JOIN cartera.t_cliente cli
  ON p.cliente > 0
 AND cli.cuenta = p.cuenta AND cli.empresa = p.empresa AND cli.proyecto = p.proyecto AND cli.codigo = p.cliente
LEFT JOIN cartera.t_vendedor ven
  ON p.vendedor > 0
 AND ven.cuenta = p.cuenta AND ven.empresa = p.empresa AND ven.proyecto = p.proyecto AND ven.codigo = p.vendedor;

-- ── Permisos ────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE cartera.v_empresa_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_proyecto_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_fase_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_manzana_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_lote_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_cliente_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_supervisor_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_cobrador_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_coordinador_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_vendedor_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_banco_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_cuenta_bancaria_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_serie_recibo_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_serie_factura_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_tipo_ingreso_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_tipo_documento_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_gface_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_tasa_cambio_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_transaccion_bancaria_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_recibo_caja_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_reserva_lista FROM PUBLIC;
REVOKE ALL ON TABLE cartera.v_promesa_lista FROM PUBLIC;

GRANT SELECT ON TABLE cartera.v_empresa_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_proyecto_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_fase_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_manzana_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_lote_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_cliente_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_supervisor_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_cobrador_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_coordinador_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_vendedor_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_banco_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_cuenta_bancaria_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_serie_recibo_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_serie_factura_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_tipo_ingreso_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_tipo_documento_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_gface_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_tasa_cambio_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_transaccion_bancaria_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_recibo_caja_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_reserva_lista TO authenticated, service_role;
GRANT SELECT ON TABLE cartera.v_promesa_lista TO authenticated, service_role;

-- ── Índices del segmento de las pantallas grandes ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_recibo_caja_cuenta_agrego_fecha
  ON cartera.t_recibo_caja (cuenta, agrego_fecha);

CREATE INDEX IF NOT EXISTS idx_transaccion_bancaria_cuenta_fecha
  ON cartera.t_transaccion_bancaria (cuenta, fecha);

CREATE INDEX IF NOT EXISTS idx_reserva_cuenta_estado_numero
  ON cartera.t_reserva (cuenta, estado, numero);

CREATE INDEX IF NOT EXISTS idx_promesa_cuenta_proyecto_estado_numero
  ON cartera.t_promesa (cuenta, proyecto, estado, numero);
