---
description: "Cartera — server action patterns: getCuentaActiva, page.tsx data fetching, optimistic concurrency control with modifico_fecha."
applyTo: "src/app/actions/*.ts, src/app/dashboard/**/page.tsx"
---

# Cartera — Server Action Patterns

## getCuentaActiva (required in every action file)

```ts
async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}
```

Every query must `.eq('cuenta', cuenta)`. If `cuenta` is empty, queries return 0 rows silently — not an error.

---

## Mutation guard for empty cuenta

Every **write** operation (create, update, delete) must guard against an empty `cuenta` immediately after resolving it:

```ts
const cuenta = await getCuentaActiva()
if (!cuenta) return { error: 'Sesión no válida.' }
```

Read operations (`get*`) do **not** need this guard — an empty `cuenta` silently returns 0 rows.

---

## page.tsx data fetching pattern

Use **per-call `.catch()`** — never a single `try/catch` wrapping all calls:

```ts
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
