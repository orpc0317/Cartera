# Snippets — tabla

Copia la sección verbatim y reemplaza los placeholders `<angle-bracket>`. No inventes otra variante del control. El patrón de pantalla (`.cursor/rules/patterns.mdc`) define el layout y no cambia cómo se ve un Input, un Select o un Checkbox. Si el control no está en estas secciones, detente y pregunta.

Cursor no inyecta este archivo. Ábrelo cuando el skill `crud-screen` lo nombre.

Secciones: M, Q, S, T, U, V. Las constantes de scroll viven en `src/lib/list-table.ts`.

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


## Q · Page header

```tsx
return (
  <div className={LIST_SHELL}>

    {/* ── Header ── */}
    <div className={`${LIST_BLOCK} flex items-start justify-between`}>
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
- La raíz de una lista es `LIST_SHELL` (`src/lib/list-table.ts`). El encabezado, la toolbar y el contador llevan `LIST_BLOCK`. La tabla de la lista es `LIST_SCROLLPORT` con el encabezado fijo — ver `data-tables.mdc`. No volver a `flex flex-col gap-6 p-6 md:p-8`.
- El `<Button>Nuevo</Button>` vive **solo** en el header — no duplicar en toolbar.
- `h1` siempre `text-xl font-bold tracking-tight text-foreground` — nunca con color de acento.
- Acento: ver tabla maestra en `.cursor/rules/ui-conventions.mdc`.

---


## S · Toolbar

**Copiar verbatim** — el orden y la estructura son obligatorios.

```tsx
{/* ── Toolbar ── */}
<div className={`${LIST_BLOCK} flex items-center gap-2`}>

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
