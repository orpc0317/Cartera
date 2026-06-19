---
description: "Cartera — server action patterns: getCuentaActiva, page.tsx data fetching, optimistic concurrency control with modifico_fecha."
applyTo: "src/app/actions/*.ts, src/app/dashboard/**/page.tsx"
---

# Cartera — Server Action Patterns

## REGLA CRÍTICA — Exports en archivos `"use server"`

En un archivo marcado con `'use server'`, Next.js/Turbopack solo permite exportar **funciones `async`** y **re-exports de tipos** (`export type`).

**Prohibido:**
```ts
// ❌ NUNCA — los re-exports de valor rompen el build
export { getEmpresas } from '@/app/actions/empresas'
export { getProyectos, getProyectoMonedas } from '@/app/actions/proyectos'
```

**Correcto:**
```ts
// ✅ Los tipos se pueden re-exportar (se borran en compilación)
export type { TasaCambio } from '@/lib/types/tasas-cambio'

// ✅ Solo async functions como valores exportados
export async function getTasasCambio() { ... }
```

**Consecuencia práctica para `page.tsx`:** si necesita funciones de otros módulos de actions (e.g. `getEmpresas`, `getProyectos`), importarlas **directamente** desde su archivo de origen:

```ts
// page.tsx
import { getTasasCambio } from '@/app/actions/tasas-cambio'
import { getEmpresas } from '@/app/actions/empresas'          // ← directo
import { getProyectos, getProyectoMonedas } from '@/app/actions/proyectos'  // ← directo
```

> **Nota:** `get_errors` (TS language server) **no detecta** esta violación — solo se manifiesta en build time. Por eso esta regla debe seguirse en tiempo de escritura.

---

## getCuentaActiva — importar, nunca redeclarar localmente

`getCuentaActiva` es una función centralizada exportada desde `src/app/actions/permisos.ts`.
**Nunca redeclararla** en ningún archivo de actions — siempre importarla:

```ts
// Imports requeridos en todo archivo de actions:
import { createAdminClient } from '@/lib/supabase/admin'
import { getCuentaActiva, requirePermiso } from '@/app/actions/permisos'
```

La función lee la cookie `cartera-cuenta` (aislamiento por navegador/perfil) como primera fuente, y cae al JWT `app_metadata.cuenta_activa` como fallback. Es la única fuente de verdad — los action files **no leen** la cookie ni el app_metadata directamente.

Toda query debe llevar `.eq('cuenta', cuenta)`. Si `cuenta` está vacía, las queries de lectura retornan 0 filas silenciosamente (no es un error).

---

## Mutation guard for empty cuenta

Every **write** operation (create, update, delete) must guard against an empty `cuenta` immediately after resolving it:

```ts
const cuenta = await getCuentaActiva()
if (!cuenta) return { error: 'Sesión no válida.' }
```

Read operations (`get*`) do **not** need this guard — an empty `cuenta` silently returns 0 rows.

---

## requirePermiso — IDOR prevention en toda acción de escritura

Toda función que muta datos (`create*`, `update*`, `delete*`, `upload*`) debe llamar `requirePermiso` como **primera instrucción**, antes de cualquier otra operación:

```ts
import { getCuentaActiva, requirePermiso } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'

export async function createEntity(form: EntityForm): Promise<{ error?: string }> {
  const guard = await requirePermiso(PERMISOS.XXX_CAT, 'agregar')
  if (guard) return guard

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  // ...
}
```

`requirePermiso` retorna `null` si el acceso está permitido, o `{ error: string }` si está denegado.
Internamente verifica (en orden):
1. Usuario autenticado (JWT).
2. **Membresía en `t_usuario`** para el tenant del cookie — previene cookie-tampering cross-tenant: un atacante que falsifique la cookie a otra cuenta obtiene `Acceso denegado.` en lugar del fallback "sin filas = Admin".
3. Si el usuario no tiene filas en `t_menu_usuario` → modo Admin (acceso total).
4. Si tiene filas → verifica el flag `agregar` / `modificar` / `eliminar` para el `indice` dado.

---

## Validación de correo electrónico

Todo campo de correo (`correo`) en una Server Action debe validarse **antes** de tocar la base de datos.
El campo es siempre opcional — validar solo si viene con valor.

```ts
// Definir una vez por archivo de actions
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

// En createXxx / updateXxx, inmediatamente después del guard de cuenta:
if (form.correo && !isValidEmail(form.correo))
  return { error: 'El correo electrónico no tiene un formato válido.' }
```

En el `_client.tsx`, el `<Input>` debe llevar `type="email"` para activar la validación nativa del browser como primera línea de defensa:

```tsx
<Input id="correo" type="email" value={form.correo} onChange={(e) => f('correo', e.target.value)} placeholder="correo@ejemplo.com" />
```

---

## page.tsx data fetching pattern

Use **per-call `.catch()`** — never a single `try/catch` wrapping all calls:

```ts
// Required imports in page.tsx:
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'

const [data, empresas, permisos] = await Promise.all([
  getEntities().catch((e: Error) => { console.error('getEntities:', e.message); return [] as Awaited<ReturnType<typeof getEntities>> }),
  getEmpresas().catch((e: Error)  => { console.error('getEmpresas:', e.message);  return [] as Awaited<ReturnType<typeof getEmpresas>>  }),
  getPermisosDetalle(PERMISOS.XXX_CAT),
])
```

One failing call must not zero out all data on the page.

### Permission props pattern

Every `page.tsx` must resolve `getPermisosDetalle(PERMISOS.<KEY>)` and pass the result as three boolean props to the Client Component:

```ts
// page.tsx
<EntityClient
  ...
  puedeAgregar={permisos.agregar}
  puedeModificar={permisos.modificar}
  puedeEliminar={permisos.eliminar}
/>
```

```ts
// _client.tsx props interface
puedeAgregar:  boolean  // controls "New" button visibility
puedeModificar: boolean // controls Edit button in modal footer; changes dropdown label "Ver / Editar" vs "Ver"
puedeEliminar:  boolean // controls Delete option in row actions dropdown
```

The spec for each screen **must** document this mapping in its `ACCIONES` section so it is clear which DB permission gates which UI element. Each spec's `ACCIONES` list must annotate each mutable operation with its required permission (e.g. `— requiere puedeModificar`).

---

## Optimistic concurrency control (modifico_fecha)

Every UPDATE guards against concurrent edits using `modifico_fecha` as a version token.

### Server action

```ts
export async function updateEntity(
  ..., form: EntityForm, lastModified?: string
): Promise<{ error?: string }> {
  const now = new Date().toISOString()
  let query = admin.schema('cartera').from('t_entity')
    .update({ ...form, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta).eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0))
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  // writeAudit...
}
```

### Client component (_client.tsx)

```ts
const [hadConflict, setHadConflict] = useState(false)

// In handleSave:
const lastModified = viewTarget?.modifico_fecha ?? undefined
const result = viewTarget
  ? await updateEntity(..., form, lastModified)
  : await createEntity(form)

if (result.error) {
  toast.error(result.error)
  if (result.error.includes('modificado')) setHadConflict(true)
} else {
  setHadConflict(false)
  toast.success(viewTarget ? 'X actualizado.' : 'X creado.')
  setDialogOpen(false)
  router.refresh()
}

// In Dialog onOpenChange:
if (!open && hadConflict) { setHadConflict(false); router.refresh() }
```

Rules:
- Always pass `viewTarget?.modifico_fecha ?? undefined` to every update call.
- Set `hadConflict(true)` **only** when `result.error.includes('modificado')`.
- Conflict message is always exactly: `'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'`
