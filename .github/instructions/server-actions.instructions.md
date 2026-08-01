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

## Funciones RPC (`SECURITY DEFINER`) — grants obligatorios

Cuando una Server Action necesita lógica transaccional compleja (ej. `fn_crear_reserva`, `fn_depositar_pagos`), se implementa como función Postgres `SECURITY DEFINER` en el schema `cartera` y se invoca así:

```ts
const admin = createAdminClient() // service_role — nunca el cliente de usuario
const { data, error } = await admin
  .schema('cartera')
  .rpc('fn_nombre_funcion', { p_param1: ..., p_param2: ... })
```

**Regla obligatoria al crear cualquier función nueva `SECURITY DEFINER`:** por defecto Postgres otorga `EXECUTE` a `PUBLIC`, lo que la hace invocable sin login vía `/rest/v1/rpc/fn_nombre_funcion` (bypass completo de `requirePermiso` y `getCuentaActiva`, ya que la función confía en los parámetros que recibe, no en el JWT). Toda migración que cree una función `SECURITY DEFINER` en `cartera` debe incluir:

```sql
CREATE OR REPLACE FUNCTION cartera.fn_nombre_funcion(...) ...
SECURITY DEFINER
SET search_path = 'pg_catalog', 'cartera'  -- SIEMPRE fijar search_path
AS $$ ... $$;

REVOKE EXECUTE ON FUNCTION cartera.fn_nombre_funcion(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cartera.fn_nombre_funcion(...) TO service_role;
```

**Nota:** `REVOKE ... FROM anon, authenticated` (sin `PUBLIC`) es un **no-op** si el grant real está en `PUBLIC` — verificar con `has_function_privilege('anon', oid, 'EXECUTE')` antes y después de aplicar el fix. Verificar también que `service_role` conserve el privilegio tras el `REVOKE FROM PUBLIC` (agregar el `GRANT ... TO service_role` explícito siempre, incluso si ya lo tenía por herencia de `PUBLIC`).

---

## writeAudit — obligatorio en toda mutación (INSERT/UPDATE/DELETE)

Toda función `create*`/`update*`/`delete*` debe dejar rastro en `cartera.t_audit_log` llamando a
`writeAudit` **inmediatamente después** de que la mutación se confirme exitosa. **No existe ningún
trigger de base de datos que haga esto automáticamente** — es 100% responsabilidad de la Server
Action. Sin esta llamada, el botón "Historial" (`components.instructions.md § AF`) de esa pantalla
queda permanentemente vacío para los registros afectados (bug real ya detectado en Reservas y en
Mantenimiento Pagos — ver por qué abajo).

### Snippet (copiar en cada archivo de actions que no lo tenga ya — se duplica por archivo, no se comparte)

```ts
async function getAuditUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, email: null, nombre: null }
  const admin = createAdminClient()
  const { data } = await admin
    .schema('cartera')
    .from('t_usuario')
    .select('nombres, apellidos')
    .eq('userid', user.id)
    .maybeSingle()
  const nombre = data
    ? `${data.nombres ?? ''} ${data.apellidos ?? ''}`.trim() || null
    : null
  return { userId: user.id, email: user.email ?? null, nombre }
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    tabla: string
    operacion: 'INSERT' | 'UPDATE' | 'DELETE'
    cuenta: string
    registroId: Record<string, unknown>
    datoAntes: Record<string, unknown> | null
    datoDespues: Record<string, unknown> | null
    userId: string | null
    email: string | null
    nombre: string | null
  },
) {
  await admin.schema('cartera').from('t_audit_log').insert({
    tabla: opts.tabla,
    operacion: opts.operacion,
    cuenta: opts.cuenta,
    registro_id: opts.registroId,
    datos_antes: opts.datoAntes,
    datos_despues: opts.datoDespues,
    usuario_id: opts.userId,
    usuario_email: opts.email,
    usuario_nombre: opts.nombre,
  })
}
```

- `INSERT`: `datoAntes: null`, `datoDespues: <fila creada completa>`.
- `UPDATE`: `datoAntes: <fila antes del update>`, `datoDespues: <fila despues>`.
- `DELETE`: `datoAntes: <fila antes de borrar>`, `datoDespues: null`.
- `registroId` debe incluir **todos** los campos de la PK compuesta — debe coincidir exactamente
  con el `registroId` que arma el `<AuditLogDialog>` en el cliente (ver
  `components.instructions.md § AF`).

### Regla obligatoria — aplica TAMBIEN a creación/edición vía función RPC (`SECURITY DEFINER`)

Cuando la mutación se delega a una función Postgres (`fn_crear_reserva`,
`fn_registrar_pago_cuotas`, `fn_crear_promesa`, etc. — ver "Funciones RPC" arriba), la llamada a
`writeAudit` sigue siendo obligatoria **desde la Server Action que invoca el RPC**, nunca desde la
función SQL. Es exactamente aquí donde se escapa más fácil el paso, porque no hay un `.insert()`
explícito en TS que recuerde hacerlo. Dos casos:

1. **La función YA devuelve la fila creada/actualizada** en su `jsonb` de retorno (ej.
   `fn_crear_promesa` devuelve `{ ok, promesa: {...} }`) → usar ese valor directo como
   `datoDespues`, sin queries extra.
2. **La función NO devuelve la fila** (ej. `fn_crear_reserva` solo devuelve `{ok, numero, recibo}`,
   `fn_registrar_pago_cuotas` solo `{numero_recibo, promesa_pagada}`) → hacer un `SELECT` de vuelta
   por la clave (empresa/proyecto/serie/numero, o lo que corresponda) **antes** de llamar
   `writeAudit`. Nunca pasar `datoDespues: null` para una mutación que sí ocurrió — inutiliza el
   historial para ese registro.

**Checklist rápido antes de dar por completa cualquier función `create*`/`update*`/`delete*` nueva
(o que llame a un RPC nuevo):** ¿hay una llamada a `writeAudit` después de la mutación exitosa? Si
la respuesta es no, agregarla — no asumir que "ya se hará después" o que "no aplica porque es una
función SQL".

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
