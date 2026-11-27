-- Renombra la pantalla TSC.CAT en el submenu.
-- Ejecutar en el SQL Editor de Supabase.

UPDATE cartera.t_menu
SET nombre = 'Tipo Cambio'
WHERE indice = 'TSC.CAT';
