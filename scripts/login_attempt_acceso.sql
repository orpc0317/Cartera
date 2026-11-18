-- =============================================================================
-- Acceso de service_role a cartera.t_login_attempt
-- Ejecutar en el SQL Editor de Supabase antes de desplegar el bloqueo de login.
--
-- La base actual responde "permission denied for table t_login_attempt"
-- al rol service_role. Sin este GRANT el login no registra intentos y el
-- conteo por correo o por IP no bloquea.
-- No concede privilegios a anon, authenticated ni PUBLIC.
-- =============================================================================

REVOKE ALL ON TABLE cartera.t_login_attempt FROM PUBLIC;
REVOKE ALL ON TABLE cartera.t_login_attempt FROM anon;
REVOKE ALL ON TABLE cartera.t_login_attempt FROM authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE cartera.t_login_attempt TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cartera.t_login_attempt_id_seq TO service_role;

CREATE INDEX IF NOT EXISTS idx_login_attempt_email_fecha
  ON cartera.t_login_attempt (email, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempt_ip_fecha
  ON cartera.t_login_attempt (ip, fecha DESC);
