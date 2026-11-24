<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Cartera — Protocolo de trabajo

Stack, seguridad y definición de terminado: `.cursor/rules/cartera-core.mdc`. Arquitectura: `ARCHITECTURE.md`.

## Catálogo

Si el pedido es una pantalla de catálogo (lista, modal, alta, cambio, baja, o un spec `prompts/crud-*.md`), lee y ejecuta `.cursor/skills/crud-screen/SKILL.md` antes de escribir. También se invoca como `/crud-screen`. La referencia de layout es Clientes. La grilla sale de una sola lectura de `cartera.v_*_lista`. Pagos, depósitos, promesas, transacciones y KPIs no usan ese skill.

Después de construir o actualizar la pantalla, no edites el spec para dejarlo igual al código. No devuelvas `MODO` a `nuevo` ni vacíes `CAMBIOS_PENDIENTES`.

## Cuándo preguntar

- La pantalla ya existe y el spec dice `MODO = nuevo`.
- El paso destruiría datos, haría force-push o merge a `main`.
- El pedido contradice una regla de seguridad.

El resto de la tarea sigue sin pedir permiso.
