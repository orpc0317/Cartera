---
description: "Use when creating or modifying data table lists in the Cartera app. Covers table structure, column definitions, row highlighting, keyboard navigation, column manager, column filters, empty state, search bar, and cell renderers."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera — Data Table Conventions

## Required state variables

```ts
const [search, setSearch] = useState('')
const [colFilters, setColFilters] = useState<ColFilters>({})  // Record<string, Set<string>>
const [colPrefs, setColPrefs] = useState<ColPref[]>(DEFAULT_PREFS)
const [cursorIdx, setCursorIdx] = useState<number | null>(null)
const tableRef = useRef<HTMLDivElement>(null)

// Derived
const hasActiveFilters = Object.keys(colFilters).length > 0
```

---

## Column definitions

```ts
type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'nombre',  label: 'Nombre',  defaultVisible: true  },
  { key: 'campo2',  label: 'Label',   defaultVisible: true  },
  { key: 'campo3',  label: 'Label',   defaultVisible: false }, // hidden by default
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))
```

- Use `__prefix` (e.g. `__regimen`) for virtual columns that don't map 1:1 to a DB field.
- `defaultVisible: false` for low-priority columns (departamento, municipio, dirección, etc.)

### Column label naming rules

- **No accents/tildes** — write `Codigo` not `Código`, `Direccion` not `Dirección`.
- **Title Case** — every word starts with uppercase, rest lowercase: `Cod. Postal`, `Razon Social`, `Regimen ISR`.
- Single-word labels follow the same rule: `Nombre`, `Pais`, `Empresa`.
- This rule applies to **all** visible text labels: `ALL_COLUMNS[].label`, hardcoded `<TableHead>` sticky cells, modal `<ViewField label=...>`, form `<Label>`, and toast messages.

---

## Column prefs persistence (localStorage)

```ts
const STORAGE_KEY = `<entity>_cols_v1_${userId}`

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
}, [])

function saveColPrefs(next: ColPref[]) {
  setColPrefs(next)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
}
```

---

## Filtering pipeline

```ts
// 1. Free-text search
const afterSearch = initialData.filter((row) => {
  const q = search.toLowerCase()
  return !q || row.nombre?.toLowerCase().includes(q) || /* other searchable fields */
})

// 2. Column filters
const filtered = afterSearch.filter((row) =>
  Object.entries(colFilters).every(([col, vals]) => {
    if (col === '__virtual') return vals.has(resolveVirtual(row))
    return vals.has(String(row[col as keyof T] ?? ''))
  })
)
```

---

## Search bar

```tsx
<div className="flex items-center gap-2">
  <div className="relative max-w-sm">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      placeholder="Buscar <entidades>..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="pl-9"
    />
  </div>
  {hasActiveFilters && (
    <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
      <X className="h-3.5 w-3.5" />
      Limpiar filtros
    </Button>
  )}
  <div className="ml-auto">
    <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => saveColPrefs(DEFAULT_PREFS)} />
  </div>
</div>
```

---

## Table wrapper

```tsx
<div
  ref={tableRef}
  className="rounded-xl border border-border/60 bg-card shadow-sm outline-none overflow-x-auto"
  tabIndex={0}
  onKeyDown={handleTableKeyDown}
  onFocus={() => { if (cursorIdx === null && filtered.length > 0) setCursorIdx(0) }}
>
```

---

## TableHeader

```tsx
<TableHeader>
  <TableRow className="bg-muted/30">
    <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Código</TableHead>
    {visibleCols.map((col) => (
      <TableHead key={col.key}>
        <ColumnFilter
          label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
          values={uniqueVals(col.key as keyof T)}
          active={colFilters[col.key] ?? new Set()}
          onChange={(v) => setColFilter(col.key, v)}
        />
      </TableHead>
    ))}
    <TableHead className="sticky right-0 z-20 w-12 bg-muted/30" />
  </TableRow>
</TableHeader>
```

For virtual columns (e.g. `__regimen`) that store IDs but display labels, translate in both `values` and `onChange`:

```tsx
if (col.key === '__regimen') {
  return (
    <TableHead key="__regimen">
      <ColumnFilter
        label="Régimen"
        values={[...new Set(initialData.map(r => LOOKUP[r.regimen] ?? `#${r.regimen}`))].sort()}
        active={new Set([...(colFilters['__regimen'] ?? new Set())].map(k => LOOKUP[Number(k)] ?? `#${k}`))}
        onChange={(labels) => {
          const byLabel = Object.fromEntries(Object.entries(LOOKUP).map(([k, v]) => [v, k]))
          setColFilter('__regimen', new Set([...labels].map(l => byLabel[l] ?? l)))
        }}
      />
    </TableHead>
  )
}
```

---

## TableRow — row structure

```tsx
<TableRow
  key={`${row.empresa}-${row.codigo}`}  // composite key when PK is multi-column
  className={`group cursor-pointer transition-colors ${
    isActive ? 'bg-{accent}-50 dark:bg-{accent}-950/30' : 'hover:bg-muted/40'
  }`}
  onClick={() => setCursorIdx(rowIdx)}
  onDoubleClick={() => openView(row)}
>
```

- `onClick` → select (highlight) the row  
- `onDoubleClick` → open view modal  
- Use composite key when the PK is `(empresa, codigo)`, single key when PK is just `codigo`

---

## Sticky code cell (left)

```tsx
<TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
  isActive
    ? 'bg-{accent}-50 dark:bg-{accent}-950/30 border-l-[3px] border-l-{accent}-600 text-{accent}-700 dark:text-{accent}-400 font-semibold'
    : 'bg-card text-muted-foreground group-hover:bg-muted/40'
}`}>
  #{row.codigo}
</TableCell>
```

---

## Cell renderers (switch pattern)

```tsx
{visibleCols.map((col) => {
  switch (col.key) {
    case 'nombre':
      return <TableCell key="nombre" className="font-medium">{row.nombre}</TableCell>

    // RULE: País always stores the ISO code in the DB (e.g. 'GT').
    // Always resolve to the country name and ALWAYS show the flag image.
    // Never display a raw code or a name without the flag.
    case 'pais': {
      const p = paises.find((x) => x.codigo === row.pais)
      return (
        <TableCell key="pais" className="text-muted-foreground">
          {row.pais ? (
            <span className="flex items-center gap-1.5">
              <img src={`https://flagcdn.com/w20/${row.pais.toLowerCase()}.png`} alt={row.pais} width={20} height={14} className="object-cover rounded-sm shrink-0" />
              {p?.nombre ?? row.pais}
            </span>
          ) : '—'}
        </TableCell>
      )
    }

    case 'departamento':
      return <TableCell key="departamento" className="text-muted-foreground">
        {departamentos.find((d) => d.codigo === row.departamento)?.nombre ?? row.departamento ?? '—'}
      </TableCell>

    case 'municipio':
      return <TableCell key="municipio" className="text-muted-foreground">
        {municipios.find((m) => m.codigo === row.municipio)?.nombre ?? row.municipio ?? '—'}
      </TableCell>

    case 'empresa':  // FK lookup via Map
      return <TableCell key="empresa" className="text-muted-foreground">
        {empresaMap.get(row.empresa) ?? `#${row.empresa}`}
      </TableCell>

    case '__regimen':  // enum with Badge
      return (
        <TableCell key="__regimen">
          <Badge variant="secondary" className="font-normal">
            {LOOKUP[row.regimen] ?? `#${row.regimen}`}
          </Badge>
        </TableCell>
      )

    case 'codigo_campo':  // ID / code
      return <TableCell key="codigo_campo" className="font-mono text-xs text-muted-foreground">
        {row.codigo_campo || '—'}
      </TableCell>

    default:
      return <TableCell key={col.key} className="text-muted-foreground">
        {(row[col.key as keyof T] as string) || '—'}
      </TableCell>
  }
})}
```

### Cell class rules

| Column type | className |
|-------------|-----------|
| Nombre / title | `font-medium` |
| FK label, country, text | `text-muted-foreground` |
| Code / NIT / ID | `font-mono text-xs text-muted-foreground` |
| Enum badge | no className on cell |
| Country | `text-muted-foreground` + flag image 20×14 |

**Never display raw geo codes** — always resolve departamento/municipio codes to names via props arrays.

**País rule:** `pais` stores the ISO code (e.g. `'GT'`). In every cell and every view/edit field that shows País, the flag (`flagcdn.com/w20/{iso}.png`, 20×14 px) **must** appear to the left of the country name. No exceptions.

---

## Sticky actions cell (right)

```tsx
<TableCell className={`sticky right-0 z-10 transition-colors ${
  isActive ? 'bg-{accent}-50 dark:bg-{accent}-950/30' : 'bg-card group-hover:bg-muted/40'
}`}>
  <DropdownMenu>
    <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${
      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
    }`}>
      <MoreHorizontal className="h-4 w-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openView(row)}>
        <Eye className="mr-2 h-3.5 w-3.5" />
        {/* If permissions apply: puedeModificar ? 'Ver / Editar' : 'Ver' */}
        Ver / Editar
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setAuditTarget(row)}>
        <History className="mr-2 h-3.5 w-3.5" />
        Historial
      </DropdownMenuItem>
      {/* Include delete only when the entity supports it */}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => setDeleteTarget(row)}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Eliminar
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</TableCell>
```

---

## Empty state

```tsx
{filtered.length === 0 ? (
  <TableRow>
    <TableCell colSpan={visibleCols.length + 2} className="py-16 text-center text-muted-foreground">
      {search || hasActiveFilters
        ? 'No se encontraron <entidades> con ese criterio.'
        : 'Todavía no hay <entidades>. Haz clic en "Nueva <Entidad>" para comenzar.'}
    </TableCell>
  </TableRow>
) : (
  /* rows */
)}
```

**Always check both `search` and `hasActiveFilters`** in the ternary — if only column filters are active (no search text), still show the "no results" message, not the "no data yet" message.

---

## Keyboard navigation

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
}, [filtered, cursorIdx])

// Reset cursor when filter changes
useEffect(() => { setCursorIdx(null) }, [search, colFilters])
```

---

## ColumnFilter component (shared)

```tsx
function ColumnFilter({ label, values, active, onChange }) {
  const isFiltered = active.size > 0
  return (
    <Popover>
      <PopoverTrigger render={
        <button type="button" className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium transition-colors hover:bg-accent ${
          isFiltered ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {label}
          <ChevronDown className="h-3 w-3" />
          {isFiltered && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {active.size}
            </span>
          )}
        </button>
      } />
      <PopoverContent className="w-52 p-2" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {isFiltered && (
            <button type="button" onClick={() => onChange(new Set())}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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

---

## ColumnManager component (shared)

```tsx
function ColumnManager({ prefs, onToggle, onMove, onReset }) {
  return (
    <Popover>
      <PopoverTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Columnas
        </Button>
      } />
      <PopoverContent className="w-56 p-3" align="end">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Columnas visibles</span>
          <button type="button" onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground">
            Restablecer
          </button>
        </div>
        <div className="space-y-0.5">
          {prefs.map((pref, i) => {
            const col = ALL_COLUMNS.find((c) => c.key === pref.key)!
            return (
              <div key={pref.key} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-accent">
                <Checkbox checked={pref.visible} onCheckedChange={() => onToggle(pref.key)} />
                <span className="flex-1 text-sm">{col.label}</span>
                <button type="button" disabled={i === 0} onClick={() => onMove(pref.key, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25">
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

---

## Checklist for a new table

1. Define `ALL_COLUMNS` / `DEFAULT_PREFS` — hide low-priority columns by default
2. Set `STORAGE_KEY = '<entity>_cols_v1_${userId}'`
3. Wire `ColumnFilter`, `ColumnManager`, `handleTableKeyDown`
4. Sticky left: `Código` (`w-20`). Sticky right: actions (`w-12`)
5. Row: `onClick` → select, `onDoubleClick` → open modal
6. Active row highlight uses module accent color (see crud-screens.instructions.md)
7. Cell switch: explicit `case` for nombre, pais, departamento, municipio, FK lookups, enums
8. Geo codes → always resolve to name. Country → always show flag
9. Empty state: `search || hasActiveFilters` in ternary
10. Dropdown: Eye/Historial always; Eliminar only when entity supports delete
