-- =============================================================================
-- Ejecutar en el SQL Editor ANTES de publicar el CRUD con el cliente del usuario.
--
-- fn_cuenta_del_usuario ya es ejecutable por authenticated. Con eso, la API
-- REST deja leer los catálogos de la cuenta. Este script no abre la escritura
-- a cualquier miembro: INSERT, UPDATE y DELETE exigen el flag del menú, y
-- authenticated no puede leer token ni certificado_contrasena de t_gface.
-- t_menu_usuario, t_usuario y t_usuario_proyecto no se pueden modificar
-- con el token de la sesión.
-- =============================================================================

CREATE OR REPLACE FUNCTION cartera.fn_puede(p_indice varchar, p_operacion text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = cartera, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM cartera.t_usuario
      WHERE cuenta = cartera.fn_cuenta_del_usuario()
        AND userid = auth.uid()
        AND es_admin = 1
    )
    OR EXISTS (
      SELECT 1
      FROM cartera.t_menu_usuario
      WHERE cuenta = cartera.fn_cuenta_del_usuario()
        AND userid = auth.uid()
        AND indice = p_indice
        AND CASE p_operacion
          WHEN 'consultar' THEN consultar = 1
          WHEN 'agregar' THEN agregar = 1
          WHEN 'modificar' THEN modificar = 1
          WHEN 'eliminar' THEN eliminar = 1
          ELSE false
        END
    );
$$;

REVOKE ALL ON FUNCTION cartera.fn_puede(varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cartera.fn_puede(varchar, text) TO authenticated;

CREATE OR REPLACE FUNCTION cartera.fn_gface_configurado()
RETURNS TABLE (
  empresa integer,
  proyecto integer,
  codigo integer,
  token_configurado boolean,
  certificado_configurado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = cartera, pg_temp
AS $$
  SELECT
    g.empresa,
    g.proyecto,
    g.codigo,
    g.token IS NOT NULL AND btrim(g.token) <> '',
    g.certificado_contrasena IS NOT NULL AND btrim(g.certificado_contrasena) <> ''
  FROM cartera.t_gface AS g
  WHERE g.cuenta = cartera.fn_cuenta_del_usuario()
    AND cartera.fn_puede('GFA.CAT', 'consultar');
$$;

REVOKE ALL ON FUNCTION cartera.fn_gface_configurado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cartera.fn_gface_configurado() TO authenticated;

DO $$
DECLARE
  pares text[][] := ARRAY[
    ARRAY['t_banco', 'BAN.CAT'],
    ARRAY['t_cliente', 'CLI.CAT'],
    ARRAY['t_cobrador', 'COB.CAT'],
    ARRAY['t_coordinador', 'COO.CAT'],
    ARRAY['t_cuenta_bancaria', 'CUE.BAN'],
    ARRAY['t_detalle_recibo_caja', 'PAG.MAN'],
    ARRAY['t_detalle_recibo_otros', 'PAG.MAN'],
    ARRAY['t_empresa', 'EMP.CAT'],
    ARRAY['t_fase', 'FAS.CAT'],
    ARRAY['t_gface', 'GFA.CAT'],
    ARRAY['t_lote', 'LOT.CAT'],
    ARRAY['t_manzana', 'MAN.CAT'],
    ARRAY['t_moneda_tasa_cambio', 'TSC.CAT'],
    ARRAY['t_plan_otros', 'PRE.OPE'],
    ARRAY['t_plan_pago', 'PRE.OPE'],
    ARRAY['t_promesa', 'PRE.OPE'],
    ARRAY['t_promesa_documentos', 'PRE.OPE'],
    ARRAY['t_promesa_otros', 'PRE.OPE'],
    ARRAY['t_promesa_parametros', 'PRE.OPE'],
    ARRAY['t_proyecto', 'PRO.CAT'],
    ARRAY['t_proyecto_moneda', 'PRO.CAT'],
    ARRAY['t_recibo_caja', 'PAG.MAN'],
    ARRAY['t_reserva', 'RES.OPE'],
    ARRAY['t_serie_factura', 'SER.FAC'],
    ARRAY['t_serie_recibo', 'SER.REC'],
    ARRAY['t_supervisor', 'SUP.CAT'],
    ARRAY['t_tipo_documento', 'TDO.CAT'],
    ARRAY['t_tipo_ingreso', 'TIN.CAT'],
    ARRAY['t_transaccion_bancaria', 'TRX.BAN'],
    ARRAY['t_vendedor', 'VEN.CAT']
  ];
  i integer;
  tabla text;
  indice text;
  nombre text;
  nombres text[];
BEGIN
  FOR i IN 1 .. array_length(pares, 1) LOOP
    tabla := pares[i][1];
    indice := pares[i][2];

    SELECT array_agg(p.polname)
      INTO nombres
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'cartera'
      AND c.relname = tabla
      AND p.polcmd IN ('r', 'a', 'w', 'd', '*');

    IF nombres IS NOT NULL THEN
      FOREACH nombre IN ARRAY nombres LOOP
        EXECUTE format('DROP POLICY %I ON cartera.%I', nombre, tabla);
      END LOOP;
    END IF;

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cartera.%I TO authenticated', tabla);
    EXECUTE format('DROP POLICY IF EXISTS %I ON cartera.%I', tabla || '_cuenta_select', tabla);
    EXECUTE format(
      'CREATE POLICY %I ON cartera.%I FOR SELECT TO authenticated USING (cuenta = cartera.fn_cuenta_del_usuario())',
      tabla || '_cuenta_select', tabla
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON cartera.%I',
      tabla || '_menu_insert', tabla
    );
    EXECUTE format(
      'CREATE POLICY %I ON cartera.%I FOR INSERT TO authenticated WITH CHECK (cuenta = cartera.fn_cuenta_del_usuario() AND cartera.fn_puede(%L, ''agregar''))',
      tabla || '_menu_insert', tabla, indice
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON cartera.%I',
      tabla || '_menu_update', tabla
    );
    EXECUTE format(
      'CREATE POLICY %I ON cartera.%I FOR UPDATE TO authenticated USING (cuenta = cartera.fn_cuenta_del_usuario() AND cartera.fn_puede(%L, ''modificar'')) WITH CHECK (cuenta = cartera.fn_cuenta_del_usuario() AND cartera.fn_puede(%L, ''modificar''))',
      tabla || '_menu_update', tabla, indice, indice
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON cartera.%I',
      tabla || '_menu_delete', tabla
    );
    EXECUTE format(
      'CREATE POLICY %I ON cartera.%I FOR DELETE TO authenticated USING (cuenta = cartera.fn_cuenta_del_usuario() AND cartera.fn_puede(%L, ''eliminar''))',
      tabla || '_menu_delete', tabla, indice
    );
  END LOOP;
END $$;

REVOKE SELECT (token, certificado_contrasena) ON TABLE cartera.t_gface FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE cartera.t_usuario FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE cartera.t_usuario_proyecto FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE cartera.t_menu_usuario FROM authenticated;
REVOKE ALL ON TABLE cartera.t_audit_log FROM authenticated;
REVOKE ALL ON TABLE cartera.t_login_attempt FROM authenticated;

DROP POLICY IF EXISTS t_menu_usuario_propio ON cartera.t_menu_usuario;
CREATE POLICY t_menu_usuario_propio ON cartera.t_menu_usuario
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    userid = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM cartera.t_usuario AS u
      WHERE u.cuenta = cartera.fn_cuenta_del_usuario()
        AND u.userid = auth.uid()
        AND u.es_admin = 1
    )
  );
