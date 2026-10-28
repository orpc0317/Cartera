<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Cartera — Protocolo de trabajo

Actúa como un desarrollador senior en Next.js, TypeScript, Supabase y Tailwind CSS. Stack, seguridad y definición de terminado: `.cursor/rules/cartera-core.mdc` (siempre activa). Arquitectura de la aplicación: `ARCHITECTURE.md`.

## Secuencia

1. Lee este protocolo, el skill `.cursor/skills/crud-screen/SKILL.md` cuando el pedido sea una pantalla CRUD, y las reglas del área (`.cursor/rules/`) antes de escribir.
2. Si el pedido es un CRUD de catálogo nuevo, lee primero la referencia Clientes y sigue esa estructura. Tabla, campos, ruta, permiso y relaciones salen del pedido o de un spec nuevo (`prompts/crud-*.md`).
3. Implementa. En el formulario, un campo inválido al grabar sigue `.cursor/rules/crud-screens.mdc` § Campo con error al grabar: toast, pestaña de ese campo, marca y foco.
4. Si el pedido es un CRUD de catálogo nuevo, crea `test/definidas/<entidad>.spec.ts` con el plano del paso 10 de `.cursor/skills/crud-screen/SKILL.md`. Los textos salen de la pantalla. Pagos, depósitos, promesas, transacciones y KPIs no entran en esa batería.
5. Valida con la definición de terminado. Solo entonces marca la tarea terminada.

## Referencia Clientes

Antes de un CRUD de catálogo nuevo, lectura obligatoria:

- `src/app/dashboard/promesas/clientes/page.tsx`
- `src/app/dashboard/promesas/clientes/_client.tsx`
- `src/app/actions/clientes.ts`
- El tipo `Cliente` / `ClienteForm` en `src/lib/types/proyectos.ts`

Ese tipo vive en `proyectos.ts`. No moverlo.

La referencia cubre pantallas de catálogo: lista, modal, alta, cambio y baja. Quedan fuera los flujos de pagos, depósitos, promesas y KPIs.

Si el pedido trae un widget que Clientes no tiene (imagen, geo, moneda, combobox), usa el snippet de la regla correspondiente y el componente de `src/components/ui`. El layout de la pantalla sigue siendo el de Clientes.

- Imagen: `.cursor/rules/image-upload.mdc`
- Geo, moneda o combobox: `.cursor/rules/advanced-components.mdc`

## Specs

Un spec `prompts/crud-*.md` sirve como pedido de una pantalla nueva. Si se usa, un token de campo desconocido detiene el trabajo (`.cursor/rules/spec-field-tokens.mdc`).

Después de construir o actualizar la pantalla, no edites el spec para dejarlo igual al código. No devuelvas `MODO` a `nuevo` ni vacíes `CAMBIOS_PENDIENTES`.

`.cursor/rules/components.mdc` y la lista de tokens son apoyo para casos que la referencia no muestra, y para las trampas de Base UI, seguridad y auditoría. No son el layout que se copia.

## Cuándo preguntar

- La pantalla ya existe y el spec dice `MODO = nuevo` (sobrescribir o pasar a actualizar).
- El paso destruiría datos, haría force-push o merge a `main`.
- El pedido contradice una regla de seguridad.

El resto de ediciones y comandos de la tarea sigue sin pedir permiso.
