# Cartera — Instrucciones globales para GitHub Copilot

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
- **Cuenta activa:** toda query debe filtrar por `cuenta` (obtenida de `user.app_metadata.cuenta_activa`). Si `cuenta` está vacía, no operar.
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

---

## 4. Instrucciones de arquitectura específicas del proyecto

- Leer los archivos de instrucciones en `.github/instructions/` antes de generar código:
  - `business-context.instructions.md` — quién es el cliente, jerarquía cuenta→empresa→proyecto→fase→manzana→lote, modelo SaaS, reglas de negocio críticas.
  - `crud-screens.instructions.md` — layout de modales, formularios, ViewField, SectionDivider.
  - `server-actions.instructions.md` — patrón `getCuentaActiva`, concurrencia optimista con `modifico_fecha`.
  - `ui-conventions.instructions.md` — colores de acento por módulo, iconos Lucide, etiquetas, formatos numéricos.
  - `data-tables.instructions.md` — patrón de tablas de datos.
  - `image-upload.instructions.md` — seguridad y validación para carga de imágenes (magic bytes, SVG, cleanup). Cargar cuando la pantalla incluya un campo de tipo imagen.
- Los prompts en `prompts/crud-*.md` son la especificación de cada pantalla; seguirlos al pie de la letra.
