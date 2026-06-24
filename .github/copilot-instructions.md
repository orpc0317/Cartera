# Cartera — Instrucciones globales para GitHub Copilot

@file:../ARCHITECTURE.md

Actúa como un desarrollador senior experto en Next.js, TypeScript, Supabase y Tailwind CSS.

Tu código debe cumplir estrictamente con las mejores prácticas de ingeniería de software.

---

## Stack tecnológico

- **Framework:** Next.js (App Router) — lee `node_modules/next/dist/docs/` antes de escribir código; las APIs pueden diferir de tu conocimiento previo.
- **Lenguaje:** TypeScript estricto.
- **Base de datos:** Supabase (PostgreSQL), schema `cartera`. Todas las queries deben usar el cliente de Supabase con RLS; nunca construir SQL concatenando strings.
- **UI:** Tailwind CSS + shadcn/ui + Lucide React.
- **Auth:** Supabase Auth. Toda acción de servidor debe verificar el usuario activo antes de operar.

---

## 1. Ciberseguridad

- Aplica OWASP Top 10 en todo momento.
- **SQL Injection:** usar siempre el cliente Supabase con queries parametrizadas. Nunca interpolar valores de usuario en strings SQL.
- **XSS:** no usar `dangerouslySetInnerHTML`. Dejar que React escape los valores por defecto.
- **CSRF:** las Server Actions de Next.js incluyen protección CSRF nativa; no bypassearla.
- **Auth & autorización:** toda Server Action debe obtener el usuario con `supabase.auth.getUser()` (nunca `getSession()` en el servidor) y verificar permisos antes de mutar datos.
- **Secretos:** nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni ninguna variable de entorno privada al cliente. Las variables públicas usan prefijo `NEXT_PUBLIC_`.
- **Cuenta activa:** toda query debe filtrar por `cuenta`, obtenida **siempre** importando `getCuentaActiva()` desde `@/app/actions/permisos`. Esa función lee la cookie `cartera-cuenta` primero y el JWT `app_metadata.cuenta_activa` como fallback. **Nunca** leer `user.app_metadata.cuenta_activa` directamente en un action file. Si `cuenta` está vacía, no operar.
- **IDOR / permisos en escritura:** toda Server Action de escritura (`create*`, `update*`, `delete*`, `upload*`) debe llamar `requirePermiso(PERMISOS.<KEY>, 'agregar'|'modificar'|'eliminar')` importado de `@/app/actions/permisos` como **primera instrucción**. `requirePermiso` verifica autenticación, membresía de cuenta en `t_usuario` (previene cookie-tampering cross-tenant) y el flag CRUD específico en `t_menu_usuario`. Si retorna `{ error }`, propagar inmediatamente.
- **Mínimo privilegio:** usar el cliente de usuario para reads/writes normales; el cliente admin (`admin.ts`) solo cuando sea estrictamente necesario y documentado.

---

## 2. Performance y optimización

- **Server vs Client:** preferir Server Components. Marcar con `"use client"` solo los componentes que requieran estado, efectos o eventos del navegador.
- **Data fetching:** en `page.tsx` usar `Promise.all` con `.catch()` por llamada (nunca un `try/catch` global). Ver `server-actions.instructions.md`.
- **Queries:** seleccionar solo las columnas necesarias (`.select('col1, col2')`), no `select('*')` salvo justificación.
- **Revalidación:** usar `router.refresh()` después de mutaciones (patrón establecido del proyecto).
- **Lazy loading:** preferir imports dinámicos para componentes pesados que no son necesarios en el render inicial.
- **Evitar re-renders:** no crear objetos/funciones inline dentro del JSX de listas grandes; usar `useCallback`/`useMemo` cuando el profiler lo justifique, no de forma preventiva.

---

## 3. Calidad del código

- **Principios:** SOLID, DRY y KISS — pero sin over-engineering. No crear abstracciones para operaciones que solo ocurren una vez.
- **Convenciones del proyecto:**
  - Estructura de archivos: `page.tsx` (Server Component) + `_client.tsx` (Client Component).
  - Acciones en `src/app/actions/<entidad>.ts`.
  - Tipos en `src/lib/types/`.
  - Constantes de permisos en `src/lib/permisos.ts`.
- **Nombrado:** variables y funciones en camelCase en inglés; labels y mensajes de UI en español (idioma del negocio).
- **No agregar** comentarios, docstrings ni tipos a código que no fue modificado.
- **No agregar** manejo de errores para escenarios imposibles. Validar solo en los límites del sistema (entradas de usuario y respuestas de red).
- **No refactorizar** código existente que no fue solicitado.
- **Revisión post-edición obligatoria:** después de crear o modificar cualquier archivo TypeScript/TSX, usar `get_errors` sobre ese archivo para detectar errores de compilación (comas faltantes, tipos incorrectos, imports rotos, etc.) y corregirlos antes de dar la tarea por terminada. **Esto incluye ediciones parcialmente fallidas:** si `replace_string_in_file` o `multi_replace_string_in_file` reportan que algún reemplazo falló, el archivo puede haber quedado en estado corrupto — ejecutar `get_errors` de inmediato antes de continuar.
- **`get_errors` puede devolver resultados obsoletos** si el language server de VS Code aún no re-analizó el archivo tras la escritura (funciona de forma asíncrona). Para errores **sintácticos** (comas dobles, llaves desbalanceadas, tokens inesperados), `get_errors` puede no ser suficiente. Si la edición fue estructuralmente compleja y hay indicios de error no detectado, ejecutar en terminal: `npx tsc --noEmit 2>&1 | Select-String "error TS"` para confirmar.
- **Comentarios JSX:** siempre usar la forma completa `{/* texto */}` con el `}` de cierre. La forma `{/* texto */` sin `}` deja un bloque de expresión abierto y produce el error de parsing `Expected '</', got '{'`. Tras crear o modificar cualquier `_client.tsx`, verificar con: `Select-String -Pattern '\{/\*[^}]*\*/\s*$' -Path <archivo>` — si retorna resultados, corregir antes de continuar.
- **Regla de contexto en reemplazos de object literals:** al eliminar una propiedad de un object literal (`key: value,`), el `oldString` DEBE incluir al menos una línea **después** de la propiedad eliminada (la línea siguiente del objeto) para garantizar que la coma de separación quede correcta y no se genere coma doble.

### ✅ Checklist obligatorio antes de dar cualquier tarea por terminada

Recorrer esta lista mentalmente en cada cierre de tarea — sin excepción:

1. **`get_errors`** sobre todo archivo TS/TSX creado o modificado.
2. **`npx tsc --noEmit`** solo si `get_errors` pasa limpio pero la edición fue estructuralmente compleja y hay indicios de problema.
3. **Comentarios JSX cerrados** — verificar que no exista `{/* texto */` sin `}` de cierre.

---

## 4. Instrucciones de arquitectura específicas del proyecto

### REGLA OBLIGATORIA — Sin excepción

**Antes de escribir cualquier `_client.tsx` (nuevo o modificado), cargar y leer `components.instructions.md` completo.**
No usar ningún patrón de UI — ningún input, select, checkbox, modal, tabla, toolbar, ni campo especial — que no esté documentado en ese archivo.
Si hay un campo que no coincide con ningún § de `components.instructions.md`, detener y preguntar antes de inventar.

### Archivos de instrucciones — cuándo cargar cada uno

| Archivo | Cargar cuando… |
|---------|----------------|
| `components.instructions.md` | **SIEMPRE** — toda `_client.tsx`, sin excepción. Fuente única de verdad para todos los snippets de UI (§§ A–AG, excepto W/X/AA/AB). |
| `base-ui-gotchas.instructions.md` | **SIEMPRE** junto con `components.instructions.md`. Diferencias críticas Base UI vs Radix: `SelectValue` render prop, `SelectTrigger w-full`, `AlertDialogDescription render={<div />}`, `DropdownMenuTrigger`. |
| `crud-screens.instructions.md` | Toda pantalla CRUD — modal layout, icon badge, ViewField, SectionDivider, PhoneField pattern, geo pre-selection. |
| `server-actions.instructions.md` | Todo `page.tsx` y todo `actions/*.ts` — patrón `getCuentaActiva`, `Promise.all` con `.catch()` por llamada, concurrencia optimista con `modifico_fecha`. |
| `ui-conventions.instructions.md` | Toda `_client.tsx` — color de acento del módulo, iconos Lucide, reglas de labels, formatos numéricos, COUNTRY_CURRENCY_MAP. |
| `data-tables.instructions.md` | Toda pantalla con tabla — columnas, ColumnFilter, ColumnManager, keyboard nav. |
| `business-context.instructions.md` | Toda pantalla nueva — jerarquía cuenta→empresa→proyecto, modelo SaaS, reglas de negocio. |
| `image-upload.instructions.md` | Solo cuando la pantalla incluya un campo de tipo imagen (`logo_url` u otro) — magic bytes, SVG risk, cleanup, patrón `LogoUploadField` (§ AC). |
| `advanced-components.instructions.md` | Solo cuando la pantalla tenga campo `moneda` (§W), cascada geográfica pais/depto/municipio (§X), `CountrySelect` (§AA), o `ClienteCombobox` (§AB). |

