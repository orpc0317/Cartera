-- =============================================================
-- SCHEMA DDL: cartera
-- Fecha: 2026-04-20
-- Proyecto: Cartera (SaaS Lotificaciones)
-- NOTA: Estructura (DDL) únicamente, sin datos.
--       Actualizado desde information_schema — 45 tablas.
--       Usar como referencia local para evitar consultas premium a Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. ESQUEMA
-- -------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS cartera;


-- -------------------------------------------------------------
-- 2. TABLAS (orden alfabético)
-- -------------------------------------------------------------

-- Accesos directos del usuario al menú
CREATE TABLE IF NOT EXISTS cartera.t_acceso_directo (
  userid              uuid          NOT NULL,
  secuencia           integer       NOT NULL DEFAULT 0,
  nombre              varchar(20)   NOT NULL,
  tipo_aplicacion     smallint      NOT NULL DEFAULT 0,
  indice              varchar(8)    NULL,
  path                varchar(100)  NULL,
  aplicacion          varchar(40)   NULL,
  documento           varchar(100)  NULL,
  PRIMARY KEY (userid, secuencia)
);

-- Log de auditoría (INSERT / UPDATE / DELETE en tablas de negocio)
CREATE TABLE IF NOT EXISTS cartera.t_audit_log (
  id                  bigint        NOT NULL DEFAULT nextval('cartera.t_audit_log_id_seq'::regclass),
  tabla               text          NOT NULL,
  operacion           text          NOT NULL,
  cuenta              text          NULL,
  registro_id         jsonb         NULL,
  datos_antes         jsonb         NULL,
  datos_despues       jsonb         NULL,
  usuario_id          uuid          NULL,
  usuario_email       text          NULL,
  fecha               timestamptz   NOT NULL DEFAULT now(),
  usuario_nombre      text          NULL,
  PRIMARY KEY (id)
);

-- Catálogo de bancos por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_banco (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Clientes por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_cliente (
  cuenta                    varchar     NOT NULL,
  empresa                   integer     NOT NULL DEFAULT 0,
  proyecto                  integer     NOT NULL DEFAULT 0,
  codigo                    bigint      NOT NULL DEFAULT 0,
  nombre                    varchar     NOT NULL,
  direccion                 varchar     NOT NULL,
  direccion_pais            varchar     NULL,
  direccion_departamento    varchar     NULL,
  direccion_municipio       varchar     NULL,
  codigo_postal             varchar     NULL,
  telefono1                 varchar     NOT NULL,
  telefono2                 varchar     NULL,
  correo                    varchar     NULL,
  nombre_factura            varchar     NULL,
  identificacion_tributaria varchar     NULL,
  regimen_iva               smallint    NOT NULL DEFAULT 0,
  agrego_usuario            uuid        NOT NULL,
  agrego_fecha              timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario          uuid        NOT NULL,
  modifico_fecha            timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  tipo_identificacion       smallint    NULL     DEFAULT 0,
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Cobradores por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_cobrador (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  userid              uuid          NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Coordinadores por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_coordinador (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  supervisor          integer       NULL     DEFAULT 0,
  userid              uuid          NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Cuentas SaaS (tenants)
CREATE TABLE IF NOT EXISTS cartera.t_cuenta (
  id                  varchar(15)   NOT NULL DEFAULT cartera.fn_genera_cuentaid(),
  name                varchar(100)  NOT NULL,
  correo              varchar(100)  NOT NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  fecha_agrego        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (id)
);

-- Cuentas bancarias por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_cuenta_bancaria (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  numero              varchar       NOT NULL,
  nombre              varchar       NOT NULL,
  banco               integer       NOT NULL DEFAULT 0,
  moneda              varchar       NOT NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Plan de cuentas contable
CREATE TABLE IF NOT EXISTS cartera.t_cuenta_contable (
  empresa             integer       NOT NULL DEFAULT 0,
  nivel1              varchar(1)    NOT NULL,
  nivel2              varchar(1)    NOT NULL,
  nivel3              varchar(1)    NOT NULL,
  nivel4              varchar(2)    NOT NULL,
  nivel5              varchar(2)    NOT NULL,
  nombre              varchar(40)   NOT NULL,
  tipo_saldo          smallint      NOT NULL DEFAULT 0,
  saldo_inicial       numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, nivel1, nivel2, nivel3, nivel4, nivel5)
);

-- Catálogo de departamentos por país
CREATE TABLE IF NOT EXISTS cartera.t_departamento (
  pais                varchar       NOT NULL,
  codigo              varchar       NOT NULL,
  nombre              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (pais, codigo)
);

-- Detalle de líneas de factura
CREATE TABLE IF NOT EXISTS cartera.t_detalle_factura (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  serie               varchar(3)    NOT NULL,
  factura             integer       NOT NULL DEFAULT 0,
  secuencia           integer       NOT NULL DEFAULT 0,
  servicio            varchar(15)   NOT NULL,
  descripcion         varchar(500)  NOT NULL,
  precio_venta        numeric(18,8) NOT NULL DEFAULT 0,
  cantidad            numeric(18,8) NOT NULL DEFAULT 0,
  descuento           numeric(18,8) NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, proyecto, serie, factura, secuencia)
);

-- Detalle de aplicación de recibo de caja a cuotas
CREATE TABLE IF NOT EXISTS cartera.t_detalle_recibo_caja (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  serie_recibo        varchar(3)    NOT NULL,
  recibo              integer       NOT NULL DEFAULT 0,
  fecha_cuota         date          NOT NULL,
  tipo_cuota          smallint      NOT NULL DEFAULT 0,
  cuota               integer       NOT NULL DEFAULT 0,
  capital             numeric(18,2) NOT NULL DEFAULT 0,
  intereses           numeric(18,2) NOT NULL DEFAULT 0,
  mora                numeric(18,2) NOT NULL DEFAULT 0,
  otros               numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, proyecto, serie_recibo, recibo, tipo_cuota, cuota)
);

-- Detalle de recibo para cargos adicionales
CREATE TABLE IF NOT EXISTS cartera.t_detalle_recibo_otros (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  serie_recibo        varchar(3)    NOT NULL,
  recibo              integer       NOT NULL DEFAULT 0,
  fecha_cuota         date          NOT NULL,
  tipo_cuota          smallint      NOT NULL DEFAULT 0,
  cuota               integer       NOT NULL DEFAULT 0,
  secuencia           integer       NOT NULL DEFAULT 0,
  otro                numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, proyecto, serie_recibo, recibo, tipo_cuota, cuota, secuencia)
);

-- Empresas (tenants de primer nivel)
CREATE TABLE IF NOT EXISTS cartera.t_empresa (
  cuenta                    varchar     NOT NULL,
  codigo                    integer     NOT NULL DEFAULT 0,
  nombre                    varchar     NOT NULL,
  razon_social              varchar     NOT NULL,
  identificacion_tributaria  varchar     NOT NULL,
  pais                      varchar     NOT NULL,
  departamento              varchar     NOT NULL,
  municipio                 varchar     NOT NULL,
  direccion                 varchar     NOT NULL,
  codigo_postal             varchar     NOT NULL,
  regimen_isr               smallint    NOT NULL DEFAULT 0,
  agrego_usuario            uuid        NOT NULL,
  agrego_fecha              timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario          uuid        NOT NULL,
  modifico_fecha            timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, codigo)
);

-- Relación usuario–empresa (control de acceso)
CREATE TABLE IF NOT EXISTS cartera.t_empresa_usuario (
  userid              uuid          NOT NULL,
  empresa             integer       NOT NULL,
  PRIMARY KEY (userid, empresa)
);

-- Cabecera de facturas
CREATE TABLE IF NOT EXISTS cartera.t_factura (
  empresa                   integer       NOT NULL DEFAULT 0,
  proyecto                  integer       NOT NULL DEFAULT 0,
  serie                     varchar(3)    NOT NULL,
  factura                   integer       NOT NULL DEFAULT 0,
  fecha                     date          NOT NULL,
  cliente                   integer       NOT NULL DEFAULT 0,
  nombre                    varchar(100)  NOT NULL,
  direccion                 varchar(150)  NULL,
  telefono                  varchar(15)   NULL,
  nit                       varchar(20)   NULL,
  vendedor                  integer       NOT NULL DEFAULT 0,
  cobrador                  integer       NOT NULL DEFAULT 0,
  pedido                    varchar(15)   NULL,
  dias_credito              integer       NOT NULL DEFAULT 0,
  fecha_pago                date          NULL,
  fecha_proximo_pago        date          NULL,
  fecha_cancelacion         date          NULL,
  fecha_periodo             date          NULL,
  contrasena                varchar(15)   NULL,
  partida                   varchar(11)   NULL,
  partida_anulacion         varchar(11)   NULL,
  partida_costo             varchar(11)   NULL,
  partida_costo_anulacion   varchar(11)   NULL,
  moneda                    integer       NOT NULL DEFAULT 0,
  tasa_cambio               numeric(18,8) NOT NULL DEFAULT 0,
  iva                       numeric(18,8) NOT NULL DEFAULT 0,
  total_pagado              numeric(18,2) NOT NULL DEFAULT 0,
  exportacion               smallint      NOT NULL DEFAULT 0,
  periodo                   varchar(50)   NULL,
  observaciones             varchar(254)  NULL,
  origen                    smallint      NOT NULL DEFAULT 0,
  certificar_gface          smallint      NOT NULL DEFAULT 0,
  certificado_gface         varchar(255)  NULL,
  certificado_serie         varchar(10)   NULL,
  certificado_numero        varchar(10)   NULL,
  certificado_fecha         varchar(50)   NULL,
  id_documento              varchar(50)   NULL,
  anular_gface              smallint      NOT NULL DEFAULT 0,
  anulada_nc                smallint      NOT NULL DEFAULT 0,
  estado                    smallint      NOT NULL DEFAULT 0,
  usuario_agrego            uuid          NOT NULL,
  fecha_agrego              timestamptz   NOT NULL DEFAULT now(),
  usuario_modifico          uuid          NOT NULL,
  fecha_modifico            timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, proyecto, serie, factura)
);

-- Fases de proyecto (etapas)
CREATE TABLE IF NOT EXISTS cartera.t_fase (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  medida              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Configuración de facturación electrónica (GFACE / FEL)
CREATE TABLE IF NOT EXISTS cartera.t_gface (
  empresa                   integer      NOT NULL DEFAULT 0,
  proyecto                  integer      NOT NULL DEFAULT 0,
  codigo                    integer      NOT NULL DEFAULT 0,
  nombre                    varchar(100) NOT NULL,
  requestor                 varchar(50)  NULL,
  entity                    varchar(25)  NULL,
  user_name                 varchar(25)  NULL,
  token                     varchar(50)  NULL,
  web_service               varchar(100) NULL,
  web_service_documento     varchar(100) NULL,
  primera_firma             smallint     NOT NULL DEFAULT 0,
  certificado_post          varchar(100) NULL,
  certificado_ruta          varchar(100) NULL,
  certificado_nombre        varchar(50)  NULL,
  certificado_contrasena    varchar(25)  NULL,
  correo_envio              varchar(50)  NULL,
  correo_copia              varchar(50)  NULL,
  validar_identificacion    smallint     NOT NULL DEFAULT 0,
  usuario_agrego            uuid         NOT NULL,
  fecha_agrego              timestamptz  NOT NULL DEFAULT now(),
  usuario_modifico          uuid         NOT NULL,
  fecha_modifico            timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, proyecto, codigo)
);

-- Grupos de usuarios
CREATE TABLE IF NOT EXISTS cartera.t_grupo_usuario (
  userid              uuid          NOT NULL,
  grupo               integer       NOT NULL DEFAULT 0,
  PRIMARY KEY (userid, grupo)
);

-- Lotes (unidades de terreno vendibles)
CREATE TABLE IF NOT EXISTS cartera.t_lote (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  fase                integer       NOT NULL DEFAULT 0,
  manzana             varchar       NOT NULL,
  codigo              varchar       NOT NULL,
  moneda              varchar       NOT NULL,
  valor               numeric       NOT NULL DEFAULT 0,
  finca               varchar       NULL,
  folio               varchar       NULL,
  libro               varchar       NULL,
  extension           numeric       NOT NULL DEFAULT 0,
  norte               varchar       NULL,
  sur                 varchar       NULL,
  este                varchar       NULL,
  oeste               varchar       NULL,
  otro                varchar       NULL,
  promesa             bigint        NOT NULL DEFAULT 0,
  recibo_serie        varchar       NULL,
  recibo_numero       bigint        NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamp     NOT NULL DEFAULT '1900-01-01 00:00:00',  -- sin zona horaria
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamp     NOT NULL DEFAULT '1900-01-01 00:00:00',  -- sin zona horaria
  PRIMARY KEY (cuenta, empresa, proyecto, fase, manzana, codigo)
);

-- Manzanas (bloques de lotes)
CREATE TABLE IF NOT EXISTS cartera.t_manzana (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  fase                integer       NOT NULL DEFAULT 0,
  codigo              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, fase, codigo)
);

-- Catálogo maestro de pantallas / permisos del sistema
CREATE TABLE IF NOT EXISTS cartera.t_menu (
  indice              varchar(8)    NOT NULL,
  menu_array          varchar(20)   NOT NULL,
  pantalla            varchar(20)   NULL,
  nombre              varchar(40)   NOT NULL,
  tipo_pantalla       smallint      NOT NULL DEFAULT 0,
  mantenimiento       smallint      NOT NULL DEFAULT 0,
  agregar             smallint      NOT NULL DEFAULT 0,
  modificar           smallint      NOT NULL DEFAULT 0,
  eliminar            smallint      NOT NULL DEFAULT 0,
  consultar           smallint      NOT NULL DEFAULT 0,
  PRIMARY KEY (indice)
);

-- Módulos de menú por cuenta
CREATE TABLE IF NOT EXISTS cartera.t_menu_modulo (
  cuenta              varchar       NOT NULL,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, codigo)
);

-- Permisos de menú por usuario
CREATE TABLE IF NOT EXISTS cartera.t_menu_usuario (
  userid              uuid          NOT NULL,
  indice              varchar(8)    NOT NULL,
  agregar             smallint      NOT NULL DEFAULT 0,
  modificar           smallint      NOT NULL DEFAULT 0,
  eliminar            smallint      NOT NULL DEFAULT 0,
  consultar           smallint      NOT NULL DEFAULT 0,
  PRIMARY KEY (userid, indice)
);

-- Catálogo de monedas
CREATE TABLE IF NOT EXISTS cartera.t_moneda (
  codigo              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (codigo)
);

-- Catálogo de municipios por departamento/país
CREATE TABLE IF NOT EXISTS cartera.t_municipio (
  pais                varchar       NOT NULL,
  departamento        varchar       NOT NULL,
  codigo              varchar       NOT NULL,
  nombre              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (pais, departamento, codigo)
);

-- Catálogo de países
CREATE TABLE IF NOT EXISTS cartera.t_pais (
  codigo              varchar       NOT NULL,
  nombre              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (codigo)
);

-- Parámetros generales por empresa
CREATE TABLE IF NOT EXISTS cartera.t_parametros_empresa (
  empresa             integer       NOT NULL DEFAULT 0,
  horario             varchar(40)   NULL,
  dia_pago            integer       NOT NULL DEFAULT 0,
  iva                 numeric(18,8) NOT NULL DEFAULT 0,
  cuenta_bancaria     integer       NOT NULL DEFAULT 0,
  tipo_cliente        smallint      NOT NULL DEFAULT 0,
  grupo_cliente       smallint      NOT NULL DEFAULT 0,
  cliente             integer       NOT NULL DEFAULT 0,
  tarjeta             smallint      NOT NULL DEFAULT 0,
  departamento        smallint      NOT NULL DEFAULT 0,
  vendedor            integer       NOT NULL DEFAULT 0,
  cobrador            integer       NOT NULL DEFAULT 0,
  grupo               integer       NOT NULL DEFAULT 0,
  proyectos           integer       NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa)
);

-- Versiones de parámetros financieros de una promesa
CREATE TABLE IF NOT EXISTS cartera.t_parametros_promesa (
  empresa                   integer       NOT NULL DEFAULT 0,
  proyecto                  integer       NOT NULL DEFAULT 0,
  promesa                   integer       NOT NULL DEFAULT 0,
  apartir_de                date          NOT NULL,
  forma_financiamiento      smallint      NOT NULL DEFAULT 0,
  monto_financiamiento      numeric(18,2) NOT NULL DEFAULT 0,
  plazo_financiamiento      integer       NOT NULL DEFAULT 0,
  interes_anual             numeric(18,8) NOT NULL DEFAULT 0,
  forma_mora                smallint      NOT NULL DEFAULT 0,
  interes_mora              numeric(18,8) NOT NULL DEFAULT 0,
  fijo_mora                 numeric(18,8) NOT NULL DEFAULT 0,
  dias_afectos              integer       NOT NULL DEFAULT 0,
  dias_gracia               integer       NOT NULL DEFAULT 0,
  inicial                   smallint      NOT NULL DEFAULT 0,
  condiciones_financiamiento smallint     NOT NULL DEFAULT 0,
  condiciones_mora          smallint      NOT NULL DEFAULT 0,
  version                   integer       NOT NULL DEFAULT 0,
  estado                    smallint      NOT NULL DEFAULT 0,
  usuario_agrego            uuid          NOT NULL,
  fecha_agrego              timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, proyecto, promesa, version)
);

-- Plan de pagos — cargos adicionales (otros)
CREATE TABLE IF NOT EXISTS cartera.t_plan_otros (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  promesa             integer       NOT NULL DEFAULT 0,
  fecha               date          NOT NULL,
  tipo_cuota          smallint      NOT NULL DEFAULT 0,
  cuota               integer       NOT NULL DEFAULT 0,
  secuencia           integer       NOT NULL DEFAULT 0,
  monto               numeric(18,2) NOT NULL DEFAULT 0,
  monto_pagado        numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, proyecto, promesa, tipo_cuota, cuota, secuencia)
);

-- Plan de pagos — cuotas de capital e intereses
CREATE TABLE IF NOT EXISTS cartera.t_plan_pago (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  promesa             integer       NOT NULL DEFAULT 0,
  fecha               date          NOT NULL,
  tipo_cuota          smallint      NOT NULL DEFAULT 0,
  cuota               integer       NOT NULL DEFAULT 0,
  capital             numeric(18,2) NOT NULL DEFAULT 0,
  capital_pagado      numeric(18,2) NOT NULL DEFAULT 0,
  interes             numeric(18,2) NOT NULL DEFAULT 0,
  interes_pagado      numeric(18,2) NOT NULL DEFAULT 0,
  mora                numeric(18,2) NOT NULL DEFAULT 0,
  mora_pagado         numeric(18,2) NOT NULL DEFAULT 0,
  otros               numeric(18,2) NOT NULL DEFAULT 0,
  estado              smallint      NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa, proyecto, promesa, tipo_cuota, cuota)
);

-- Promesas de compra-venta de lote
CREATE TABLE IF NOT EXISTS cartera.t_promesa (
  empresa                   integer       NOT NULL DEFAULT 0,
  proyecto                  integer       NOT NULL DEFAULT 0,
  numero                    integer       NOT NULL DEFAULT 0,
  fecha                     date          NOT NULL,
  cliente                   integer       NOT NULL DEFAULT 0,
  vendedor                  integer       NOT NULL DEFAULT 0,
  fase                      integer       NOT NULL DEFAULT 0,
  manzana                   varchar(5)    NOT NULL,
  lote                      varchar(5)    NOT NULL,
  valor_lote                numeric(18,2) NOT NULL DEFAULT 0,
  subsidio                  numeric(18,2) NOT NULL DEFAULT 0,
  arras                     numeric(18,2) NOT NULL DEFAULT 0,
  monto_enganche            numeric(18,2) NOT NULL DEFAULT 0,
  primer_enganche           numeric(18,2) NOT NULL DEFAULT 0,
  plazo_enganche            integer       NOT NULL DEFAULT 0,
  interes_anual             numeric(18,8) NOT NULL DEFAULT 0,
  forma_mora                smallint      NOT NULL DEFAULT 0,
  interes_mora              numeric(18,8) NOT NULL DEFAULT 0,
  fijo_mora                 smallint      NOT NULL DEFAULT 0,
  mora_enganche             smallint      NOT NULL DEFAULT 0,
  dias_gracia               integer       NOT NULL DEFAULT 0,
  dias_afectos              integer       NOT NULL DEFAULT 0,
  forma_financiamiento      smallint      NOT NULL DEFAULT 0,
  fecha_financiamiento      date          NULL,
  monto_financiamiento      numeric(18,2) NOT NULL DEFAULT 0,
  plazo_financiamiento      integer       NOT NULL DEFAULT 0,
  fecha_cancelacion         date          NULL,
  venta                     smallint      NOT NULL DEFAULT 0,
  observacion               varchar(150)  NULL,
  estado                    smallint      NOT NULL DEFAULT 0,
  usuario_agrego            uuid          NOT NULL,
  fecha_agrego              timestamptz   NOT NULL DEFAULT now(),
  usuario_modifico          uuid          NOT NULL,
  fecha_modifico            timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, proyecto, numero)
);

-- Cargos adicionales configurados en una promesa
CREATE TABLE IF NOT EXISTS cartera.t_promesa_otros (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  promesa             integer       NOT NULL DEFAULT 0,
  secuencia           integer       NOT NULL DEFAULT 0,
  tipo_otros          integer       NOT NULL DEFAULT 0,
  monto               numeric(18,8) NOT NULL DEFAULT 0,
  hasta_monto         numeric(18,2) NOT NULL DEFAULT 0,
  mora                smallint      NOT NULL DEFAULT 0,
  apartir_de          date          NULL,
  aplicar_hasta       date          NULL,
  PRIMARY KEY (empresa, proyecto, promesa, secuencia)
);

-- Proyectos (urbanizaciones / lotificaciones)
CREATE TABLE IF NOT EXISTS cartera.t_proyecto (
  cuenta                        varchar     NOT NULL,
  empresa                       integer     NOT NULL DEFAULT 0,
  codigo                        integer     NOT NULL DEFAULT 0,
  nombre                        varchar     NOT NULL,
  pais                          varchar     NOT NULL,
  departamento                  varchar     NOT NULL,
  municipio                     varchar     NOT NULL,
  direccion                     varchar     NOT NULL,
  codigo_postal                 varchar     NOT NULL,
  telefono1                     varchar     NOT NULL,
  telefono2                     varchar     NULL,
  mora_automatica               smallint    NOT NULL DEFAULT 0,
  fijar_parametros_mora         smallint    NOT NULL DEFAULT 0,
  forma_mora                    smallint    NOT NULL DEFAULT 0,
  interes_mora                  numeric     NOT NULL DEFAULT 0,
  fijo_mora                     numeric     NOT NULL DEFAULT 0,
  mora_enganche                 smallint    NOT NULL DEFAULT 0,
  dias_gracia                   integer     NOT NULL DEFAULT 0,
  dias_afectos                  integer     NOT NULL DEFAULT 0,
  inicio_calculo_mora           date        NOT NULL DEFAULT '1900-01-01',
  calcular_mora_antes           smallint    NOT NULL DEFAULT 0,
  minimo_mora                   numeric     NOT NULL DEFAULT 0,
  minimo_abono_capital          numeric     NOT NULL DEFAULT 0,
  inicio_abono_capital_estricto date        NOT NULL DEFAULT '1900-01-01',
  promesa_vencida               smallint    NOT NULL DEFAULT 0,
  agrego_usuario                uuid        NOT NULL,
  agrego_fecha                  timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario              uuid        NOT NULL,
  modifico_fecha                timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  moneda                        varchar     NOT NULL DEFAULT 'GTQ',
  logo_url                      varchar     NULL,
  PRIMARY KEY (cuenta, empresa, codigo)
);

-- Monedas habilitadas por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_proyecto_moneda (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  moneda              varchar       NOT NULL,
  predeterminado      smallint      NOT NULL DEFAULT 0,
  activo              smallint      NOT NULL DEFAULT 0,
  PRIMARY KEY (cuenta, empresa, proyecto, moneda)
);

-- Recibos de caja (pagos recibidos)
CREATE TABLE IF NOT EXISTS cartera.t_recibo_caja (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  serie               varchar       NOT NULL,
  numero              bigint        NOT NULL DEFAULT 0,
  fecha               date          NOT NULL DEFAULT '1900-01-01',
  promesa             bigint        NOT NULL DEFAULT 0,
  cliente             bigint        NOT NULL DEFAULT 0,
  fase                integer       NOT NULL DEFAULT 0,
  manzana             varchar       NULL,
  lote                varchar       NULL,
  forma_pago          smallint      NOT NULL DEFAULT 0,
  banco               integer       NOT NULL DEFAULT 0,
  numero_cuenta       varchar       NULL,
  numero_documento    varchar       NULL,
  cuenta_deposito     integer       NOT NULL DEFAULT 0,
  transaccion_bancaria varchar      NULL,
  cobrador            integer       NOT NULL DEFAULT 0,
  moneda              varchar       NOT NULL,
  tasa_cambio         numeric       NOT NULL DEFAULT 0,
  monto               numeric       NOT NULL DEFAULT 0,
  mora                numeric       NOT NULL DEFAULT 0,
  abono_capital       smallint      NOT NULL DEFAULT 0,
  tipo_ingreso        integer       NOT NULL DEFAULT 0,
  factura_serie       varchar       NULL,
  factura_numero      bigint        NOT NULL DEFAULT 0,
  observaciones       varchar       NULL,
  secuencia           timestamptz   NOT NULL DEFAULT now(),  -- timestamp usado como tiebreak de secuencia
  estado              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, serie, numero)
);

-- Roles de usuario por cuenta
CREATE TABLE IF NOT EXISTS cartera.t_rol_usuario (
  cuenta              varchar       NOT NULL,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, codigo)
);

-- Series de facturación por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_serie_factura (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  serie               varchar       NOT NULL,
  gface               integer       NOT NULL DEFAULT 0,
  id_docto_gface      varchar       NULL,
  establecimiento     smallint      NOT NULL DEFAULT 0,
  dispositivo         smallint      NOT NULL DEFAULT 0,
  carpeta_dtes        varchar       NULL,
  formato             smallint      NOT NULL DEFAULT 0,
  predeterminado      smallint      NOT NULL DEFAULT 0,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, serie)
);

-- Series de recibos por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_serie_recibo (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  serie               varchar       NOT NULL,
  serie_factura       varchar       NULL,
  dias_fecha          smallint      NOT NULL DEFAULT 0,
  correlativo         smallint      NOT NULL DEFAULT 0,
  formato             smallint      NOT NULL DEFAULT 0,
  predeterminado      smallint      NOT NULL DEFAULT 0,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, serie)
);

-- Servicios / ítems facturables
CREATE TABLE IF NOT EXISTS cartera.t_servicio (
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              varchar(15)   NOT NULL,
  descripcion         varchar(50)   NOT NULL,
  unidad_medida       varchar(5)    NOT NULL,
  tipo_item           smallint      NOT NULL DEFAULT 0,
  activo              smallint      NOT NULL DEFAULT 0,
  usuario_agrego      uuid          NOT NULL,
  fecha_agrego        timestamptz   NOT NULL DEFAULT now(),
  usuario_modifico    uuid          NOT NULL,
  fecha_modifico      timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, proyecto, codigo)
);

-- Supervisores por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_supervisor (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  userid              uuid          NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Tipos de ingreso (clasificación de recibos)
CREATE TABLE IF NOT EXISTS cartera.t_tipo_ingreso (
  cuenta                    varchar     NOT NULL,
  empresa                   integer     NOT NULL DEFAULT 0,
  proyecto                  integer     NOT NULL DEFAULT 0,
  codigo                    integer     NOT NULL DEFAULT 0,
  descripcion               varchar     NOT NULL,
  etiqueta                  varchar     NOT NULL,
  facturacion_item          varchar     NULL,
  facturacion_descripcion   varchar     NULL,
  forma_pago                smallint    NOT NULL DEFAULT 0,
  monto                     numeric     NOT NULL DEFAULT 0,
  hasta_monto               numeric     NOT NULL DEFAULT 0,
  mora                      smallint    NOT NULL DEFAULT 0,
  impuesto                  smallint    NOT NULL DEFAULT 0,
  editable                  smallint    NOT NULL DEFAULT 0,
  fijo                      smallint    NOT NULL DEFAULT 0,
  activo                    smallint    NOT NULL DEFAULT 0,
  agrego_usuario            uuid        NOT NULL,
  agrego_fecha              timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario          uuid        NOT NULL,
  modifico_fecha            timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);

-- Movimientos bancarios (conciliación)
CREATE TABLE IF NOT EXISTS cartera.t_transaccion_bancaria (
  empresa                   integer       NOT NULL DEFAULT 0,
  cuenta_bancaria           integer       NOT NULL DEFAULT 0,
  numero_transaccion        varchar(11)   NOT NULL,
  tipo_transaccion          smallint      NOT NULL DEFAULT 0,
  fecha                     date          NOT NULL,
  numero_documento          varchar(15)   NOT NULL,
  partida                   varchar(11)   NULL,
  valor                     numeric(18,2) NOT NULL DEFAULT 0,
  valor_en_letras           varchar(100)  NULL,
  tipo_saldo                smallint      NOT NULL DEFAULT 0,
  en_circulacion            smallint      NOT NULL DEFAULT 0,
  a_nombre_de               varchar(100)  NULL,
  comentario                varchar(255)  NULL,
  fecha_conciliacion        date          NULL,
  origen                    smallint      NOT NULL DEFAULT 0,
  tasa_cambio               numeric(18,8) NOT NULL DEFAULT 0,
  cuenta_transferencia      integer       NOT NULL DEFAULT 0,
  transaccion_transferencia varchar(11)   NULL,
  estado                    smallint      NOT NULL DEFAULT 0,
  usuario_agrego            uuid          NOT NULL,
  fecha_agrego              timestamptz   NOT NULL DEFAULT now(),
  usuario_modifico          uuid          NOT NULL,
  fecha_modifico            timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa, cuenta_bancaria, numero_transaccion)
);

-- Usuarios del sistema por cuenta
CREATE TABLE IF NOT EXISTS cartera.t_usuario (
  cuenta              varchar       NOT NULL,
  userid              uuid          NOT NULL,
  nombres             varchar       NOT NULL,
  apellidos           varchar       NOT NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  PRIMARY KEY (cuenta, userid)
);

-- Vendedores por proyecto
CREATE TABLE IF NOT EXISTS cartera.t_vendedor (
  cuenta              varchar       NOT NULL,
  empresa             integer       NOT NULL DEFAULT 0,
  proyecto            integer       NOT NULL DEFAULT 0,
  codigo              integer       NOT NULL DEFAULT 0,
  nombre              varchar       NOT NULL,
  userid              uuid          NULL,
  activo              smallint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid          NOT NULL,
  agrego_fecha        timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid          NOT NULL,
  modifico_fecha      timestamptz   NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  supervisor          integer       NULL,      -- FK lógica a t_supervisor.codigo (mismo empresa/proyecto)
  PRIMARY KEY (cuenta, empresa, proyecto, codigo)
);


-- =============================================================
-- NOTAS IMPORTANTES
-- =============================================================
-- * La columna fue renombrada de "identificaion_tributaria" a "identificacion_tributaria"
--   typo (falta 'c') — es así en la DB real, no corregir.
-- * t_lote.agrego_fecha / modifico_fecha son "timestamp" (sin
--   zona horaria), a diferencia del resto de tablas que usan
--   "timestamptz".
-- * t_recibo_caja.secuencia es timestamptz, se usa como tiebreaker
--   de orden, no como secuencia numérica.
-- * t_vendedor.supervisor es FK lógica a t_supervisor; no existe
--   FOREIGN KEY declarada en la DB.
-- * t_coordinador.supervisor ídem.
-- * La secuencia t_audit_log_id_seq debe existir antes del CREATE TABLE.
-- * La función cartera.fn_genera_cuentaid() debe existir antes del
--   CREATE TABLE t_cuenta.
-- =============================================================
