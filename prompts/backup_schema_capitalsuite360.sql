-- =============================================================
-- BACKUP DEL ESQUEMA: capitalsuite360
-- Fecha: 2026-04-11
-- Proyecto: Cartera (SaaS Lotificaciones)
-- NOTA: Este backup incluye estructura (DDL) únicamente, sin datos.
--       Sirve como respaldo previo al renombramiento del esquema.
-- =============================================================

-- -------------------------------------------------------------
-- 1. CREAR ESQUEMA
-- -------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS capitalsuite360;


-- -------------------------------------------------------------
-- 2. TABLAS
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS capitalsuite360.t_acceso_directo (
  userid              uuid        NOT NULL,
  secuencia           integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  tipo_aplicacion     smallint    NOT NULL DEFAULT 0,
  indice              varchar,
  path                varchar,
  aplicacion          varchar,
  documento           varchar
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_banco (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_cliente (
  cuenta                      varchar     NOT NULL,
  empresa                     integer     NOT NULL DEFAULT 0,
  proyecto                    integer     NOT NULL DEFAULT 0,
  codigo                      bigint      NOT NULL DEFAULT 0,
  nombre                      varchar     NOT NULL,
  direccion                   varchar     NOT NULL,
  direccion_pais              varchar,
  direccion_departamento      varchar,
  direccion_municipio         varchar,
  codigo_postal               varchar,
  telefono1                   varchar     NOT NULL,
  telefono2                   varchar,
  correo                      varchar,
  nombre_factura              varchar,
  identificacion_tributaria   varchar,
  regimen_iva                 smallint    NOT NULL DEFAULT 0,
  agrego_usuario              uuid        NOT NULL,
  agrego_fecha                timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario            uuid        NOT NULL,
  modifico_fecha              timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_cobrador (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  userid              uuid,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_coordinador (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  supervisor          integer     DEFAULT 0,
  userid              uuid,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_cuenta (
  id              varchar     NOT NULL DEFAULT capitalsuite360.fn_genera_cuentaid(),
  name            varchar     NOT NULL,
  correo          varchar     NOT NULL,
  activo          smallint    NOT NULL DEFAULT 0,
  fecha_agrego    timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_cuenta_bancaria (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  numero              varchar     NOT NULL,
  nombre              varchar     NOT NULL,
  banco               integer     NOT NULL DEFAULT 0,
  moneda              varchar     NOT NULL,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_cuenta_contable (
  empresa         integer NOT NULL DEFAULT 0,
  nivel1          varchar NOT NULL,
  nivel2          varchar NOT NULL,
  nivel3          varchar NOT NULL,
  nivel4          varchar NOT NULL,
  nivel5          varchar NOT NULL,
  nombre          varchar NOT NULL,
  tipo_saldo      smallint NOT NULL DEFAULT 0,
  saldo_inicial   numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_departamento (
  pais                varchar     NOT NULL,
  codigo              varchar     NOT NULL,
  nombre              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_detalle_factura (
  empresa         integer NOT NULL DEFAULT 0,
  proyecto        integer NOT NULL DEFAULT 0,
  serie           varchar NOT NULL,
  factura         integer NOT NULL DEFAULT 0,
  secuencia       integer NOT NULL DEFAULT 0,
  servicio        varchar NOT NULL,
  descripcion     varchar NOT NULL,
  precio_venta    numeric NOT NULL DEFAULT 0,
  cantidad        numeric NOT NULL DEFAULT 0,
  descuento       numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_detalle_recibo_caja (
  empresa         integer NOT NULL DEFAULT 0,
  proyecto        integer NOT NULL DEFAULT 0,
  serie_recibo    varchar NOT NULL,
  recibo          integer NOT NULL DEFAULT 0,
  fecha_cuota     date    NOT NULL,
  tipo_cuota      smallint NOT NULL DEFAULT 0,
  cuota           integer NOT NULL DEFAULT 0,
  capital         numeric NOT NULL DEFAULT 0,
  intereses       numeric NOT NULL DEFAULT 0,
  mora            numeric NOT NULL DEFAULT 0,
  otros           numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_detalle_recibo_otros (
  empresa         integer NOT NULL DEFAULT 0,
  proyecto        integer NOT NULL DEFAULT 0,
  serie_recibo    varchar NOT NULL,
  recibo          integer NOT NULL DEFAULT 0,
  fecha_cuota     date    NOT NULL,
  tipo_cuota      smallint NOT NULL DEFAULT 0,
  cuota           integer NOT NULL DEFAULT 0,
  secuencia       integer NOT NULL DEFAULT 0,
  otro            numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_empresa (
  cuenta                      varchar     NOT NULL,
  codigo                      integer     NOT NULL DEFAULT 0,
  nombre                      varchar     NOT NULL,
  razon_social                varchar     NOT NULL,
  identificaion_tributaria    varchar     NOT NULL,
  pais                        varchar     NOT NULL,
  departamento                varchar     NOT NULL,
  municipio                   varchar     NOT NULL,
  direccion                   varchar     NOT NULL,
  codigo_postal               varchar     NOT NULL,
  regimen_isr                 smallint    NOT NULL DEFAULT 0,
  agrego_usuario              uuid        NOT NULL,
  agrego_fecha                timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario            uuid        NOT NULL,
  modifico_fecha              timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_empresa_usuario (
  userid      uuid    NOT NULL,
  empresa     integer NOT NULL
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_factura (
  empresa                     integer     NOT NULL DEFAULT 0,
  proyecto                    integer     NOT NULL DEFAULT 0,
  serie                       varchar     NOT NULL,
  factura                     integer     NOT NULL DEFAULT 0,
  fecha                       date        NOT NULL,
  cliente                     integer     NOT NULL DEFAULT 0,
  nombre                      varchar     NOT NULL,
  direccion                   varchar,
  telefono                    varchar,
  nit                         varchar,
  vendedor                    integer     NOT NULL DEFAULT 0,
  cobrador                    integer     NOT NULL DEFAULT 0,
  pedido                      varchar,
  dias_credito                integer     NOT NULL DEFAULT 0,
  fecha_pago                  date,
  fecha_proximo_pago          date,
  fecha_cancelacion           date,
  fecha_periodo               date,
  contrasena                  varchar,
  partida                     varchar,
  partida_anulacion           varchar,
  partida_costo               varchar,
  partida_costo_anulacion     varchar,
  moneda                      integer     NOT NULL DEFAULT 0,
  tasa_cambio                 numeric     NOT NULL DEFAULT 0,
  iva                         numeric     NOT NULL DEFAULT 0,
  total_pagado                numeric     NOT NULL DEFAULT 0,
  exportacion                 smallint    NOT NULL DEFAULT 0,
  periodo                     varchar,
  observaciones               varchar,
  origen                      smallint    NOT NULL DEFAULT 0,
  certificar_gface            smallint    NOT NULL DEFAULT 0,
  certificado_gface           varchar,
  certificado_serie           varchar,
  certificado_numero          varchar,
  certificado_fecha           varchar,
  id_documento                varchar,
  anular_gface                smallint    NOT NULL DEFAULT 0,
  anulada_nc                  smallint    NOT NULL DEFAULT 0,
  estado                      smallint    NOT NULL DEFAULT 0,
  usuario_agrego              uuid        NOT NULL,
  fecha_agrego                timestamptz NOT NULL DEFAULT now(),
  usuario_modifico            uuid        NOT NULL,
  fecha_modifico              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_fase (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  medida              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_gface (
  empresa                     integer     NOT NULL DEFAULT 0,
  proyecto                    integer     NOT NULL DEFAULT 0,
  codigo                      integer     NOT NULL DEFAULT 0,
  nombre                      varchar     NOT NULL,
  requestor                   varchar,
  entity                      varchar,
  user_name                   varchar,
  token                       varchar,
  web_service                 varchar,
  web_service_documento       varchar,
  primera_firma               smallint    NOT NULL DEFAULT 0,
  certificado_post            varchar,
  certificado_ruta            varchar,
  certificado_nombre          varchar,
  certificado_contrasena      varchar,
  correo_envio                varchar,
  correo_copia                varchar,
  validar_identificacion      smallint    NOT NULL DEFAULT 0,
  usuario_agrego              uuid        NOT NULL,
  fecha_agrego                timestamptz NOT NULL DEFAULT now(),
  usuario_modifico            uuid        NOT NULL,
  fecha_modifico              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_grupo_usuario (
  userid      uuid    NOT NULL,
  grupo       integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_lote (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  fase                integer     NOT NULL DEFAULT 0,
  manzana             varchar     NOT NULL,
  codigo              varchar     NOT NULL,
  moneda              varchar     NOT NULL,
  valor               numeric     NOT NULL DEFAULT 0,
  finca               varchar,
  folio               varchar,
  libro               varchar,
  extension           numeric     NOT NULL DEFAULT 0,
  norte               varchar,
  sur                 varchar,
  este                varchar,
  oeste               varchar,
  otro                varchar,
  promesa             bigint      NOT NULL DEFAULT 0,
  recibo_serie        varchar,
  recibo_numero       bigint      NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamp   NOT NULL DEFAULT '1900-01-01 00:00:00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamp   NOT NULL DEFAULT '1900-01-01 00:00:00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_manzana (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  fase                integer     NOT NULL DEFAULT 0,
  codigo              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_menu (
  indice          varchar     NOT NULL,
  menu_array      varchar     NOT NULL,
  pantalla        varchar,
  nombre          varchar     NOT NULL,
  tipo_pantalla   smallint    NOT NULL DEFAULT 0,
  mantenimiento   smallint    NOT NULL DEFAULT 0,
  agregar         smallint    NOT NULL DEFAULT 0,
  modificar       smallint    NOT NULL DEFAULT 0,
  eliminar        smallint    NOT NULL DEFAULT 0,
  consultar       smallint    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_menu_modulo (
  cuenta              varchar     NOT NULL,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_menu_usuario (
  userid      uuid        NOT NULL,
  indice      varchar     NOT NULL,
  agregar     smallint    NOT NULL DEFAULT 0,
  modificar   smallint    NOT NULL DEFAULT 0,
  eliminar    smallint    NOT NULL DEFAULT 0,
  consultar   smallint    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_moneda (
  codigo              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_municipio (
  pais                varchar     NOT NULL,
  departamento        varchar     NOT NULL,
  codigo              varchar     NOT NULL,
  nombre              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_pais (
  codigo              varchar     NOT NULL,
  nombre              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_parametros_empresa (
  empresa             integer NOT NULL DEFAULT 0,
  horario             varchar,
  dia_pago            integer NOT NULL DEFAULT 0,
  iva                 numeric NOT NULL DEFAULT 0,
  cuenta_bancaria     integer NOT NULL DEFAULT 0,
  tipo_cliente        smallint NOT NULL DEFAULT 0,
  grupo_cliente       smallint NOT NULL DEFAULT 0,
  cliente             integer NOT NULL DEFAULT 0,
  tarjeta             smallint NOT NULL DEFAULT 0,
  departamento        smallint NOT NULL DEFAULT 0,
  vendedor            integer NOT NULL DEFAULT 0,
  cobrador            integer NOT NULL DEFAULT 0,
  grupo               integer NOT NULL DEFAULT 0,
  proyectos           integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_parametros_promesa (
  empresa                         integer     NOT NULL DEFAULT 0,
  proyecto                        integer     NOT NULL DEFAULT 0,
  promesa                         integer     NOT NULL DEFAULT 0,
  apartir_de                      date        NOT NULL,
  forma_financiamiento            smallint    NOT NULL DEFAULT 0,
  monto_financiamiento            numeric     NOT NULL DEFAULT 0,
  plazo_financiamiento            integer     NOT NULL DEFAULT 0,
  interes_anual                   numeric     NOT NULL DEFAULT 0,
  forma_mora                      smallint    NOT NULL DEFAULT 0,
  interes_mora                    numeric     NOT NULL DEFAULT 0,
  fijo_mora                       numeric     NOT NULL DEFAULT 0,
  dias_afectos                    integer     NOT NULL DEFAULT 0,
  dias_gracia                     integer     NOT NULL DEFAULT 0,
  inicial                         smallint    NOT NULL DEFAULT 0,
  condiciones_financiamiento      smallint    NOT NULL DEFAULT 0,
  condiciones_mora                smallint    NOT NULL DEFAULT 0,
  version                         integer     NOT NULL DEFAULT 0,
  estado                          smallint    NOT NULL DEFAULT 0,
  usuario_agrego                  uuid        NOT NULL,
  fecha_agrego                    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_plan_otros (
  empresa         integer NOT NULL DEFAULT 0,
  proyecto        integer NOT NULL DEFAULT 0,
  promesa         integer NOT NULL DEFAULT 0,
  fecha           date    NOT NULL,
  tipo_cuota      smallint NOT NULL DEFAULT 0,
  cuota           integer NOT NULL DEFAULT 0,
  secuencia       integer NOT NULL DEFAULT 0,
  monto           numeric NOT NULL DEFAULT 0,
  monto_pagado    numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_plan_pago (
  empresa             integer NOT NULL DEFAULT 0,
  proyecto            integer NOT NULL DEFAULT 0,
  promesa             integer NOT NULL DEFAULT 0,
  fecha               date    NOT NULL,
  tipo_cuota          smallint NOT NULL DEFAULT 0,
  cuota               integer NOT NULL DEFAULT 0,
  capital             numeric NOT NULL DEFAULT 0,
  capital_pagado      numeric NOT NULL DEFAULT 0,
  interes             numeric NOT NULL DEFAULT 0,
  interes_pagado      numeric NOT NULL DEFAULT 0,
  mora                numeric NOT NULL DEFAULT 0,
  mora_pagado         numeric NOT NULL DEFAULT 0,
  otros               numeric NOT NULL DEFAULT 0,
  estado              smallint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_promesa (
  empresa                 integer     NOT NULL DEFAULT 0,
  proyecto                integer     NOT NULL DEFAULT 0,
  numero                  integer     NOT NULL DEFAULT 0,
  fecha                   date        NOT NULL,
  cliente                 integer     NOT NULL DEFAULT 0,
  vendedor                integer     NOT NULL DEFAULT 0,
  fase                    integer     NOT NULL DEFAULT 0,
  manzana                 varchar     NOT NULL,
  lote                    varchar     NOT NULL,
  valor_lote              numeric     NOT NULL DEFAULT 0,
  subsidio                numeric     NOT NULL DEFAULT 0,
  arras                   numeric     NOT NULL DEFAULT 0,
  monto_enganche          numeric     NOT NULL DEFAULT 0,
  primer_enganche         numeric     NOT NULL DEFAULT 0,
  plazo_enganche          integer     NOT NULL DEFAULT 0,
  interes_anual           numeric     NOT NULL DEFAULT 0,
  forma_mora              smallint    NOT NULL DEFAULT 0,
  interes_mora            numeric     NOT NULL DEFAULT 0,
  fijo_mora               smallint    NOT NULL DEFAULT 0,
  mora_enganche           smallint    NOT NULL DEFAULT 0,
  dias_gracia             integer     NOT NULL DEFAULT 0,
  dias_afectos            integer     NOT NULL DEFAULT 0,
  forma_financiamiento    smallint    NOT NULL DEFAULT 0,
  fecha_financiamiento    date,
  monto_financiamiento    numeric     NOT NULL DEFAULT 0,
  plazo_financiamiento    integer     NOT NULL DEFAULT 0,
  fecha_cancelacion       date,
  venta                   smallint    NOT NULL DEFAULT 0,
  observacion             varchar,
  estado                  smallint    NOT NULL DEFAULT 0,
  usuario_agrego          uuid        NOT NULL,
  fecha_agrego            timestamptz NOT NULL DEFAULT now(),
  usuario_modifico        uuid        NOT NULL,
  fecha_modifico          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_promesa_otros (
  empresa         integer NOT NULL DEFAULT 0,
  proyecto        integer NOT NULL DEFAULT 0,
  promesa         integer NOT NULL DEFAULT 0,
  secuencia       integer NOT NULL DEFAULT 0,
  tipo_otros      integer NOT NULL DEFAULT 0,
  monto           numeric NOT NULL DEFAULT 0,
  hasta_monto     numeric NOT NULL DEFAULT 0,
  mora            smallint NOT NULL DEFAULT 0,
  apartir_de      date,
  aplicar_hasta   date
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_proyecto (
  cuenta                          varchar     NOT NULL,
  empresa                         integer     NOT NULL DEFAULT 0,
  codigo                          integer     NOT NULL DEFAULT 0,
  nombre                          varchar     NOT NULL,
  pais                            varchar     NOT NULL,
  departamento                    varchar     NOT NULL,
  municipio                       varchar     NOT NULL,
  direccion                       varchar     NOT NULL,
  codigo_postal                   varchar     NOT NULL,
  telefono1                       varchar     NOT NULL,
  telefono2                       varchar,
  mora_automatica                 smallint    NOT NULL DEFAULT 0,
  fijar_parametros_mora           smallint    NOT NULL DEFAULT 0,
  forma_mora                      smallint    NOT NULL DEFAULT 0,
  interes_mora                    numeric     NOT NULL DEFAULT 0,
  fijo_mora                       numeric     NOT NULL DEFAULT 0,
  mora_enganche                   smallint    NOT NULL DEFAULT 0,
  dias_gracia                     integer     NOT NULL DEFAULT 0,
  dias_afectos                    integer     NOT NULL DEFAULT 0,
  inicio_calculo_mora             date        NOT NULL DEFAULT '1900-01-01',
  calcular_mora_antes             smallint    NOT NULL DEFAULT 0,
  minimo_mora                     numeric     NOT NULL DEFAULT 0,
  minimo_abono_capital            numeric     NOT NULL DEFAULT 0,
  inicio_abono_capital_estricto   date        NOT NULL DEFAULT '1900-01-01',
  promesa_vencida                 smallint    NOT NULL DEFAULT 0,
  agrego_usuario                  uuid        NOT NULL,
  agrego_fecha                    timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario                uuid        NOT NULL,
  modifico_fecha                  timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_proyecto_moneda (
  cuenta          varchar  NOT NULL,
  empresa         integer  NOT NULL DEFAULT 0,
  proyecto        integer  NOT NULL DEFAULT 0,
  moneda          varchar  NOT NULL,
  predeterminado  smallint NOT NULL DEFAULT 0,
  activo          smallint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_recibo_caja (
  cuenta                  varchar     NOT NULL,
  empresa                 integer     NOT NULL DEFAULT 0,
  proyecto                integer     NOT NULL DEFAULT 0,
  serie                   varchar     NOT NULL,
  numero                  bigint      NOT NULL DEFAULT 0,
  fecha                   date        NOT NULL DEFAULT '1900-01-01',
  promesa                 bigint      NOT NULL DEFAULT 0,
  cliente                 bigint      NOT NULL DEFAULT 0,
  fase                    integer     NOT NULL DEFAULT 0,
  manzana                 varchar,
  lote                    varchar,
  forma_pago              smallint    NOT NULL DEFAULT 0,
  banco                   integer     NOT NULL DEFAULT 0,
  numero_cuenta           varchar,
  numero_documento        varchar,
  cuenta_deposito         integer     NOT NULL DEFAULT 0,
  transaccion_bancaria    varchar,
  cobrador                integer     NOT NULL DEFAULT 0,
  moneda                  varchar     NOT NULL,
  tasa_cambio             numeric     NOT NULL DEFAULT 0,
  monto                   numeric     NOT NULL DEFAULT 0,
  mora                    numeric     NOT NULL DEFAULT 0,
  abono_capital           smallint    NOT NULL DEFAULT 0,
  tipo_ingreso            integer     NOT NULL DEFAULT 0,
  factura_serie           varchar,
  factura_numero          bigint      NOT NULL DEFAULT 0,
  observaciones           varchar,
  secuencia               timestamptz NOT NULL DEFAULT now(),
  estado                  smallint    NOT NULL DEFAULT 0,
  agrego_usuario          uuid        NOT NULL,
  agrego_fecha            timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario        uuid        NOT NULL,
  modifico_fecha          timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_rol_usuario (
  cuenta              varchar     NOT NULL,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_serie_factura (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  serie               varchar     NOT NULL,
  gface               integer     NOT NULL DEFAULT 0,
  id_docto_gface      varchar,
  establecimiento     smallint    NOT NULL DEFAULT 0,
  dispositivo         smallint    NOT NULL DEFAULT 0,
  carpeta_dtes        varchar,
  formato             smallint    NOT NULL DEFAULT 0,
  predeterminado      smallint    NOT NULL DEFAULT 0,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_serie_recibo (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  serie               varchar     NOT NULL,
  serie_factura       varchar,
  dias_fecha          smallint    NOT NULL DEFAULT 0,
  correlativo         smallint    NOT NULL DEFAULT 0,
  formato             smallint    NOT NULL DEFAULT 0,
  predeterminado      smallint    NOT NULL DEFAULT 0,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_servicio (
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              varchar     NOT NULL,
  descripcion         varchar     NOT NULL,
  unidad_medida       varchar     NOT NULL,
  tipo_item           smallint    NOT NULL DEFAULT 0,
  activo              smallint    NOT NULL DEFAULT 0,
  usuario_agrego      uuid        NOT NULL,
  fecha_agrego        timestamptz NOT NULL DEFAULT now(),
  usuario_modifico    uuid        NOT NULL,
  fecha_modifico      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_supervisor (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  userid              uuid,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_tipo_ingreso (
  cuenta                  varchar     NOT NULL,
  empresa                 integer     NOT NULL DEFAULT 0,
  proyecto                integer     NOT NULL DEFAULT 0,
  codigo                  integer     NOT NULL DEFAULT 0,
  descripcion             varchar     NOT NULL,
  etiqueta                varchar     NOT NULL,
  facturacion_item        varchar,
  facturacion_descripcion varchar,
  forma_pago              smallint    NOT NULL DEFAULT 0,
  monto                   numeric     NOT NULL DEFAULT 0,
  hasta_monto             numeric     NOT NULL DEFAULT 0,
  mora                    smallint    NOT NULL DEFAULT 0,
  impuesto                smallint    NOT NULL DEFAULT 0,
  editable                smallint    NOT NULL DEFAULT 0,
  fijo                    smallint    NOT NULL DEFAULT 0,
  activo                  smallint    NOT NULL DEFAULT 0,
  agrego_usuario          uuid        NOT NULL,
  agrego_fecha            timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario        uuid        NOT NULL,
  modifico_fecha          timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_transaccion_bancaria (
  empresa                     integer     NOT NULL DEFAULT 0,
  cuenta_bancaria             integer     NOT NULL DEFAULT 0,
  numero_transaccion          varchar     NOT NULL,
  tipo_transaccion            smallint    NOT NULL DEFAULT 0,
  fecha                       date        NOT NULL,
  numero_documento            varchar     NOT NULL,
  partida                     varchar,
  valor                       numeric     NOT NULL DEFAULT 0,
  valor_en_letras             varchar,
  tipo_saldo                  smallint    NOT NULL DEFAULT 0,
  en_circulacion              smallint    NOT NULL DEFAULT 0,
  a_nombre_de                 varchar,
  comentario                  varchar,
  fecha_conciliacion          date,
  origen                      smallint    NOT NULL DEFAULT 0,
  tasa_cambio                 numeric     NOT NULL DEFAULT 0,
  cuenta_transferencia        integer     NOT NULL DEFAULT 0,
  transaccion_transferencia   varchar,
  estado                      smallint    NOT NULL DEFAULT 0,
  usuario_agrego              uuid        NOT NULL,
  fecha_agrego                timestamptz NOT NULL DEFAULT now(),
  usuario_modifico            uuid        NOT NULL,
  fecha_modifico              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_usuario (
  cuenta              varchar     NOT NULL,
  userid              uuid        NOT NULL,
  nombres             varchar     NOT NULL,
  apellidos           varchar     NOT NULL,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);

CREATE TABLE IF NOT EXISTS capitalsuite360.t_vendedor (
  cuenta              varchar     NOT NULL,
  empresa             integer     NOT NULL DEFAULT 0,
  proyecto            integer     NOT NULL DEFAULT 0,
  codigo              integer     NOT NULL DEFAULT 0,
  nombre              varchar     NOT NULL,
  userid              uuid,
  activo              smallint    NOT NULL DEFAULT 0,
  agrego_usuario      uuid        NOT NULL,
  agrego_fecha        timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00',
  modifico_usuario    uuid        NOT NULL,
  modifico_fecha      timestamptz NOT NULL DEFAULT '1900-01-01 00:00:00+00'
);


-- -------------------------------------------------------------
-- 3. PRIMARY KEYS
-- -------------------------------------------------------------

ALTER TABLE capitalsuite360.t_acceso_directo       ADD CONSTRAINT pk_acceso_directo       PRIMARY KEY (userid, secuencia);
ALTER TABLE capitalsuite360.t_banco                ADD CONSTRAINT t_banco_pkey            PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_cliente              ADD CONSTRAINT t_cliente_pkey          PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_cobrador             ADD CONSTRAINT t_cobrador_pkey         PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_coordinador          ADD CONSTRAINT t_coordinador_pkey      PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_cuenta               ADD CONSTRAINT t_cuenta_pkey           PRIMARY KEY (id);
ALTER TABLE capitalsuite360.t_cuenta_bancaria      ADD CONSTRAINT t_cuenta_bancaria_pkey  PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_cuenta_contable      ADD CONSTRAINT pk_cuenta_contable      PRIMARY KEY (empresa, nivel1, nivel2, nivel3, nivel4, nivel5);
ALTER TABLE capitalsuite360.t_departamento         ADD CONSTRAINT t_departamento_pkey     PRIMARY KEY (pais, codigo);
ALTER TABLE capitalsuite360.t_detalle_factura      ADD CONSTRAINT pk_detalle_factura      PRIMARY KEY (empresa, proyecto, serie, factura, secuencia);
ALTER TABLE capitalsuite360.t_detalle_recibo_caja  ADD CONSTRAINT pk_detalle_recibo_caja  PRIMARY KEY (empresa, proyecto, serie_recibo, recibo, tipo_cuota, cuota);
ALTER TABLE capitalsuite360.t_detalle_recibo_otros ADD CONSTRAINT pk_detalle_recibo_otros PRIMARY KEY (empresa, proyecto, serie_recibo, recibo, tipo_cuota, cuota, secuencia);
ALTER TABLE capitalsuite360.t_empresa              ADD CONSTRAINT t_empresa_pkey          PRIMARY KEY (cuenta, codigo);
ALTER TABLE capitalsuite360.t_empresa_usuario      ADD CONSTRAINT pk_empresa_usuario      PRIMARY KEY (userid, empresa);
ALTER TABLE capitalsuite360.t_factura              ADD CONSTRAINT pk_factura              PRIMARY KEY (empresa, proyecto, serie, factura);
ALTER TABLE capitalsuite360.t_fase                 ADD CONSTRAINT t_fase_pkey             PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_gface                ADD CONSTRAINT pk_gface                PRIMARY KEY (empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_grupo_usuario        ADD CONSTRAINT t_grupo_usuario_pkey    PRIMARY KEY (userid, grupo);
ALTER TABLE capitalsuite360.t_lote                 ADD CONSTRAINT t_lote_pkey             PRIMARY KEY (cuenta, empresa, proyecto, fase, manzana, codigo);
ALTER TABLE capitalsuite360.t_manzana              ADD CONSTRAINT t_manzana_pkey          PRIMARY KEY (cuenta, empresa, proyecto, fase, codigo);
ALTER TABLE capitalsuite360.t_menu                 ADD CONSTRAINT pk_menu                 PRIMARY KEY (indice);
ALTER TABLE capitalsuite360.t_menu_modulo          ADD CONSTRAINT t_menu_modulo_pkey      PRIMARY KEY (cuenta, codigo);
ALTER TABLE capitalsuite360.t_menu_usuario         ADD CONSTRAINT pk_menu_usuario         PRIMARY KEY (userid, indice);
ALTER TABLE capitalsuite360.t_moneda               ADD CONSTRAINT t_moneda_pkey           PRIMARY KEY (codigo);
ALTER TABLE capitalsuite360.t_municipio            ADD CONSTRAINT t_municipio_pkey        PRIMARY KEY (pais, departamento, codigo);
ALTER TABLE capitalsuite360.t_pais                 ADD CONSTRAINT t_pais_pkey             PRIMARY KEY (codigo);
ALTER TABLE capitalsuite360.t_parametros_empresa   ADD CONSTRAINT pk_parametros_empresa   PRIMARY KEY (empresa);
ALTER TABLE capitalsuite360.t_parametros_promesa   ADD CONSTRAINT pk_parametros_promesa   PRIMARY KEY (empresa, proyecto, promesa, version);
ALTER TABLE capitalsuite360.t_plan_otros           ADD CONSTRAINT pk_plan_otros           PRIMARY KEY (empresa, proyecto, promesa, tipo_cuota, cuota, secuencia);
ALTER TABLE capitalsuite360.t_plan_pago            ADD CONSTRAINT pk_plan_pago            PRIMARY KEY (empresa, proyecto, promesa, tipo_cuota, cuota);
ALTER TABLE capitalsuite360.t_promesa              ADD CONSTRAINT pk_promesa              PRIMARY KEY (empresa, proyecto, numero);
ALTER TABLE capitalsuite360.t_promesa_otros        ADD CONSTRAINT pk_promesa_otros        PRIMARY KEY (empresa, proyecto, promesa, secuencia);
ALTER TABLE capitalsuite360.t_proyecto             ADD CONSTRAINT t_proyecto_pkey         PRIMARY KEY (cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_proyecto_moneda      ADD CONSTRAINT t_proyecto_moneda_pkey  PRIMARY KEY (cuenta, empresa, proyecto, moneda);
ALTER TABLE capitalsuite360.t_recibo_caja          ADD CONSTRAINT t_recibo_caja_pkey      PRIMARY KEY (cuenta, empresa, proyecto, serie, numero);
ALTER TABLE capitalsuite360.t_rol_usuario          ADD CONSTRAINT t_rol_usuario_pkey      PRIMARY KEY (cuenta, codigo);
ALTER TABLE capitalsuite360.t_serie_factura        ADD CONSTRAINT t_serie_factura_pkey    PRIMARY KEY (cuenta, empresa, proyecto, serie);
ALTER TABLE capitalsuite360.t_serie_recibo         ADD CONSTRAINT t_serie_recibo_pkey     PRIMARY KEY (cuenta, empresa, proyecto, serie);
ALTER TABLE capitalsuite360.t_servicio             ADD CONSTRAINT pk_servicio             PRIMARY KEY (empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_supervisor           ADD CONSTRAINT t_supervisor_pkey       PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_tipo_ingreso         ADD CONSTRAINT t_tipo_ingreso_pkey     PRIMARY KEY (cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_transaccion_bancaria ADD CONSTRAINT pk_transaccion_bancaria PRIMARY KEY (empresa, cuenta_bancaria, numero_transaccion);
ALTER TABLE capitalsuite360.t_usuario              ADD CONSTRAINT t_usuario_pkey          PRIMARY KEY (cuenta, userid);
ALTER TABLE capitalsuite360.t_vendedor             ADD CONSTRAINT t_vendedor_pkey         PRIMARY KEY (cuenta, empresa, proyecto, codigo);


-- -------------------------------------------------------------
-- 4. FOREIGN KEYS
-- -------------------------------------------------------------

ALTER TABLE capitalsuite360.t_acceso_directo        ADD CONSTRAINT t_acceso_directo_userid_fkey                         FOREIGN KEY (userid)                                                  REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_banco                 ADD CONSTRAINT t_banco_cuenta_empresa_proyecto_fkey                 FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_cliente               ADD CONSTRAINT t_cliente_cuenta_empresa_proyecto_fkey               FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_cliente               ADD CONSTRAINT t_cliente_direccion_pais_departamento_municipio_fkey FOREIGN KEY (direccion_pais, direccion_departamento, direccion_municipio) REFERENCES capitalsuite360.t_municipio(pais, departamento, codigo);
ALTER TABLE capitalsuite360.t_cobrador              ADD CONSTRAINT t_cobrador_cuenta_empresa_proyecto_fkey              FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_coordinador           ADD CONSTRAINT t_coordinador_cuenta_empresa_proyecto_fkey           FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_cuenta_bancaria       ADD CONSTRAINT t_cuenta_bancaria_cuenta_empresa_proyecto_fkey       FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_cuenta_bancaria       ADD CONSTRAINT t_cuenta_bancaria_banco_fkey                         FOREIGN KEY (cuenta, empresa, proyecto, banco)                        REFERENCES capitalsuite360.t_banco(cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_cuenta_bancaria       ADD CONSTRAINT t_cuenta_bancaria_moneda_fkey                        FOREIGN KEY (moneda)                                                  REFERENCES capitalsuite360.t_moneda(codigo);
ALTER TABLE capitalsuite360.t_departamento          ADD CONSTRAINT t_departamento_pais_fkey                             FOREIGN KEY (pais)                                                    REFERENCES capitalsuite360.t_pais(codigo);
ALTER TABLE capitalsuite360.t_detalle_factura       ADD CONSTRAINT fk_det_factura                                       FOREIGN KEY (empresa, proyecto, serie, factura)                       REFERENCES capitalsuite360.t_factura(empresa, proyecto, serie, factura);
ALTER TABLE capitalsuite360.t_empresa               ADD CONSTRAINT t_empresa_cuenta_fkey                                FOREIGN KEY (cuenta)                                                  REFERENCES capitalsuite360.t_cuenta(id);
ALTER TABLE capitalsuite360.t_empresa_usuario       ADD CONSTRAINT t_empresa_usuario_userid_fkey                        FOREIGN KEY (userid)                                                  REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_factura               ADD CONSTRAINT t_factura_usuario_agrego_fkey                        FOREIGN KEY (usuario_agrego)                                          REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_factura               ADD CONSTRAINT t_factura_usuario_modifico_fkey                      FOREIGN KEY (usuario_modifico)                                        REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_fase                  ADD CONSTRAINT t_fase_cuenta_empresa_proyecto_fkey                  FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_gface                 ADD CONSTRAINT t_gface_usuario_agrego_fkey                          FOREIGN KEY (usuario_agrego)                                          REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_gface                 ADD CONSTRAINT t_gface_usuario_modifico_fkey                        FOREIGN KEY (usuario_modifico)                                        REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_lote                  ADD CONSTRAINT t_lote_cuenta_empresa_proyecto_fase_manzana_fkey     FOREIGN KEY (cuenta, empresa, proyecto, fase, manzana)                REFERENCES capitalsuite360.t_manzana(cuenta, empresa, proyecto, fase, codigo);
ALTER TABLE capitalsuite360.t_lote                  ADD CONSTRAINT t_lote_moneda_fkey                                   FOREIGN KEY (moneda)                                                  REFERENCES capitalsuite360.t_moneda(codigo);
ALTER TABLE capitalsuite360.t_manzana               ADD CONSTRAINT t_manzana_cuenta_empresa_proyecto_fase_fkey          FOREIGN KEY (cuenta, empresa, proyecto, fase)                         REFERENCES capitalsuite360.t_fase(cuenta, empresa, proyecto, codigo);
ALTER TABLE capitalsuite360.t_menu_usuario          ADD CONSTRAINT fk_menu_usuario_menu                                 FOREIGN KEY (indice)                                                  REFERENCES capitalsuite360.t_menu(indice);
ALTER TABLE capitalsuite360.t_menu_usuario          ADD CONSTRAINT t_menu_usuario_userid_fkey                           FOREIGN KEY (userid)                                                  REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_municipio             ADD CONSTRAINT t_municipio_pais_departamento_fkey                   FOREIGN KEY (pais, departamento)                                      REFERENCES capitalsuite360.t_departamento(pais, codigo);
ALTER TABLE capitalsuite360.t_parametros_promesa    ADD CONSTRAINT fk_params_promesa                                    FOREIGN KEY (empresa, proyecto, promesa)                               REFERENCES capitalsuite360.t_promesa(empresa, proyecto, numero);
ALTER TABLE capitalsuite360.t_parametros_promesa    ADD CONSTRAINT t_parametros_promesa_usuario_agrego_fkey             FOREIGN KEY (usuario_agrego)                                          REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_plan_otros            ADD CONSTRAINT fk_plan_otros_promesa                                FOREIGN KEY (empresa, proyecto, promesa)                               REFERENCES capitalsuite360.t_promesa(empresa, proyecto, numero);
ALTER TABLE capitalsuite360.t_plan_pago             ADD CONSTRAINT fk_plan_pago_promesa                                 FOREIGN KEY (empresa, proyecto, promesa)                               REFERENCES capitalsuite360.t_promesa(empresa, proyecto, numero);
ALTER TABLE capitalsuite360.t_promesa               ADD CONSTRAINT t_promesa_usuario_agrego_fkey                        FOREIGN KEY (usuario_agrego)                                          REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_promesa               ADD CONSTRAINT t_promesa_usuario_modifico_fkey                      FOREIGN KEY (usuario_modifico)                                        REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_promesa_otros         ADD CONSTRAINT fk_promesa_otros                                     FOREIGN KEY (empresa, proyecto, promesa)                               REFERENCES capitalsuite360.t_promesa(empresa, proyecto, numero);
ALTER TABLE capitalsuite360.t_proyecto              ADD CONSTRAINT t_proyecto_cuenta_empresa_fkey                       FOREIGN KEY (cuenta, empresa)                                         REFERENCES capitalsuite360.t_empresa(cuenta, codigo);
ALTER TABLE capitalsuite360.t_proyecto_moneda       ADD CONSTRAINT t_proyecto_moneda_cuenta_empresa_proyecto_fkey       FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_proyecto_moneda       ADD CONSTRAINT t_proyecto_moneda_moneda_fkey                        FOREIGN KEY (moneda)                                                  REFERENCES capitalsuite360.t_moneda(codigo);
ALTER TABLE capitalsuite360.t_recibo_caja           ADD CONSTRAINT t_recibo_caja_serie_fkey                             FOREIGN KEY (cuenta, empresa, proyecto, serie)                        REFERENCES capitalsuite360.t_serie_recibo(cuenta, empresa, proyecto, serie);
ALTER TABLE capitalsuite360.t_recibo_caja           ADD CONSTRAINT t_recibo_caja_moneda_fkey                            FOREIGN KEY (moneda)                                                  REFERENCES capitalsuite360.t_moneda(codigo);
ALTER TABLE capitalsuite360.t_rol_usuario           ADD CONSTRAINT t_rol_usuario_cuenta_fkey                            FOREIGN KEY (cuenta)                                                  REFERENCES capitalsuite360.t_cuenta(id);
ALTER TABLE capitalsuite360.t_serie_factura         ADD CONSTRAINT t_serie_factura_cuenta_empresa_proyecto_fkey         FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_serie_recibo          ADD CONSTRAINT t_serie_recibo_cuenta_empresa_proyecto_fkey          FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_servicio              ADD CONSTRAINT t_servicio_usuario_agrego_fkey                       FOREIGN KEY (usuario_agrego)                                          REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_servicio              ADD CONSTRAINT t_servicio_usuario_modifico_fkey                     FOREIGN KEY (usuario_modifico)                                        REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_supervisor            ADD CONSTRAINT t_supervisor_cuenta_empresa_proyecto_fkey            FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_tipo_ingreso          ADD CONSTRAINT t_tipo_ingreso_cuenta_empresa_proyecto_fkey          FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);
ALTER TABLE capitalsuite360.t_transaccion_bancaria  ADD CONSTRAINT t_transaccion_bancaria_usuario_agrego_fkey           FOREIGN KEY (usuario_agrego)                                          REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_transaccion_bancaria  ADD CONSTRAINT t_transaccion_bancaria_usuario_modifico_fkey         FOREIGN KEY (usuario_modifico)                                        REFERENCES auth.users(id);
ALTER TABLE capitalsuite360.t_usuario               ADD CONSTRAINT t_usuario_cuenta_fkey                                FOREIGN KEY (cuenta)                                                  REFERENCES capitalsuite360.t_cuenta(id);
ALTER TABLE capitalsuite360.t_vendedor              ADD CONSTRAINT t_vendedor_cuenta_empresa_proyecto_fkey              FOREIGN KEY (cuenta, empresa, proyecto)                               REFERENCES capitalsuite360.t_proyecto(cuenta, empresa, codigo);


-- -------------------------------------------------------------
-- 5. FUNCIONES
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION capitalsuite360.fn_genera_cuentaid()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  RETURN (
    SELECT string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random()*36 + 1)::int, 1), '')
    FROM generate_series(1, 12)
  );
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_banco()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_banco
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_cliente
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_cobrador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_cobrador
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_coordinador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_coordinador
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_empresa
  WHERE cuenta = new.cuenta;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_fase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_fase
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_menu_modulo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  -- NOTA: función original tenía bug con doble esquema "capitalsuite360.capitalsuite360.t_menu_modulo"
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_menu_modulo
  WHERE cuenta = new.cuenta;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_proyecto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_proyecto
  WHERE cuenta = new.cuenta AND empresa = new.empresa;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_recibo_caja()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_recibo_caja
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto AND serie = new.serie;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_rol_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_rol_usuario
  WHERE cuenta = new.cuenta;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_supervisor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_supervisor
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_tipo_ingreso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_tipo_ingreso
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;

CREATE OR REPLACE FUNCTION capitalsuite360.fn_correlativo_vendedor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog, capitalsuite360'
AS $$
BEGIN
  SELECT coalesce(max(codigo), 0) + 1 AS correlativo
  FROM capitalsuite360.t_vendedor
  WHERE cuenta = new.cuenta AND empresa = new.empresa AND proyecto = new.proyecto;
END;
$$;


-- -------------------------------------------------------------
-- 6. TRIGGERS
-- -------------------------------------------------------------

CREATE TRIGGER tg_correlativo_banco
  BEFORE INSERT ON capitalsuite360.t_banco
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_banco();

CREATE TRIGGER tg_correlativo_cliente
  BEFORE INSERT ON capitalsuite360.t_cliente
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_cliente();

CREATE TRIGGER tg_correlativo_cobrador
  BEFORE INSERT ON capitalsuite360.t_cobrador
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_cobrador();

CREATE TRIGGER tg_correlativo_coordinador
  BEFORE INSERT ON capitalsuite360.t_coordinador
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_coordinador();

CREATE TRIGGER tg_correlativo_empresa
  BEFORE INSERT ON capitalsuite360.t_empresa
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_empresa();

CREATE TRIGGER tg_correlativo_fase
  BEFORE INSERT ON capitalsuite360.t_fase
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_fase();

CREATE TRIGGER tg_correlativo_menu_modulo
  BEFORE INSERT ON capitalsuite360.t_menu_modulo
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_menu_modulo();

CREATE TRIGGER tg_correlativo_proyecto
  BEFORE INSERT ON capitalsuite360.t_proyecto
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_proyecto();

CREATE TRIGGER tg_correlativo_recibo_caja
  BEFORE INSERT ON capitalsuite360.t_recibo_caja
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_recibo_caja();

CREATE TRIGGER tg_correlativo_rol_usuario
  BEFORE INSERT ON capitalsuite360.t_rol_usuario
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_rol_usuario();

CREATE TRIGGER tg_correlativo_supervisor
  BEFORE INSERT ON capitalsuite360.t_supervisor
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_supervisor();

CREATE TRIGGER tg_correlativo_tipo_ingreso
  BEFORE INSERT ON capitalsuite360.t_tipo_ingreso
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_tipo_ingreso();

CREATE TRIGGER tg_correlativo_vendedor
  BEFORE INSERT ON capitalsuite360.t_vendedor
  FOR EACH ROW EXECUTE FUNCTION capitalsuite360.fn_correlativo_vendedor();


-- =============================================================
-- FIN DEL BACKUP
-- =============================================================
