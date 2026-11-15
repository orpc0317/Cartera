-- =============================================================================
-- Ejecutar en el SQL Editor ANTES de desplegar el CRUD con el cliente del usuario.
--
-- Las políticas de cartera llaman fn_cuenta_del_usuario(). Hoy el rol
-- authenticated recibe "permission denied for function fn_cuenta_del_usuario"
-- y las tablas del negocio responden 42501. service_role sigue pudiendo
-- ejecutarla. Este script no cambia el cuerpo de la función.
-- =============================================================================

REVOKE ALL ON FUNCTION cartera.fn_cuenta_del_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cartera.fn_cuenta_del_usuario() TO authenticated;

ALTER FUNCTION cartera.fn_cuenta_del_usuario() SET search_path = cartera, pg_temp;
