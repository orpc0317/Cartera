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
| W | Select moneda con bandera |
| X | Select geo nativo (país / departamento / municipio) |
| Y | Campo activo: badge en tabla, card en vista, checkbox en edición |
| Z | Textarea + Input fecha |
| AA | CountrySelect (selector de país con bandera + cascade) |
| AB | ClienteCombobox (select buscable por texto) |
| AC | LogoUploadField (carga de imagen / logo) |
| AD | Input numérico con sufijo de unidad (adornment) |
| AE | Selection Buttons (radio group visual) |

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
const [auditTarget, setAuditTarget]       = useState<number | null>(null)
const [auditOpen, setAuditOpen]           = useState(false)
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

// Subtitle shown below entity name in modal header — pick ONE pattern:
const subtitle = viewTarget ? (empresaMap.get(viewTarget.empresa) ?? '') : ''                   // single FK label
// const subtitle = viewTarget ? [empresaMap.get(viewTarget.empresa), proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`)].filter(Boolean).join(' · ') : ''  // two FK labels
// const subtitle = ''  // entity has no meaningful secondary label
```

---

## C · Modal — Functions

Copy all five. In `startEdit` list every `<EntityForm>` field. Replace `create<Entity>` / `update<Entity>` with the actual action import names.

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

---

## D · Form — Text Input

Requires `f()` helper (see `ui-conventions.instructions.md § Text input normalization`).

```tsx
<div className="grid gap-1">
  <Label htmlFor="<field>" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
    <Label text> *
  </Label>
  <Input
    id="<field>"
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
  <SelectTrigger className="w-full">
    <SelectValue placeholder="<Selecciona opcion>">
      {(v: string) => v && v !== '0' ? (<entityMap>.get(Number(v)) ?? v) : null}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {<entities>.map((e) => (
      <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>
    ))}
  </SelectContent>
</Select>
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
  <SelectTrigger className="w-full">
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
  <SelectTrigger className="w-full">
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
  <Label htmlFor="<field>" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
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
    <Label htmlFor="<field1>" className="text-[11px] font-semibold tracking-wider text-muted-foreground"><Label 1></Label>
    <Select ...>...</Select>
  </div>
  {/* Checkbox wrapper — note pb-1 */}
  <div className="flex items-center gap-2 pb-1">
    <Checkbox
      id="<field2>"
      checked={!!form.<field2>}
      onCheckedChange={(c) => setForm((p) => ({ ...p, <field2>: c ? 1 : 0 }))}
    />
    <Label htmlFor="<field2>" className="text-[11px] font-semibold tracking-wider text-muted-foreground"><Label 2></Label>
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
    <AlertDialogActions>
      <AlertDialogClose render={<Button variant="outline" />}>Cancelar</AlertDialogClose>
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
    </AlertDialogActions>
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
  <DropdownMenuItem onClick={() => { setAuditTarget(row.codigo); setAuditOpen(true) }}>
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

```tsx
function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">{label}</span>
      <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
        <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
      </div>
    </div>
  )
}

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

### Reglas ViewField

- **Texto:** pasar el valor crudo; `ViewField` muestra en blanco si es `null`/`undefined`/`''`. Nunca pasar `|| '—'`.
- **Numérico:** si `0` significa "no definido", guardar en el call site: `value={viewTarget.valor ? fmt(viewTarget.valor) : ''}`. Si `0` es válido (p.ej. `dias_gracia`), pasar `fmt(x)` directo.
- **Códigos numéricos auto-increment:** mostrar como `String(viewTarget.codigo)` — nunca con `#` prefix.

---

## O · Grid modo vista (view mode)

```tsx
<div className="grid grid-cols-2 gap-3">
  <SectionDivider label="SECCION" />

  {/* full — ocupa toda la fila */}
  <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>

  {/* half — dos campos por fila */}
  <ViewField label="Campo A" value={viewTarget.campo_a} />
  <ViewField label="Campo B" value={viewTarget.campo_b} />

  {/* third — tres campos por fila; inner grid dentro de col-span-2 */}
  <div className="col-span-2 grid grid-cols-3 gap-3">
    <ViewField label="Dia"  value={String(viewTarget.dia)} />
    <ViewField label="Mes"  value={String(viewTarget.mes)} />
    <ViewField label="Anio" value={String(viewTarget.anio)} />
  </div>

  {/* boolean — checkbox libre, sin card container */}
  <div className="flex items-center gap-2 py-1">
    <Checkbox checked={!!viewTarget.activo} disabled />
    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Activo</span>
  </div>
</div>
```

---

## P · Grid modo edición (edit mode)

```tsx
<div className="grid grid-cols-2 gap-4">
  <SectionDivider label="SECCION" />

  {/* full */}
  <div className="col-span-2 grid gap-1">
    <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre *</Label>
    <Input id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del registro" />
  </div>

  {/* half */}
  <div className="grid gap-1">
    <Label htmlFor="campo_a" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Campo A</Label>
    <Input id="campo_a" value={form.campo_a} onChange={(e) => f('campo_a', e.target.value)} placeholder="..." />
  </div>
  <div className="grid gap-1">
    <Label htmlFor="campo_b" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Campo B</Label>
    <Input id="campo_b" value={form.campo_b} onChange={(e) => f('campo_b', e.target.value)} placeholder="..." />
  </div>

  {/* third — inner grid dentro de col-span-2 */}
  <div className="col-span-2 grid grid-cols-3 gap-4">
    <div className="grid gap-1">
      <Label htmlFor="dia" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Dia</Label>
      <Input id="dia" type="number" value={form.dia} onChange={(e) => f('dia', Number(e.target.value))} />
    </div>
    <div className="grid gap-1">
      <Label htmlFor="mes" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Mes</Label>
      <Input id="mes" type="number" value={form.mes} onChange={(e) => f('mes', Number(e.target.value))} />
    </div>
    <div className="grid gap-1">
      <Label htmlFor="anio" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Anio</Label>
      <Input id="anio" type="number" value={form.anio} onChange={(e) => f('anio', Number(e.target.value))} />
    </div>
  </div>
</div>
```

**Reglas:**
- `gap-4` entre campos, `gap-1` dentro de cada wrapper label+input.
- Todos los `<Label>`: `className="text-[11px] font-semibold tracking-wider text-muted-foreground"`.
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

    <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-<accent>-50/70 to-transparent border-b border-border/50 shrink-0">
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

    <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0">
        <TabsTrigger value="general" className="gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> General
        </TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {!isEditing && viewTarget ? (
          /* ── View mode — § O ── */
          <div className="grid grid-cols-2 gap-3">
            {/* ViewField blocks */}
          </div>
        ) : (
          /* ── Edit mode — § P ── */
          <div className="grid grid-cols-2 gap-4">
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

### Icon badge por modo

| Modo | `iconBadgeBg` | `iconBadgeClr` | Ícono |
|------|--------------|----------------|-------|
| Vista | `bg-<accent>-100` | `text-<accent>-600` | `<EntityIcon>` |
| Crear | `bg-<accent>-100` | `text-<accent>-600` | `<Plus>` |
| Editar | `bg-amber-100` | `text-amber-600` | `<Pencil>` |

Ver cálculo completo en **§ B**.

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

**Nunca exportar:** `cuenta`, `agrego_usuario`, `modifico_usuario`, columna de acciones. El nombre del archivo viene de la sección `EXPORTACION` del spec.

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

// ── FK lookup maps ─────────────────────────────────────────────────────────
// REGLA: las PKs de Empresa son (cuenta,codigo); de Proyecto son (cuenta,empresa,codigo);
// de Fase/Banco/Supervisor/Cobrador/Coordinador/Vendedor son (cuenta,empresa,proyecto,codigo).
// Por eso los mapas NUNCA usan solo `codigo` como clave — siempre clave compuesta:
//   empresaMap:    Map<number, string>    key = empresa.codigo          (Empresa.PK es única por cuenta)
//   proyectoMap:   Map<string, string>    key = `${empresa}-${codigo}`
//   faseMap:       Map<string, string>    key = `${empresa}-${proyecto}-${codigo}`
//   (ídem para bancoMap, supervisorMap, cobradorMap, coordinadorMap, vendedorMap)
//
// const empresaMap   = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
// const proyectoMap  = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
// const faseMap      = useMemo(() => new Map(fases.map((f)     => [`${f.empresa}-${f.proyecto}-${f.codigo}`, f.nombre])), [fases])
//
// Lookups:
//   empresaMap.get(row.empresa)
//   proyectoMap.get(`${row.empresa}-${row.proyecto}`)
//   faseMap.get(`${row.empresa}-${row.proyecto}-${row.fase}`)
//
// SelectValue render prop:
//   {(v: string) => v ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
//
// Unique values para ColumnFilter dropdowns
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

## W · Select moneda con bandera

Constante de módulo (fuera del componente):

```ts
const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])
```

**Tabla (cell renderer):**
```tsx
case 'moneda': {
  const flag = CURRENCY_FLAG_MAP.get(row.moneda)
  return (
    <TableCell key="moneda" className="text-muted-foreground">
      {flag ? (
        <span className="flex items-center gap-1.5">
          <img src={`https://flagcdn.com/w20/${flag}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
          {row.moneda}
        </span>
      ) : row.moneda || '—'}
    </TableCell>
  )
}
```

**Edit mode:**
```tsx
<Select value={form.moneda} onValueChange={(v) => f('moneda', v)}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Selecciona moneda">
      {(v: string) => {
        const flag = CURRENCY_FLAG_MAP.get(v)
        return flag ? (
          <span className="flex items-center gap-1.5">
            <img src={`https://flagcdn.com/w20/${flag}.png`} alt={v} width={20} height={14} className="object-cover rounded-sm shrink-0" />
            {v}
          </span>
        ) : v || null
      }}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {monedas.map((m) => {
      const flag = CURRENCY_FLAG_MAP.get(m.codigo)
      return (
        <SelectItem key={m.codigo} value={m.codigo}>
          <span className="flex items-center gap-2">
            {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} alt={m.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
            {m.codigo}
          </span>
        </SelectItem>
      )
    })}
  </SelectContent>
</Select>
```

**ViewField:**
```tsx
{(() => {
  const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda ?? '')
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda</span>
      <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
        {flag ? (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <img src={`https://flagcdn.com/w20/${flag}.png`} alt={viewTarget.moneda ?? ''} width={20} height={14} className="object-cover rounded-sm shrink-0" />
            {viewTarget.moneda}
          </span>
        ) : <span className="text-sm font-medium">{viewTarget.moneda || '—'}</span>}
      </div>
    </div>
  )
})()}
```

**ColumnFilter — unique values para el filtro de la columna moneda:**
```ts
// uniqueValues — solo el código ISO (sin nombre)
const uniqueMonedaLabels = useMemo(() =>
  [...new Set(initialData.map((r) => r.moneda))].sort(),
  [initialData]
)
// En filtered useMemo:
if (col === 'moneda') return vals.has(r.moneda)
```

**Origen:** llamar `getMonedas()` en `page.tsx` dentro de `Promise.all`, pasar como prop `monedas: Moneda[]`. Nunca usar lista hardcodeada.

---

## X · Select geo nativo (pais / departamento / municipio)

Usar `<select>` HTML nativo — **no** el `<Select>` de Base UI — para estos tres campos.

```tsx
{/* Clase estándar para los tres niveles */}
{/* className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50" */}

{/* País */}
<div className="grid gap-1">
  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Pais</Label>
  <select
    value={form.pais}
    onChange={(e) => f('pais', e.target.value)}
    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <option value="">Selecciona país</option>
    {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
  </select>
</div>

{/* Departamento — filtrado por pais */}
<div className="grid gap-1">
  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Departamento</Label>
  <select
    value={form.departamento}
    onChange={(e) => f('departamento', e.target.value)}
    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <option value="">Selecciona departamento</option>
    {departamentos.filter((d) => d.pais === form.pais).map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
  </select>
</div>

{/* Municipio — filtrado por pais + departamento */}
<div className="grid gap-1">
  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Municipio</Label>
  <select
    value={form.municipio}
    onChange={(e) => f('municipio', e.target.value)}
    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <option value="">Selecciona municipio</option>
    {municipios.filter((m) => m.pais === form.pais && m.departamento === form.departamento).map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
  </select>
</div>
```

**Reglas:**
- Pre-selección en `openCreate()` → ver `crud-screens.instructions.md § Country/Geo pre-selection`.
- En vista (`ViewField`): resolver código → nombre via los props arrays; mostrar bandera del país.
- Nunca mostrar el código raw de pais/depto/municipio en la UI.

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
  <Label htmlFor="activo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Activo</Label>
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
  <Label htmlFor="<field>" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
    <Label text>
  </Label>
  <textarea
    id="<field>"
    value={form.<field>}
    onChange={(e) => f('<field>', e.target.value)}
    placeholder="<Sentence case placeholder>"
    rows={3}
    className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
  />
</div>
```

**Input fecha (ISO string `YYYY-MM-DD`):**
```tsx
<div className="grid gap-1">
  <Label htmlFor="<field>" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
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

## AA · CountrySelect — Selector de país con bandera y cascade

Usa el componente `<CountrySelect>` de `@/components/ui/country-select` — **nunca** recrear la lógica inline.

### Import

```ts
import { CountrySelect } from '@/components/ui/country-select'
```

### State local (en el componente principal)

```ts
const [paisCodigo, setPaisCodigo]   = useState('')
const [deptoCodigo, setDeptoCodigo] = useState('')
```

Estos son **separados** de `form.direccion_pais` / `form.direccion_departamento`: los native `<select>` de departamento y municipio los consumen directamente para su filtrado en tiempo real.

### JSX — edit mode

```tsx
<div className="grid gap-1">
  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Pais *</Label>
  <CountrySelect
    paises={paises}
    value={paisCodigo}
    onChange={(codigo, _nombre) => {
      setPaisCodigo(codigo)
      setDeptoCodigo('')
      const autoMoneda = countryToCurrency[codigo] ?? form.moneda
      setForm((prev) => ({
        ...prev,
        direccion_pais: codigo,
        direccion_departamento: '',
        direccion_municipio: '',
        moneda: autoMoneda,
      }))
    }}
  />
</div>
```

> `countryToCurrency` proviene de `COUNTRY_CURRENCY_MAP` en `src/lib/constants.ts` — ver `ui-conventions.instructions.md § Currency pre-selection from country`.

### JSX — view mode

Usar un `ViewField` con bandera construida desde el código ISO:

```tsx
<ViewField
  label="Pais"
  value={viewTarget.direccion_pais
    ? paises.find((p) => p.codigo === viewTarget.direccion_pais)?.nombre ?? viewTarget.direccion_pais
    : ''}
/>
```

### Inicialización en openCreate()

```ts
const defIso = empresa?.direccion_pais ?? ''
const defMoneda = countryToCurrency[defIso] ?? 'GTQ'
setPaisCodigo(defIso)
setDeptoCodigo('')
setForm((prev) => ({ ...prev, direccion_pais: defIso, direccion_departamento: '', direccion_municipio: '', moneda: defMoneda }))
```

### Inicialización en openView() y cancelEdit()

```ts
const pCode = entity.direccion_pais ?? ''
const dCode = entity.direccion_departamento ?? ''
setPaisCodigo(pCode)
setDeptoCodigo(dCode)
setForm((prev) => ({ ...prev, direccion_pais: pCode, direccion_departamento: dCode }))
```

---

## AB · ClienteCombobox — Select buscable por texto

Combobox con búsqueda de texto libre para entidades que pueden tener muchos registros (p.ej. clientes). Definir como función interna **antes** del componente principal.

### Imports adicionales

```ts
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
// Icons: Search, X, ChevronDown ya deben estar en el bloque de imports de lucide-react
```

### Definición del componente (antes del componente principal)

```tsx
function ClienteCombobox({
  clientes, value, onChange, disabled, placeholder,
}: {
  clientes: Cliente[]
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>()

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q))
  }, [clientes, query])

  const selected = clientes.find((c) => c.codigo === value)

  useEffect(() => {
    if (open) {
      if (wrapperRef.current) setPopoverWidth(wrapperRef.current.offsetWidth)
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setQuery('')
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={
          <button
            type="button"
            disabled={disabled}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`truncate ${!selected ? 'text-muted-foreground' : ''}`}>
              {selected ? selected.nombre : (placeholder ?? 'Selecciona...')}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        } />
        <PopoverContent
          align="start"
          className="p-0 overflow-hidden"
          style={popoverWidth ? { width: popoverWidth } : undefined}
        >
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" title="Limpiar búsqueda" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.codigo}
                  type="button"
                  className={`flex w-full cursor-default items-center px-3 py-2 text-sm hover:bg-accent ${
                    c.codigo === value ? 'bg-accent/40 font-medium' : 'text-foreground/80'
                  }`}
                  onClick={() => { onChange(c.codigo); setOpen(false) }}
                >
                  <span className="flex-1 truncate text-left">{c.nombre}</span>
                  {c.codigo === value && <span className="ml-2 shrink-0 text-teal-600">✓</span>}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

### Filtrado en el componente principal (cascade por proyecto)

```ts
const clientesFiltrados = useMemo(
  () => clientes.filter((c) => c.proyecto === form.proyecto),
  [clientes, form.proyecto]
)
```

### Uso en JSX

```tsx
<div className="grid gap-1">
  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Cliente *</Label>
  <ClienteCombobox
    clientes={clientesFiltrados}
    value={form.cliente}
    onChange={(v) => f('cliente', v)}
    disabled={!isEditing}
    placeholder="Selecciona cliente..."
  />
</div>
```

> **Regla:** el `ClienteCombobox` **nunca** se auto-selecciona al cambiar de proyecto — el usuario siempre debe elegirlo explícitamente. Al cambiar de proyecto, hacer `f('cliente', 0)` para limpiar.

---

## AC · LogoUploadField — Carga de imagen / logo

Usar solo en pantallas que tengan un campo `logo_url`. Leer también `image-upload.instructions.md` para las reglas de seguridad de la Server Action.

### Imports adicionales

```ts
import { ImageIcon, AlertCircle } from 'lucide-react'
import { useCallback } from 'react'
import { uploadProjectLogo } from '@/app/actions/<entidad>'
```

### Constantes y `validateLogoFile` (module-level, antes del componente)

```ts
const LOGO_ACCEPT   = 'image/png,image/jpeg,image/webp,image/svg+xml'
const LOGO_MAX_BYTES = 5 * 1024 * 1024   // 5 MB
const LOGO_MIN_DIM  = 200
const LOGO_MAX_DIM  = 4000

async function validateLogoFile(file: File): Promise<string | null> {
  const allowed = LOGO_ACCEPT.split(',')
  if (!allowed.includes(file.type)) return 'Formato no permitido. Use PNG, JPG, WebP o SVG.'
  if (file.size > LOGO_MAX_BYTES) return 'El archivo supera el tamaño máximo de 5 MB.'
  if (file.type === 'image/svg+xml') return null // SVG: omitir verificación de dimensiones
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width < LOGO_MIN_DIM || img.height < LOGO_MIN_DIM)
        resolve(`Dimensiones mínimas ${LOGO_MIN_DIM}×${LOGO_MIN_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else if (img.width > LOGO_MAX_DIM || img.height > LOGO_MAX_DIM)
        resolve(`Dimensiones máximas ${LOGO_MAX_DIM}×${LOGO_MAX_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else resolve(null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('No se pudo leer la imagen.') }
    img.src = url
  })
}
```

### Componente `LogoUploadField` (antes del componente principal)

```tsx
function LogoUploadField({
  displayUrl, fileName, onFileSelect, onRemove, error, disabled,
}: {
  displayUrl: string
  fileName: string
  onFileSelect: (file: File) => void
  onRemove: () => void
  error: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  return (
    <div className="space-y-1.5">
      <Label>Logo</Label>
      {displayUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
          <img src={displayUrl} alt="Logo" className="h-14 w-14 shrink-0 rounded object-contain bg-white border border-border" />
          <div className="min-w-0 flex-1">
            {fileName && <p className="truncate text-xs font-medium">{fileName}</p>}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB · mín. {LOGO_MIN_DIM}×{LOGO_MIN_DIM}px</p>
          </div>
          {!disabled && (
            <div className="flex gap-1 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}
                className="h-7 px-2 text-xs">Cambiar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <span className="text-muted-foreground">Haz clic o arrastra una imagen</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB · mín. {LOGO_MIN_DIM}×{LOGO_MIN_DIM}px</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={LOGO_ACCEPT} aria-label="Seleccionar logo" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = '' }} />
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}
```

### State en el componente principal

```ts
const [logoFile, setLogoFile]           = useState<File | null>(null)
const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
const [logoError, setLogoError]         = useState('')
```

### Handlers (con `useCallback`)

```ts
const handleLogoSelect = useCallback(async (file: File) => {
  const err = await validateLogoFile(file)
  if (err) { setLogoError(err); return }
  setLogoError('')
  if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
  setLogoFile(file)
  setLogoPreviewUrl(URL.createObjectURL(file))
}, [logoPreviewUrl])

const handleLogoRemove = useCallback(() => {
  if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
  setLogoFile(null); setLogoPreviewUrl('')
  setLogoError('')
  setForm((prev) => ({ ...prev, logo_url: '' }))
}, [logoPreviewUrl])
```

### Reset en openCreate() / openView() / cancelEdit()

```ts
setLogoFile(null); setLogoPreviewUrl(''); setLogoError('')
```

### En doSave() — subir antes de la mutación

```ts
if (logoFile) {
  const fd = new FormData()
  fd.append('file', logoFile)
  const up = await upload<Entity>Logo(fd, viewTarget?.logo_url ?? undefined)
  if (up.error) { toast.error(up.error); return }
  payload = { ...payload, logo_url: up.url ?? '' }
}
```

### Uso en JSX (edit/create mode)

```tsx
<div className="col-span-2">
  <LogoUploadField
    displayUrl={logoPreviewUrl || form.logo_url || ''}
    fileName={logoFile?.name ?? ''}
    onFileSelect={handleLogoSelect}
    onRemove={handleLogoRemove}
    error={logoError}
    disabled={!isEditing}
  />
</div>
```

### Uso en JSX (view mode)

```tsx
{viewTarget.logo_url ? (
  <img
    src={viewTarget.logo_url}
    alt="Logo"
    className="h-20 w-20 rounded-lg object-contain border border-border bg-white"
  />
) : (
  <span className="text-sm text-muted-foreground">Sin logo</span>
)}
```

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
  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground"><Label text> *</Label>
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
