---
description: "Cartera CRUD modal and form patterns: DialogContent layout, header gradient, icon badge modes, ViewField, SectionDivider, view/edit grids, delete dialog, audit log."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera  Modal & Form Patterns

## File structure

```
page.tsx     Server Component: fetch with per-call .catch(() => [])
_client.tsx  Client Component: all UI, state, mutations
```

Mutations in `src/app/actions/<entity>.ts`. After mutations: `router.refresh()`.

---

## Modal layout

```tsx
<Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
  setDialogOpen(open)
  if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
}}>
  <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

    <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-{accent}-50/70 to-transparent border-b border-border/50 shrink-0">
      <div className="flex items-center gap-3 pr-8">
        <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold leading-tight truncate">
            {isEditing && !viewTarget ? 'Nueva X' : isEditing ? 'Editar X' : viewTarget?.nombre}
          </DialogTitle>
          {viewTarget && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
              <span className="font-mono ml-1.5 text-muted-foreground/60"> #{viewTarget.codigo}</span>
            </p>
          )}
        </div>
      </div>
    </DialogHeader>

    <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0"><TabsTrigger value="general" className="gap-1.5"><MapPin className="h-3.5 w-3.5" /> General</TabsTrigger></TabsList>
      <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {!isEditing && viewTarget ? <ViewMode /> : <EditMode />}
      </TabsContent>
    </Tabs>

    <DialogFooter className="mt-4 shrink-0">
      {!isEditing && viewTarget ? (
        <>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
          {puedeModificar && <Button onClick={startEdit} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}
        </>
      ) : (
        <>
          <Button variant="outline" onClick={cancelEdit}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando' : 'Guardar'}</Button>
        </>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Icon badge by mode

| Mode     | Background    | Icon color    |
|----------|---------------|---------------|
| Viewing  | `{accent}-100` | `{accent}-600` |
| Creating | `{accent}-100` | `{accent}-600` |
| Editing  | `amber-100`   | `amber-600`   |

Icon: entity icon when viewing, `<Plus>` when creating, `<Pencil>` when editing.

---

## ViewField

```tsx
function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
    </div>
  )
}
```

---

## SectionDivider

```tsx
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <div className="h-4 w-0.5 rounded-full bg-primary/40" />
      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
      <div className="flex-1 border-t border-primary/30" />
    </div>
  )
}
```

---

## View mode grid

```tsx
<div className="grid grid-cols-2 gap-3">
  <SectionDivider label="SECCION" />
  <div className="col-span-2"><ViewField label="Nombre" value={...} /></div>
  <ViewField label="Campo A" value={...} />
  <ViewField label="Campo B" value={...} />
</div>
```

- `gap-3` between cards. Full-width: wrap in `<div className="col-span-2">`. Half-width: no wrapper.
- País: show flag + nombre in a custom div (see ui-conventions.instructions.md geo rules).
- Boolean: `<Checkbox checked={!!record.field} disabled />` inside a `rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5` card.
- Logo: `<img>` inside a `col-span-2` muted card.

### Field width annotations in TABS_MODAL

Every field listed in a spec's `TABS_MODAL` section **must** carry a width annotation so the implementer knows the grid span without guessing:

| Annotation | Grid behaviour | When to use |
|---|---|---|
| `(full)` | `col-span-2` — occupies the whole row | Long text, addresses, names, selects with long options, any field that needs room |
| `(half)` | occupies one column; the next `(half)` field fills the other | Short codes, numbers, booleans paired side by side |
| `(third)` | occupies one third of the row; **must appear in groups of 3** | Three short fields that logically belong together (e.g. day / month / year, or code / type / status) |

**Rule:** the spec author decides width based on field semantics and expected content length. The implementer applies it literally.

**Thirds implementation:** the outer grid stays `grid-cols-2`. Three consecutive `(third)` fields are wrapped in a single `col-span-2` container that creates an inner 3-column grid:

```tsx
{/* view mode */}
<div className="col-span-2 grid grid-cols-3 gap-3">
  <ViewField label="Dia"  value={...} />
  <ViewField label="Mes"  value={...} />
  <ViewField label="Anio" value={...} />
</div>

{/* edit mode */}
<div className="col-span-2 grid grid-cols-3 gap-4">
  <div className="grid gap-1"><Label ...>Dia</Label><Input ... /></div>
  <div className="grid gap-1"><Label ...>Mes</Label><Input ... /></div>
  <div className="grid gap-1"><Label ...>Anio</Label><Input ... /></div>
</div>
```

Examples in spec syntax:
```
  - nombre            (view + edit; full)
  - empresa           (view + edit; half)
  - proyecto          (view + edit; half)
  - dia               (view + edit; third)
  - mes               (view + edit; third)
  - anio              (view + edit; third)
  - activo            (view + edit; half — Checkbox 0/1)
  - predeterminado    (view + edit; half — Checkbox 0/1)
```

---

## Edit mode grid

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="col-span-2 grid gap-1">
    <Label htmlFor="campo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Label *</Label>
    <Input id="campo" ... />
  </div>
</div>
```

- `gap-4` between fields, `gap-1` inside each field wrapper (label  input).
- All `<Label>`: `className="text-[11px] font-semibold tracking-wider text-muted-foreground"`.
- Geo cascade: use native `<select>` (not Shadcn `<Select>`) with class:
  `flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50`
- Phone fields: `<PhoneField>` from `@/components/ui/phone-field`. Import `DIAL_CODES` and `splitPhone` from the same file. Sync `tel1Iso`/`tel1Local` with form via `useEffect` placed **after** the `form` useState declaration.
- **Numeric input spin buttons**: By default, `type="number"` inputs show up/down spin buttons. Control this per field:
  - **Con spin** (`sin-spin: false`): small bounded integers where stepping one-by-one is useful (e.g. `dias_fecha`, `formato`). No extra class needed — browser default.
  - **Sin spin** (`sin-spin: true`): large free-entry numbers where the spinner is useless and confusing (e.g. `correlativo`, monetary amounts, phone numbers). Add `className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"` to the `<Input>`.
  - The spec for each screen must mark each numeric field as `sin-spin: true/false` so the implementer knows which to apply.

- **Hardcoded Select fields**: When a `<Select>` has fixed options (not loaded from DB), define a `const` map or array above the component, use the **numeric code** as `value` in `<SelectItem>`, store the code in the form/DB, and display the label/description everywhere (edit mode `<SelectValue>`, view mode `<ViewField>`). Example:
  ```tsx
  // definition (outside component)
  const TIPO_ID_LABELS: Record<number, string> = { 0: 'NIT', 1: 'DPI', 2: 'Extranjero' }

  // edit mode
  <Select value={String(form.tipo_id)} onValueChange={(v) => f('tipo_id', Number(v))}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      {Object.entries(TIPO_ID_LABELS).map(([k, v]) => (
        <SelectItem key={k} value={k}>{v}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  // view mode
  <ViewField label="Tipo ID" value={TIPO_ID_LABELS[viewTarget.tipo_id] ?? `#${viewTarget.tipo_id}`} />
  ```

- **DB-loaded Select fields**: When a `<Select>` stores a numeric FK code but must display a name (loaded from DB), always add the render-prop child to `<SelectValue>` so the selected item shows the name — not the raw code. Use the entity's `Map` (e.g. `bancoMap`, `empresaMap`):
  ```tsx
  // Always — without this, Base UI SelectValue renders the raw value string after selection
  <SelectValue placeholder="Selecciona banco">
    {(v: string) => v ? (bancoMap.get(Number(v)) ?? v) : null}
  </SelectValue>
  ```
  This applies to **every** FK `<Select>`: empresa, proyecto, fase, banco, cuenta bancaria, vendedor, cobrador, etc.

  > **❌ Antipatrón — NO usar hijo estático que lee `form.field` directamente:**
  > ```tsx
  > // WRONG — le quita al componente control del estado; el placeholder nunca se muestra correctamente
  > <SelectValue placeholder="Selecciona empresa">
  >   {empresaMap.get(form.empresa) ?? 'Selecciona empresa'}
  > </SelectValue>
  > ```
  > Usar **siempre** la render function `{(v: string) => v ? (...) : null}` para FK selects, y `<SelectValue />` limpio (sin hijo) para hardcoded selects.

- **Auto-select first item on form open**: Every `<Select>` (hardcoded or DB-loaded) **must** pre-select its first available item when the create dialog opens (`openCreate`) and whenever a cascade resets a downstream field. This speeds up data entry.
  - In `openCreate`: compute the first valid value for every dropdown and pass them to `setForm({...EMPTY_FORM, ...})` explicitly.
  - In the cascade inside `f()`: after resetting downstream fields, compute and set the first valid value for each one.
  - **Exception**: the `ClienteCombobox` is never auto-selected — it must always be chosen explicitly by the user.
  - Hardcoded dropdowns: pre-select the first key of the map/array (e.g. `forma_pago = Number(Object.keys(FORMAS_PAGO)[0])`).
  - DB-loaded dropdowns with cascades (fase → manzana → lote): follow the same cascade order, computing each first value from the filtered list.

---

## Delete dialog

```tsx
<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar <entidad>?</AlertDialogTitle>
      <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente <strong>{deleteTarget?.nombre}</strong>.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Audit log dialog

```tsx
<AuditLogDialog
  open={!!auditTarget}
  onOpenChange={(o) => !o && setAuditTarget(null)}
  tabla="t_<entity>"
  cuenta={auditTarget.cuenta}
  codigo={auditTarget.codigo}
  titulo={auditTarget.nombre}
/>
```

---

## Permission mapping to UI

Applies to every CRUD screen. The three permissions from `t_menu_usuario` map to UI as follows:

| Permission | UI effect |
|---|---|
| `agregar`   | Shows/hides the **"Nuevo {NOMBRE}"** button in the toolbar — `{NOMBRE}` is the singular entity name declared in the prompt's `IDENTIFICACION.NOMBRE` field |
| `modificar` | Shows/hides the **"Editar"** button in the modal footer; changes the row dropdown label to **"Ver / Editar"** vs **"Ver"** |
| `eliminar`  | Shows/hides the **"Eliminar"** option in the row action dropdown |

Fetch in `page.tsx` using the `PERMISO` constant from the prompt's `IDENTIFICACION` table:

```ts
const permisos = await getPermisosDetalle(PERMISOS.{PERMISO})
// pass as props:
puedeAgregar={permisos.agregar}
puedeModificar={permisos.modificar}
puedeEliminar={permisos.eliminar}
```

---

## TABS_MODAL spec format

Each spec's `TABS_MODAL` section uses **one table per section** to declare fields. The rules below are global — do not repeat them inside spec files.

### Global structure rules

- The first tab is always **General** and is mandatory. Add tabs only if the screen requires it.
- Each tab groups fields under `SectionDivider` headings listed top-to-bottom in visual order.
- Fields not shown in a given mode get `—` in that column.
- When Nuevo and Edit are identical for all fields in a section, collapse into a single `Nuevo / Edit` column.

### Table format

```markdown
### Tab: General  (icono: <NombreIconoLucide>)

**[NOMBRE_SECCION]**

| Campo  | Label  | Ancho | View      | Nuevo      | Edit             | Notas |
|--------|--------|-------|-----------|------------|------------------|-------|
| campo1 | Label1 | full  | ViewField | Input; req | Input; req       |       |
| campo2 | Label2 | half  | ViewField | Select     | Select; disabled |       |
| campo3 | Label3 | half  | —         | —          | —                |       |
```

### Column legend

**Ancho:** `full` | `half` | `third` — same semantics as the grid width annotations above.

**View / Nuevo / Edit values:**

| Value               | Meaning |
|---------------------|---------|
| `ViewField`         | Standard read-only card (`rounded-lg bg-muted/50`) — label + value |
| `Checkbox card`     | `<Checkbox disabled />` inside a ViewField-style card (label above, checkbox below) |
| `Moneda display`    | Apply **Moneda display rules** from `ui-conventions.instructions.md` |
| `Input`             | `<Input>` text field |
| `Input; req`        | Required `<Input>` |
| `Input number ≥ 0`  | `type="number"` with `Math.max(0, …)` clamp |
| `Select`            | `<Select>` loaded from prop |
| `Select; disabled`  | `<Select disabled={!!viewTarget}>` — readonly after creation |
| `Select nullable`   | `<Select>` with blank first option (`value=""`) representing `null` in DB |
| `Checkbox 0/1`      | `<Checkbox>` storing smallint 0/1 |
| `—`                 | Field not shown in this mode |

**Notas column:** short constraint or cross-reference (`ver REGLA #N`). Full details go in `REGLAS_ESPECIFICAS`.

### Adding more tabs

```markdown
### Tab: <Nombre>  (icono: <NombreIconoLucide>)

**[NOMBRE_SECCION]**

| Campo | Label | Ancho | View | Nuevo / Edit | Notas |
|-------|-------|-------|------|--------------|-------|
| ...   | ...   | ...   | ...  | ...          | ...   |
```

---

## Canonical reference file

El archivo de referencia canónica del patrón es:
`src/app/dashboard/cuentas-cobrar/series-recibos/_client.tsx`

Es la implementación más completa y actualizada del proyecto. Usarlo como referencia concreta al generar un nuevo screen.
