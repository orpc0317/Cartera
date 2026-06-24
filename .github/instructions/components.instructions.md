---
description: "Cartera — copy-verbatim snippets for every UI primitive used in _client.tsx: modal state/functions, form inputs, selects, checkboxes, alert dialog, row dropdown, table utilities. Single source of truth — no imagination needed."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera — Component Snippets

**Fuente única de verdad para todos los primitivos de UI.**  
Copia cada sección verbatim — reemplaza los `<angle-bracket>` placeholders.  
**No inventar alternativas.** Todo está aquí.

## Índice rápido

| § | Objeto |
|---|--------|
| A | Modal — declaración de state |
| B | Modal — variables computadas (iconBadgeBg, subtitle, icon) |
| C | Modal — funciones (openCreate, openView, startEdit, cancelEdit, handleSave) |
| D | Input texto |
| E | Input numérico (con / sin spin) |
| F | Select — FK numérico cargado de BD |
| G | Select — catálogo hardcoded |
| H | Select — codigo ya es el label de display |
| I | Checkbox standalone (fila completa) |
| J | Checkbox en fila mixta con input/select |
| K | AlertDialog — confirmación de borrado |
| L | Dropdown de fila (acciones) |
| M | Utilidades de tabla: ColumnFilter, ColumnManager, handleTableKeyDown |
| N | ViewField + SectionDivider |
| O | Grid modo vista (view mode) |
| P | Grid modo edición (edit mode) |
| Q | Page header (h1 + botón Nuevo) |
| R | Modal JSX completo (Dialog + Tabs + Footer) |
| S | Toolbar (search + limpiar filtros + ml-auto group) |
| T | Función exportCsv + constantes NEVER_EXPORT / COL_LABELS |
| U | Persistencia colPrefs en localStorage |
| V | Pipeline de filtrado (afterSearch + filtered useMemo) |
| W | Select moneda con bandera — en `advanced-components.instructions.md` |
| X | Select geo nativo (país / departamento / municipio) — en `advanced-components.instructions.md` |
| Y | Campo activo: badge en tabla, card en vista, checkbox en edición |
| Z | Textarea + Input fecha |
| AA | CountrySelect (selector de país con bandera + cascade) — en `advanced-components.instructions.md` |
| AB | ClienteCombobox (select buscable por texto) — en `advanced-components.instructions.md` |
| AC | LogoUploadField — en `image-upload.instructions.md` |
| AD | Input numérico con sufijo de unidad (adornment) |
| AE | Selection Buttons (radio group visual) |
| AF | AuditLogDialog (historial de cambios) |
| AG | Modal ancho — 2 columnas con separador vertical |

---

## A · Modal — State declarations

Declare inside the component, after `colPrefs` state:

```ts
const [dialogOpen, setDialogOpen]         = useState(false)
const [isEditing, setIsEditing]           = useState(false)
const [viewTarget, setViewTarget]         = useState<<Entity> | null>(null)
const [form, setForm]                     = useState<<EntityForm>>(EMPTY_FORM)
const [isPending, startTransition]        = useTransition()
const [hadConflict, setHadConflict]       = useState(false)
const [similarWarning, setSimilarWarning] = useState<string[]>([])  // names of potential duplicates; non-empty = AlertDialog open
const [deleteTarget, setDeleteTarget]     = useState<<Entity> | null>(null)
const [auditTarget, setAuditTarget]       = useState<<Entity> | null>(null)  // full row object; !!auditTarget controls dialog open
```

---

## B · Modal — Computed values (place right after state declarations)

```ts
// Icon badge: amber when editing an existing record; accent for all other modes
const iconBadgeBg  = isEditing && viewTarget ? 'bg-amber-100'   : 'bg-<accent>-100'
const iconBadgeClr = isEditing && viewTarget ? 'text-amber-600' : 'text-<accent>-600'
const icon = !isEditing
  ? <<EntityIcon> className={`h-4 w-4 ${iconBadgeClr}`} />          // viewing
  : !viewTarget
    ? <Plus   className={`h-4 w-4 ${iconBadgeClr}`} />              // creating
    : <Pencil className={`h-4 w-4 ${iconBadgeClr}`} />              // editing

// Subtitle shown below entity name in modal header — pick ONE pattern based on the entity's FK depth:
const subtitle = viewTarget ? (empresaMap.get(viewTarget.empresa) ?? '') : ''                   // entity belongs to empresa (not proyecto)
// const subtitle = viewTarget ? [empresaMap.get(viewTarget.empresa), proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`)].filter(Boolean).join(' · ') : ''  // entity belongs to proyecto (e.g. cliente, vendedor, lote)
// const subtitle = ''  // entity belongs only to cuenta, with no empresa/proyecto FK
```

---

## C · Modal — Functions

Copy all five. In `startEdit` list every `<EntityForm>` field. Replace `create<Entity>` / `update<Entity>` with the actual action import names (convención: `createBanco`, `updateBanco`, `deleteBanco` — camelCase `create/update/delete` + PascalCase entity, importados desde `@/app/actions/<entity-kebab>.ts`).

```ts
function openCreate() {
  // Pre-select first item for every dropdown in the form (cascade order)
  const firstEmpresa  = empresas[0]?.codigo ?? 0
  const firstProyecto = proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
  setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
  setViewTarget(null)
  setIsEditing(true)
  setDialogOpen(true)
}

function openView(row: <Entity>) {
  setViewTarget(row)
  setIsEditing(false)
  setDialogOpen(true)
}

function startEdit() {
  setForm({
    // List every field in <EntityForm> — copy EMPTY_FORM keys, source values from viewTarget
    campo1: viewTarget!.campo1,
    campo2: viewTarget!.campo2,
    // ...
  })
  setIsEditing(true)
}

function cancelEdit() {
  if (viewTarget) setIsEditing(false)  // return to view mode — form re-populated on next startEdit()
  else            setDialogOpen(false) // was creating — close dialog
}

function handleSave() {
  startTransition(async () => {
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    const result = viewTarget
      ? await update<Entity>(viewTarget.codigo, form, lastModified)
      : await create<Entity>(form)
    if (result.error) {
      toast.error(result.error)
      if (result.error.includes('modificado')) setHadConflict(true)
    } else {
      setHadConflict(false)
      toast.success(viewTarget ? '<Entidad> actualizada.' : '<Entidad> creada.')
      setDialogOpen(false)
      router.refresh()
    }
  })
}
```

> **Cascade in `openCreate`:** when the form has chained dropdowns (empresa → proyecto → fase), compute each first value from the filtered downstream list, in cascade order, and pass all of them to `setForm`.

> **Dirty check (obligatorio en todo `handleSave`):** si `viewTarget` existe, comparar `form` contra el original antes de llamar al servidor. Si no hay cambios, cerrar el modal sin request.
>
> ```ts
> // Con buildFormFromX:
> if (viewTarget && JSON.stringify(form) === JSON.stringify(buildFormFrom<Entity>(viewTarget))) {
>   setDialogOpen(false); return
> }
> // Con geo (buildFormFromX retorna { form, paisCodigo, ... }):
> if (viewTarget && JSON.stringify(form) === JSON.stringify(buildFormFrom<Entity>(viewTarget).form)) {
>   setDialogOpen(false); return
> }
> ```
> — Sin `buildFormFromX`: comparar campo a campo con `viewTarget` respetando `?? null` / `?? ''`.
> — Con campo `logoFile`: añadir `&& !logoFile` a la condición.

---

## D · Form — Text Input

Requires `f()` helper (see `ui-conventions.instructions.md § Text input normalization`).

```tsx
<div className="grid gap-1">
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text> *
  </Label>
  <Input
    id="<field>"
    variant="l-border"
    value={form.<field>}
    onChange={(e) => f('<field>', e.target.value)}
    placeholder="<Sentence case placeholder>"
  />
</div>
```

---

## E · Form — Number Input

**With spin** (small bounded integers — e.g. `dias_fecha`, `formato`):
```tsx
<Input
  id="<field>"
  type="number"
  value={form.<field>}
  onChange={(e) => f('<field>', Number(e.target.value))}
/>
```

**Without spin** (large numbers, correlativo, monetary amounts — spec marks `sin-spin: true`):
```tsx
<Input
  id="<field>"
  type="number"
  value={form.<field>}
  onChange={(e) => f('<field>', Number(e.target.value))}
  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

---

## F · Form — Select (FK loaded from DB)

```tsx
<Select value={String(form.<field>)} onValueChange={(v) => f('<field>', Number(v))}>
  <SelectTrigger variant="l-border" className="w-full">
```

---

## G · Form — Select (hardcoded catalog)

```ts
// Module-level constant (outside component):
const <LABELS>: Record<number, string> = { 1: 'Opción A', 2: 'Opción B' }
// First key = pre-selected default in openCreate()
```

```tsx
<Select value={String(form.<field>)} onValueChange={(v) => f('<field>', Number(v))}>
  <SelectTrigger variant="l-border" className="w-full">
    <SelectValue placeholder="<Selecciona opcion>">
      {(v: string) => v !== '' ? (<LABELS>[Number(v)] ?? v) : null}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {Object.entries(<LABELS>).map(([k, label]) => (
      <SelectItem key={k} value={k}>{label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## H · Form — Select (codigo IS the display label)

Use when the raw value is already human-readable. **No render-prop.**

Campos que aplican en el proyecto: `manzana`, `lote`, `serie_recibo`, `serie_factura`.  
Regla: si el `<SelectItem value={x}>` y su texto visible son el mismo string, usa esta variante.

```tsx
<Select value={form.<field>} onValueChange={(v) => f('<field>', v)}>
  <SelectTrigger variant="l-border" className="w-full">
    <SelectValue placeholder="<Selecciona opcion>" />
  </SelectTrigger>
  <SelectContent>
    {<items>.map((item) => (
      <SelectItem key={item.codigo} value={item.codigo}>{item.codigo}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## I · Form — Checkbox (standalone, full-width row)

```tsx
<div className="col-span-2 flex items-center gap-2 py-1">
  <Checkbox
    id="<field>"
    checked={!!form.<field>}
    onCheckedChange={(c) => setForm((p) => ({ ...p, <field>: c ? 1 : 0 }))}
  />
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text>
  </Label>
</div>
```

---

## J · Form — Checkbox aligned in a mixed grid row

Parent **must** have `items-end`. Checkbox wrapper **must** have `pb-1`. Without both, checkbox floats to the top of the row.

```tsx
{/* Parent — note items-end */}
<div className="grid grid-cols-2 gap-4 items-end">
  <div className="grid gap-1">
    <Label htmlFor="<field1>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}><Label 1></Label>
    <Select ...>...</Select>
  </div>
  {/* Checkbox wrapper — note pb-1 */}
  <div className="flex items-center gap-2 pb-1">
    <Checkbox
      id="<field2>"
      checked={!!form.<field2>}
      onCheckedChange={(c) => setForm((p) => ({ ...p, <field2>: c ? 1 : 0 }))}
    />
    <Label htmlFor="<field2>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}><Label 2></Label>
  </div>
</div>
```

Same rule applies to `col-span-2 grid grid-cols-3 gap-4 items-end` for third-width groups containing a checkbox.

---

## K · AlertDialog — Delete confirmation

State: `const [deleteTarget, setDeleteTarget] = useState<<Entity> | null>(null)` (already in block A).

```tsx
<AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
  <AlertDialogContent>
    <AlertDialogTitle>¿Eliminar <entidad>?</AlertDialogTitle>
    <AlertDialogDescription render={<div />}>
      <div>
        Esta acción es permanente. ¿Eliminar <strong>{deleteTarget?.<nombre>}</strong>?
      </div>
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        render={<Button variant="destructive" />}
        onClick={async () => {
          if (!deleteTarget) return
          const result = await delete<Entity>(deleteTarget.codigo)
          if (result.error) toast.error(result.error)
          else { toast.success('<Entidad> eliminada.'); router.refresh() }
          setDeleteTarget(null)
        }}
      >
        Eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

> **`render={<div />}` is mandatory** — Base UI does not support `asChild` on `AlertDialogDescription`. Nesting `<p>` inside causes a hydration error.

---

## L · Row actions dropdown

```tsx
<DropdownMenuTrigger
  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium
             transition-opacity hover:bg-accent hover:text-accent-foreground
             focus-visible:outline-none opacity-0 group-hover:opacity-100"
>
  <MoreHorizontal className="h-4 w-4" />
</DropdownMenuTrigger>
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={() => openView(row)}>
    <Eye className="mr-2 h-4 w-4" />
    {puedeModificar ? 'Ver / Editar' : 'Ver'}
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => setAuditTarget(row)}>
    <History className="mr-2 h-4 w-4" />
    Historial
  </DropdownMenuItem>
  {puedeEliminar && (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => setDeleteTarget(row)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar
      </DropdownMenuItem>
    </>
  )}
</DropdownMenuContent>
```

> **`<DropdownMenuTrigger>` — no `asChild`** (Base UI does not support it). Put the className directly on the trigger.

---

## M · Table utilities (copy verbatim into each _client.tsx)

These are **not** shared components — define them in every `_client.tsx` file.

### ColumnFilter

```tsx
function ColumnFilter({ label, values, active, onChange }: {
  label: string; values: string[]; active: Set<string>; onChange: (next: Set<string>) => void
}) {
  const isFiltered = active.size > 0
  return (
    <Popover>
      <PopoverTrigger render={
        <button type="button" className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium transition-colors hover:bg-accent ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
          <ChevronDown className="h-3 w-3" />
          {isFiltered && <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{active.size}</span>}
        </button>
      } />
      <PopoverContent className="w-52 p-2" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {isFiltered && (
            <button type="button" onClick={() => onChange(new Set())} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
              <Checkbox
                checked={active.has(v)}
                onCheckedChange={(checked: boolean) => {
                  const next = new Set(active)
                  checked ? next.add(v) : next.delete(v)
                  onChange(next)
                }}
              />
              <span className="truncate">{v || '(vacío)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### ColumnManager

```tsx
function ColumnManager({ prefs, onToggle, onMove, onReset }: {
  prefs: ColPref[]; onToggle: (key: string) => void; onMove: (key: string, dir: -1 | 1) => void; onReset: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Columnas</Button>} />
      <PopoverContent className="w-56 p-3" align="end">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Columnas visibles</span>
          <button type="button" onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground">Restablecer</button>
        </div>
        <div className="space-y-0.5">
          {prefs.map((pref, i) => {
            const col = ALL_COLUMNS.find((c) => c.key === pref.key)!
            return (
              <div key={pref.key} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-accent">
                <Checkbox checked={pref.visible} onCheckedChange={() => onToggle(pref.key)} />
                <span className="flex-1 text-sm">{col.label}</span>
                <button type="button" disabled={i === 0} onClick={() => onMove(pref.key, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Keyboard navigation

```ts
const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
  if (filtered.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setCursorIdx((prev) => prev === null ? 0 : Math.min(prev + 1, filtered.length - 1))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setCursorIdx((prev) => prev === null ? 0 : Math.max(prev - 1, 0))
  } else if (e.key === 'Enter' && cursorIdx !== null) {
    e.preventDefault()
    openView(filtered[cursorIdx])
  } else if (e.key === 'Escape') {
    setCursorIdx(null)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filtered, cursorIdx])

// Reset cursor when search or filters change — place after handleTableKeyDown:
useEffect(() => { setCursorIdx(null) }, [search, colFilters])
```

---

## N · ViewField + SectionDivider

Definir **dentro de cada `_client.tsx`** (no son componentes compartidos).

> **Fuente única de tamaños** — los `style={{ fontSize: 'var(--ui-xxx)' }}` referencian variables CSS definidas en `src/app/globals.css :root`:
> `--ui-viewfield-label: 10px` · `--ui-viewfield-value: 11px` · `--ui-section-divider: 11px` · `--ui-form-label: 10px` · `--ui-input: 11px`.
> Para cambiar todos los tamaños a la vez, editar solo ese bloque en `globals.css`.

```tsx
function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
        <span className="block font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{value || ''}</span>
      </div>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <div className="h-4 w-0.5 rounded-full bg-primary/40" />
      <span className="font-semibold uppercase tracking-wider text-primary" style={{ fontSize: 'var(--ui-section-divider)' }}>{label}</span>
    </div>
  )
}
```

### Reglas ViewField

> **Wrapper de campo:** usar siempre `<div className="grid gap-1">` — nunca `space-y-1.5`. El `grid gap-1` da 4 px de separación entre label y campo, idéntico al interior del `ViewField`, garantizando que los bordes inferiores de campos adyacentes queden alineados.

> **Estilo de label en ViewField:** `font-semibold tracking-wider leading-none` — igual peso visual que `<Label>` de formulario para coherencia cuando ViewField y Input/Select aparecen lado a lado en la misma fila.

- **Texto:** pasar el valor crudo; `ViewField` muestra en blanco si es `null`/`undefined`/`''`. Nunca pasar `|| '—'` a `ViewField`. En renderers de columna de tabla, `|| '—'` es aceptable.
- **Numérico:** si `0` significa "no definido", guardar en el call site: `value={viewTarget.valor ? fmt(viewTarget.valor) : ''}`. Si `0` es válido (p.ej. `dias_gracia`), pasar `fmt(x)` directo.
- **Códigos numéricos auto-increment:** mostrar como `String(viewTarget.codigo)` — nunca con `#` prefix.

---

## O · Grid modo vista (view mode)

```tsx
<div className="grid grid-cols-2 gap-2">
  <SectionDivider label="SECCION" />

  {/* full — ocupa toda la fila */}
  <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>

  {/* half — dos campos por fila */}
  <ViewField label="Campo A" value={viewTarget.campo_a} />
  <ViewField label="Campo B" value={viewTarget.campo_b} />

  {/* third — tres campos por fila; inner grid dentro de col-span-2 */}
  <div className="col-span-2 grid grid-cols-3 gap-2">
    <ViewField label="Dia"  value={String(viewTarget.dia)} />
    <ViewField label="Mes"  value={String(viewTarget.mes)} />
    <ViewField label="Anio" value={String(viewTarget.anio)} />
  </div>

  {/* boolean — checkbox libre, sin card container */}
  <div className="flex items-center gap-2 py-1">
    <Checkbox checked={!!viewTarget.activo} disabled />
    <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Activo</span>
  </div>
</div>
```

---

## P · Grid modo edición (edit mode)

```tsx
<div className="grid grid-cols-2 gap-2">
  <SectionDivider label="SECCION" />

  {/* full */}
  <div className="col-span-2 grid gap-1">
    <Label htmlFor="nombre" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Nombre *</Label>
    <Input variant="l-border" id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del registro" />
  </div>

  {/* half */}
  <div className="grid gap-1">
    <Label htmlFor="campo_a" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Campo A</Label>
    <Input variant="l-border" id="campo_a" value={form.campo_a} onChange={(e) => f('campo_a', e.target.value)} placeholder="..." />
  </div>
  <div className="grid gap-1">
    <Label htmlFor="campo_b" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Campo B</Label>
    <Input variant="l-border" id="campo_b" value={form.campo_b} onChange={(e) => f('campo_b', e.target.value)} placeholder="..." />
  </div>

  {/* third — inner grid dentro de col-span-2 */}
  <div className="col-span-2 grid grid-cols-3 gap-2">
    <div className="grid gap-1">
      <Label htmlFor="dia" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Dia</Label>
      <Input variant="l-border" id="dia" type="number" value={form.dia} onChange={(e) => f('dia', Number(e.target.value))} />
    </div>
    <div className="grid gap-1">
      <Label htmlFor="mes" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Mes</Label>
      <Input variant="l-border" id="mes" type="number" value={form.mes} onChange={(e) => f('mes', Number(e.target.value))} />
    </div>
    <div className="grid gap-1">
      <Label htmlFor="anio" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Anio</Label>
      <Input variant="l-border" id="anio" type="number" value={form.anio} onChange={(e) => f('anio', Number(e.target.value))} />
    </div>
  </div>
</div>
```

**Reglas:**
- `gap-2` entre campos, `gap-1` dentro de cada wrapper label+input.
- Todos los `<Label>`: `className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}`.
- Todos los `<Input>`: `variant="l-border"`.
- Checkbox en fila mixta → ver **§ J**.
- Geo cascade (pais/depto/municipio) → `<select>` nativo, ver **§ X**.

---

## Q · Page header

```tsx
return (
  <div className="flex flex-col gap-6 p-6 md:p-8">

    {/* ── Header ── */}
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-<accent>-100 p-2.5">
          <<EntityIcon> className="h-5 w-5 text-<accent>-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground"><Entidades en plural></h1>
          <p className="text-sm text-muted-foreground"><Descripción breve></p>
        </div>
      </div>
      {puedeAgregar && (
        <Button onClick={openCreate} className="gap-2 bg-<accent>-600 hover:bg-<accent>-700 text-white">
          <Plus className="h-4 w-4" />
          Nuevo <Entidad singular>
        </Button>
      )}
    </div>

    {/* ── Toolbar ── ver § S */}
    {/* ── Table ── */}
    {/* ── Modal ── ver § R */}
    {/* ── AlertDialog borrado ── ver § K */}

  </div>
)
```

**Reglas:**
- El `<Button>Nuevo</Button>` vive **solo** en el header — no duplicar en toolbar.
- `h1` siempre `text-xl font-bold tracking-tight text-foreground` — nunca con color de acento.
- Acento: ver tabla maestra en `ui-conventions.instructions.md`.

---

## R · Modal JSX completo

```tsx
{/* ── State, computed vars, funciones ── ver § A, B, C antes de este JSX ── */}

<Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
  if (!open && (similarWarning.length > 0 || deleteTarget !== null)) return
  setDialogOpen(open)
  if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
}}>
  <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

    <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-<accent>-50/70 to-transparent border-b border-border/50 shrink-0">
      <div className="flex items-center gap-3 pr-8">
        <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold leading-tight truncate">
            {isEditing && !viewTarget ? 'Nueva <Entidad>' : isEditing ? 'Editar <Entidad>' : viewTarget?.nombre}
          </DialogTitle>
          {viewTarget && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
              <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
            </p>
          )}
        </div>
      </div>
    </DialogHeader>

    <Tabs defaultValue="general" className="mt-0.5 flex flex-col flex-1 min-h-0">
      <div className="shrink-0 w-full">
        <TabsList variant="line" className="">
          <TabsTrigger value="general" className="gap-1.5 rounded-t-sm rounded-b-none border border-b-0 border-primary/50 bg-background px-3 after:hidden data-active:border-primary data-active:bg-background">
            <MapPin className="h-3.5 w-3.5" /> General
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="general" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
        {!isEditing && viewTarget ? (
          /* ── View mode — § O ── */
          <div className="grid grid-cols-2 gap-2">
            {/* ViewField blocks */}
          </div>
        ) : (
          /* ── Edit mode — § P ── */
          <div className="grid grid-cols-2 gap-2">
            {/* form fields */}
          </div>
        )}
      </TabsContent>
    </Tabs>

    <DialogFooter className="mt-4 shrink-0">
      {!isEditing && viewTarget ? (
        <>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
          {puedeModificar && (
            <Button onClick={startEdit} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
        </>
      ) : (
        <>
          <Button variant="outline" onClick={cancelEdit}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>
```



---

## S · Toolbar

**Copiar verbatim** — el orden y la estructura son obligatorios.

```tsx
{/* ── Toolbar ── */}
<div className="flex items-center gap-2">

  {/* Búsqueda — ancho fijo a la izquierda */}
  <div className="relative max-w-xs">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Buscar <entidades>..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="pl-8 h-8 text-sm"
    />
  </div>

  {/* Limpiar filtros — visible solo si hay filtro de columna activo */}
  {hasActiveFilters && (
    <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
      <X className="h-3.5 w-3.5" /> Limpiar filtros
    </Button>
  )}

  {/* Grupo derecho — empujado con ml-auto */}
  <div className="ml-auto flex items-center gap-2">
    {/* Exportar CSV siempre ANTES de ColumnManager */}
    <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, colPrefs)} className="gap-1.5">
      <Download className="h-3.5 w-3.5" /> Exportar CSV
    </Button>
    <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={resetColPrefs} />
  </div>

</div>
```

**Reglas:**
- `hasActiveFilters = Object.keys(colFilters).length > 0` — declarar con las otras constantes derivadas (cerca de `filtered`).
- Search usa `max-w-xs` (fijo) — **nunca** `flex-1`.
- Label siempre **"Exportar CSV"**, nunca "Exportar".
- El wrapper `ml-auto` es obligatorio — empuja Export + ColumnManager al extremo derecho.

---

## T · Función exportCsv

Declarar a **nivel de módulo** (fuera del componente):

```ts
const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])

// COL_LABELS: construir desde sticky column + ALL_COLUMNS
const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: '<sticky-key>', label: '<Sticky Label>' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function exportCsv(rows: <Entity>[], colPrefs: ColPref[]) {
  const keys = ['<sticky-key>', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof <Entity>])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `<entity-slug>-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Nunca exportar:** `cuenta`, `agrego_usuario`, `modifico_usuario`, columna de acciones.

---

## U · Persistencia colPrefs en localStorage

Declarar **dentro del componente**, después de `useState<ColPref[]>(DEFAULT_PREFS)`:

```ts
const STORAGE_KEY = `<entity>_cols_v1_${userId}`
const [colPrefs, setColPrefs] = useState<ColPref[]>(DEFAULT_PREFS)

// Cargar preferencias guardadas al montar
useEffect(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: ColPref[] = JSON.parse(raw)
    const knownKeys = new Set(parsed.map((p) => p.key))
    setColPrefs([
      ...parsed.filter((p) => ALL_COLUMNS.some((c) => c.key === p.key)),
      ...DEFAULT_PREFS.filter((p) => !knownKeys.has(p.key)),
    ])
  } catch { /* ignore */ }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

function saveColPrefs(next: ColPref[]) {
  setColPrefs(next)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
}
function toggleCol(key: string) {
  saveColPrefs(colPrefs.map((p) => p.key === key ? { ...p, visible: !p.visible } : p))
}
function moveCol(key: string, dir: -1 | 1) {
  saveColPrefs(colPrefs.map((p, i, arr) => {
    const swap = i + dir
    if (p.key !== key && arr[i + dir]?.key !== key) return p
    return swap >= 0 && swap < arr.length ? arr[i + dir] : p
  }).sort((a, b) => {
    // re-implementation via index swap
    const idxA = colPrefs.findIndex((p) => p.key === a.key)
    const idxB = colPrefs.findIndex((p) => p.key === b.key)
    return idxA - idxB
  }))
}
function resetColPrefs() { saveColPrefs(DEFAULT_PREFS) }
```

> **Nota:** `moveCol` puede simplificarse copiando el patrón existente de `series-recibos/_client.tsx` que usa índice directo. La lógica clave es: encontrar el índice, intercambiar con el vecino `dir`, llamar `saveColPrefs`.

**Regla STORAGE_KEY:** siempre incluir `${userId}` — las preferencias son por usuario, no globales.

---

## V · Pipeline de filtrado

Declarar **dentro del componente**, después de `setColFilter`:

```ts
type ColFilters = Record<string, Set<string>>
const [colFilters, setColFilters] = useState<ColFilters>({})

function setColFilter(col: string, next: Set<string>) {
  setColFilters((prev) => {
    const u = { ...prev }
    if (next.size === 0) delete u[col]
    else u[col] = next
    return u
  })
}

// ── FK lookup maps — clave siempre compuesta, NUNCA solo `codigo` ──────────
//   empresaMap:  Map<number, string>  key = empresa.codigo
//   proyectoMap: Map<string, string>  key = `${empresa}-${codigo}`
//   faseMap:     Map<string, string>  key = `${empresa}-${proyecto}-${codigo}`
//   (ídem para bancoMap, supervisorMap, cobradorMap, coordinadorMap, vendedorMap)
//
// const empresaMap   = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
// const proyectoMap  = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
// const faseMap      = useMemo(() => new Map(fases.map((f)     => [`${f.empresa}-${f.proyecto}-${f.codigo}`, f.nombre])), [fases])
//
// Unique values para ColumnFilter:
const uniqueEmpresaNames  = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa) ?? ''))].sort(), [initialData, empresaMap])
const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? ''))].sort(), [initialData, proyectoMap])
// Añadir un useMemo por cada columna filtrable adicional

// Paso 1 — filtrar por texto de búsqueda
const afterSearch = useMemo(() => {
  const q = search.toLowerCase()
  return !q ? initialData : initialData.filter((r) =>
    r.<campo1>.toLowerCase().includes(q) ||
    (r.<campo2> ?? '').toLowerCase().includes(q) ||
    (empresaMap.get(r.empresa) ?? '').toLowerCase().includes(q)
  )
}, [initialData, search, empresaMap])

// Paso 2 — aplicar filtros de columna
const filtered = useMemo(() =>
  afterSearch.filter((r) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa')  return vals.has(empresaMap.get(r.empresa) ?? '')
      if (col === 'proyecto') return vals.has(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '')
      if (col === 'activo')   return vals.has(r.activo === 1 ? 'Sí' : 'No')
      // Añadir un case por cada FK o enum con traducción
      return vals.has(String(r[col as keyof <Entity>] ?? ''))
    })
  ),
  [afterSearch, colFilters, empresaMap, proyectoMap]
)

const hasActiveFilters = Object.keys(colFilters).length > 0
```

---

## Y · Campo activo

**Tabla (cell renderer):**
```tsx
case 'activo':
  return (
    <TableCell key="activo">
      {row.activo === 1
        ? <Badge variant="secondary" className="font-normal bg-emerald-100 text-emerald-700">Activo</Badge>
        : <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">Inactivo</Badge>}
    </TableCell>
  )
```

**Vista (view mode) — Checkbox card:**
```tsx
<div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
  <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Activo</span>
  <Checkbox checked={!!viewTarget.activo} disabled />
</div>
```

**Edición (edit mode) — Checkbox libre:**
```tsx
{/* Si activo es el único campo en su fila — § I */}
<div className="col-span-2 flex items-center gap-2 py-1">
  <Checkbox id="activo" checked={!!form.activo} onCheckedChange={(c) => setForm((p) => ({ ...p, activo: c ? 1 : 0 }))} />
  <Label htmlFor="activo" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Activo</Label>
</div>

{/* Si activo comparte fila con otro campo — § J (requiere items-end en padre y pb-1 en wrapper) */}
```

**ColumnFilter values para activo:**
```ts
const uniqueActivoValues = ['Sí', 'No']
// En filtered useMemo:
if (col === 'activo') return vals.has(r.activo === 1 ? 'Sí' : 'No')
```

---

## Z · Textarea + Input fecha

**Textarea:**
```tsx
<div className="col-span-2 grid gap-1">
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text>
  </Label>
  <textarea
    id="<field>"
    value={form.<field>}
    onChange={(e) => f('<field>', e.target.value)}
    placeholder="<Sentence case placeholder>"
    rows={3}
    className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
  />
</div>
```

**Input fecha (ISO string `YYYY-MM-DD`):**
```tsx
<div className="grid gap-1">
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text>
  </Label>
  <Input
    id="<field>"
    type="date"
    value={form.<field> ?? ''}
    onChange={(e) => setForm((p) => ({ ...p, <field>: e.target.value || null }))}
  />
</div>
```

> Las fechas no pasan por `f()` porque no son texto normalizable. Usar `setForm` directamente es correcto para campos `type="date"`.

---

## AD · Input numérico con sufijo de unidad (adornment)

Usar cuando un campo numérico lleva una unidad de medida reactiva a la derecha (p.ej. `extension` en lotes, donde la unidad viene de la fase seleccionada).

### State local (separado del `form`)

```ts
const [<field>Str, set<Field>Str] = useState('')
```

El string se mantiene separado del `form` para preservar la entrada del usuario mientras tipea (evitar pérdida de decimales).

### Helper de unidad

```ts
function get<Unit>(faseCode: number) {
  return fases.find((f) => f.codigo === faseCode)?.medida ?? ''
}
// Usar como computed value en el render:
const medida = get<Unit>(form.fase)
```

### Inicialización en openCreate()

```ts
set<Field>Str('')
```

### Inicialización en openView() y cancelEdit()

```ts
set<Field>Str(String(viewTarget.<field>))
```

### JSX — edit mode

```tsx
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}><Label text> *</Label>
  <div className="flex gap-2 items-center">
    <Input
      type="number"
      min={0}
      step="0.01"
      value={<field>Str}
      onChange={(e) => set<Field>Str(e.target.value)}
      placeholder="0.00"
      className="flex-1"
    />
    {medida && <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{medida}</span>}
  </div>
</div>
```

### JSX — view mode (ViewField)

```tsx
<ViewField
  label="<Label text>"
  value={viewTarget.<field> ? `${fmt(viewTarget.<field>)} ${get<Unit>(viewTarget.fase)}` : ''}
/>
```

### Table cell

```tsx
case '<field>':
  return (
    <TableCell key="<field>" className="tabular-nums text-right whitespace-nowrap">
      {fmt(row.<field>)} {get<Unit>(row.fase)}
    </TableCell>
  )
```

### En handleSave() — parse antes de enviar

```ts
const <field> = parseFloat(<field>Str) || form.<field>
// Incluir <field> en el payload, no form.<field>
```

---

## AE · Selection Buttons — Radio group visual

Usar cuando hay exactamente 2-3 opciones mutuamente excluyentes que representan modos/estados con campos dependientes visualmente diferentes (p.ej. Eventual vs Estado Cuenta en Tipos de Ingresos). No usar para selects con más opciones — usar § G.

### Helper de estilos (computed value, en el cuerpo del componente)

```ts
const selBtnCls = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-<accent>-100 border-<accent>-400 text-<accent>-700'
      : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/70'
  }`
```

> Reemplazar `<accent>` por el color del módulo (p.ej. `yellow` para cuentas-cobrar). Ver `ui-conventions.instructions.md` para la tabla de colores por módulo.

### State local

```ts
const [modo, setModo] = useState<'<opcionA>' | '<opcionB>'>('<opcionA>')
```

### Init en openCreate()

```ts
setModo('<opcionA>')  // valor por defecto
```

### Init en openView() y cancelEdit()

```ts
// Derivar el modo del valor guardado en la entidad:
setModo(entity.<campo> === <valorA> ? '<opcionA>' : '<opcionB>')
```

### JSX — view mode (botones deshabilitados)

```tsx
<div className="col-span-2 flex gap-3">
  <button type="button" className={selBtnCls(<condition_A>)} disabled>
    <Etiqueta A>
  </button>
  <button type="button" className={selBtnCls(<condition_B>)} disabled>
    <Etiqueta B>
  </button>
</div>
```

### JSX — edit mode (botones activos, deshabilitados si `!isEditing`)

```tsx
<div className="col-span-2 flex gap-3">
  <button type="button" className={selBtnCls(modo === '<opcionA>')}
    onClick={() => setModo('<opcionA>')} disabled={!isEditing}>
    <Etiqueta A>
  </button>
  <button type="button" className={selBtnCls(modo === '<opcionB>')}
    onClick={() => setModo('<opcionB>')} disabled={!isEditing}>
    <Etiqueta B>
  </button>
</div>
```

### Campos dependientes del modo

Renderizar condicionalmente debajo de los botones:

```tsx
{modo === '<opcionA>' && (
  <div className="col-span-2 ...">
    {/* campos de <opcionA> */}
  </div>
)}
{modo === '<opcionB>' && (
  <div className="col-span-2 ...">
    {/* campos de <opcionB> */}
  </div>
)}
```

### En handleSave() — mapear modo a valor numérico antes de enviar

```ts
const <campo> = modo === '<opcionA>' ? <valorA> : <valorB>
// Incluir en el payload
```

---

## AF · AuditLogDialog — Historial de cambios

Mostrar en **todas** las pantallas CRUD. Permite ver el historial completo de INSERT/UPDATE/DELETE de un registro.

### Import

```ts
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
```

### State (ya está en §A)

```ts
const [auditTarget, setAuditTarget] = useState<<Entity> | null>(null)  // full row
```

### Dropdown item (ya está en §L)

```tsx
<DropdownMenuItem onClick={() => setAuditTarget(row)}>
  <History className="mr-2 h-4 w-4" />
  Historial
</DropdownMenuItem>
```

### JSX del componente

Agregar **antes** del `</div>` de cierre del componente, después del AlertDialog de borrado:

```tsx
{/* ── Historial ── */}
{auditTarget && (
  <AuditLogDialog
    open={!!auditTarget}
    onOpenChange={(o) => !o && setAuditTarget(null)}
    tabla="<t_nombre_tabla>"
    cuenta={auditTarget.cuenta}
    registroId={<registroId>}
    titulo={auditTarget.nombre}
  />
)}
```

### Campo `registroId` según jerarquía de la entidad

Debe coincidir **exactamente** con lo que `writeAudit` almacena en la action de la entidad.

| Entidad | `registroId` |
|---------|-------------|
| Empresa | `{{ codigo: auditTarget.codigo }}` |
| Proyecto | `{{ empresa: auditTarget.empresa, codigo: auditTarget.codigo }}` |
| Fase, Banco, CuentaBancaria, TipoIngreso, Vendedor, Cobrador, Coordinador, Supervisor, Cliente | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, codigo: auditTarget.codigo }}` |
| Manzana | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, fase: auditTarget.fase, codigo: auditTarget.codigo }}` |
| Lote | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, fase: auditTarget.fase, manzana: auditTarget.manzana, codigo: auditTarget.codigo }}` |
| SerieRecibo | `{{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, serie: auditTarget.serie }}` (campo `serie`, no `codigo`) |

> **REGLA:** el `registroId` debe incluir **todos** los campos que forman la clave primaria compuesta de la tabla — los mismos que la action almacena en `registro_id` de `t_audit_log`. Usar el operador `cs` (JSON containment) de PostgREST garantiza que no haya colisiones entre registros de diferentes proyectos que compartan el mismo `codigo`.

### `titulo` cuando no hay campo `nombre`

- `Manzana`: `titulo={\`Manzana ${auditTarget.codigo}\``}
- `Lote`: `titulo={auditTarget.codigo}`
- `SerieRecibo`: `titulo={\`Serie ${auditTarget.serie}\``}

---

## AG · Modal ancho — 2 columnas con separador vertical

Usar cuando el modal tiene **3 o más secciones**, o **12+ campos** en total, y una sola columna resultaría en una lista excesivamente larga. Primera pantalla validada: `lotes/_client.tsx`.

### Cuándo usar wide vs narrow

| Condición | Modal a usar |
|-----------|-------------|
| 1–2 secciones, ≤ 10 campos | Narrow `sm:max-w-[36rem]` — **§ R** |
| 3+ secciones, o ≥ 12 campos | Wide `sm:max-w-[64rem]` — **§ AG** |

### DialogContent

```tsx
<DialogContent className="flex flex-col w-[90vw] sm:max-w-[64rem] h-[700px] max-h-[90vh] overflow-hidden">
```

### Contenedor de 2 columnas

Este `<div>` reemplaza el `<div className="grid grid-cols-2 gap-3">` estándar del § O / § P.  
Aplica **exactamente igual** en modo vista y en modo edición (solo cambia `gap-3` → `gap-4` en el inner grid de edición).

```tsx
<div className="flex gap-6 items-start">

  {/* Columna izquierda */}
  <div className="flex-1 grid grid-cols-2 gap-3">   {/* gap-4 en edit mode */}
    <SectionDivider label="SECCION A" />
    {/* campos de la sección A */}
    <SectionDivider label="SECCION B" />
    {/* campos de la sección B */}
  </div>

  {/* Separador vertical */}
  <div className="w-px self-stretch bg-primary/30" />

  {/* Columna derecha */}
  <div className="flex-1 grid grid-cols-2 gap-3">   {/* gap-4 en edit mode */}
    <SectionDivider label="SECCION C" />
    {/* campos de la sección C */}
    <SectionDivider label="SECCION D" />
    {/* campos de la sección D */}
  </div>

</div>
```

### Columna derecha vacía (reservada para contenido futuro)

Cuando una pestaña todavía no tiene contenido en la columna derecha, usar un `div` vacío para mantener la estructura simétrica:

```tsx
<div className="w-px self-stretch bg-primary/30" />
<div className="flex-1" />
```

### Reglas

- **`gap-6`** en el flex exterior — provee 24 px a cada lado del separador. No reducir.
- **`SectionDivider`** tiene `col-span-2` hardcodeado → funciona correctamente dentro de `flex-1 grid grid-cols-2`.
- **Anchos de campo** dentro de cada columna: `(full)` = `col-span-2`, `(half)` = una celda, `(third)` = igual que el estándar (ver `crud-screens.instructions.md`). Las reglas no cambian respecto al modal estrecho.
- **Color del separador:** `bg-primary/30` — mismo tono que el acento del módulo. **No** usar colores de acento de módulo distintos.
- **Distribución de secciones:** máximo ~3 secciones por columna. Distribuir equilibrando la altura visual entre columnas izquierda y derecha.
- El `TabsContent` que envuelve este layout mantiene `className="mt-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"` sin cambios.

