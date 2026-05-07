---
description: "Cartera data table patterns: column definitions, filtering, row/cell rules, keyboard nav. Full component code lives in existing _client.tsx files."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera  Data Table Patterns

## Column definitions

```ts
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'nombre',  label: 'Nombre', defaultVisible: true  },
  { key: 'campo2',  label: 'Label',  defaultVisible: false }, // low-priority hidden by default
]
const DEFAULT_PREFS = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))
```

- Use `__prefix` for virtual columns that don't map 1:1 to a DB field (e.g. `__regimen_iva`).
- `STORAGE_KEY = '<entity>_cols_v1_${userId}'`
- Label naming: no accents, Title Case (see ui-conventions.instructions.md).
- For full **ColumnFilter**, **ColumnManager**, **localStorage persistence**, and **filtering pipeline** implementations, copy from `src/app/dashboard/promesas/clientes/_client.tsx`.

---

## Table wrapper

```tsx
<div ref={tableRef} className="rounded-xl border border-border/60 bg-card shadow-sm outline-none overflow-x-auto"
  tabIndex={0} onKeyDown={handleTableKeyDown}
  onFocus={() => { if (cursorIdx === null && filtered.length > 0) setCursorIdx(0) }}>
```

Header row: `bg-muted/30`. Sticky code cell: `sticky left-0 z-20 w-20 bg-muted/30`  label `Codigo`. Sticky actions cell: `sticky right-0 z-20 w-12 bg-muted/30`.

### Sticky column header text

The sticky "Codigo" (or "Serie") `<TableHead>` must wrap its label in a `<span>` to match the styling of the `<ColumnFilter>` buttons in dynamic columns. Without this, the `<TableHead>` default `font-semibold` makes it visually bold relative to all other headers.

```tsx
{/* ✅ Correct */}
<TableHead className="sticky left-0 z-20 w-20 bg-muted/30">
  <span className="text-xs font-medium text-muted-foreground">Codigo</span>
</TableHead>

{/* ❌ Wrong — inherits font-semibold from TableHead; appears bold vs other headers */}
<TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Codigo</TableHead>
```

For screens like **Lotes** where some dynamic columns don't use `<ColumnFilter>` (plain label), wrap them the same way:

```tsx
} : <span className="text-xs font-medium text-muted-foreground">{col.label}</span>}
```

## Column headers — always use ColumnFilter

**Every** dynamic column in `visibleCols.map(...)` must render a `<ColumnFilter>` — never plain `{col.label}` text. Plain text makes the header visually invisible (no styling) and disables filtering for that column.

```tsx
{/* ✅ Correct — all columns use ColumnFilter */}
{visibleCols.map((col) => (
  <TableHead key={col.key}>
    <ColumnFilter
      label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
      values={
        col.key === 'empresa'  ? uniqueEmpresaNames  :
        col.key === 'proyecto' ? uniqueProyectoNames :
        col.key === 'nombre'   ? uniqueNombreValues  : []
      }
      active={colFilters[col.key] ?? new Set()}
      onChange={(v) => setColFilter(col.key, v)}
    />
  </TableHead>
))}

{/* ❌ Wrong — plain text; header is invisible and not filterable */}
return <TableHead key={col.key}>{col.label}</TableHead>
```

When a column has no filterable values (e.g. a free-text field with too many unique values), pass `values={[]}` — `ColumnFilter` still renders the styled label correctly, just without a dropdown.

FK columns (empresa, proyecto, fase…) and enum columns (medida, moneda…) require label↔key translation in both `values` and `active`/`onChange` — see the filter pipeline in `clientes/_client.tsx` for reference.

---

## Active row highlight (use module accent color from ui-conventions.instructions.md)

```tsx
// Row
className={`group cursor-pointer transition-colors ${isActive ? 'bg-{accent}-50 dark:bg-{accent}-950/30' : 'hover:bg-muted/40'}`}

// Sticky code cell  active
'bg-{accent}-50 dark:bg-{accent}-950/30 border-l-[3px] border-l-{accent}-600 text-{accent}-700 dark:text-{accent}-400 font-semibold'

// Sticky code cell  inactive
'bg-card text-muted-foreground group-hover:bg-muted/40'

// Sticky actions cell
isActive ? 'bg-{accent}-50 dark:bg-{accent}-950/30' : 'bg-card group-hover:bg-muted/40'
```

Row interactions: `onClick`  `setCursorIdx(rowIdx)`, `onDoubleClick`  `openView(row)`.
PK key: `key={row.codigo}` for single PK, `key={`${row.empresa}-${row.codigo}`}` for composite PK.

---

## Cell renderers

Use `switch (col.key)` with explicit cases; `default` for generic text columns.

| Column type  | className                                | Notes |
|--------------|------------------------------------------|-------|
| Nombre/title | `font-medium`                            | |
| Text / FK    | `text-muted-foreground`                  | |
| Code/NIT/ID  | `font-mono text-xs text-muted-foreground` | |
| Enum         | no className on cell                     | Wrap in `<Badge variant="secondary" className="font-normal">` |
| Pais         | `text-muted-foreground`                  | Flag img 2014 (flagcdn.com) + resolved nombre |
| Departamento | `text-muted-foreground`                  | Resolve code  nombre via props array |
| Municipio    | `text-muted-foreground`                  | Resolve code  nombre via props array |

**Never display raw geo codes.**

---

## Dropdown menu (actions cell)

Always: **Ver / Editar** (`Eye`) + **Historial** (`History`).
Conditional: **Eliminar** (`Trash2`) wrapped in `<DropdownMenuSeparator>`  only when entity supports delete.
Label: `puedeModificar ? 'Ver / Editar' : 'Ver'`.

Trigger: `inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none` + `opacity-0 group-hover:opacity-100` (visible when row is active).

---

## Empty state

```tsx
<TableCell colSpan={visibleCols.length + 2} className="py-16 text-center text-muted-foreground">
  {search || hasActiveFilters
    ? 'No se encontraron <entidades> con ese criterio.'
    : 'Todavía no hay <entidades>. Haz clic en "Nueva <Entidad>" para comenzar.'}
</TableCell>
```

Always check both `search` and `hasActiveFilters`.

---

## Keyboard navigation

Copy `handleTableKeyDown` from any existing `_client.tsx`. Reset cursor on filter change:
```ts
useEffect(() => { setCursorIdx(null) }, [search, colFilters])
```

---

## Checklist for a new table

1. `ALL_COLUMNS` / `DEFAULT_PREFS` / `STORAGE_KEY`
2. Copy `ColumnFilter`, `ColumnManager`, `handleTableKeyDown`, localStorage effect from `clientes/_client.tsx`
3. Sticky left `Codigo` (w-20), sticky right actions (w-12)
4. Active row: module accent color (see ui-conventions.instructions.md)
5. Cell `switch`: explicit cases for nombre, pais, FK lookups, enums; geo codes  resolve to name
6. Empty state with `search || hasActiveFilters` ternary
7. Dropdown: Eye/Historial always; Eliminar only when supported
8. CSV export: `exportCsv` + `Exportar CSV` button (see **CSV Export** section below)

---

## CSV Export

Every CRUD table must include a **"Exportar CSV"** button (icon `Download`) in the toolbar, to the left of `ColumnManager`. It exports the **currently filtered rows** with **currently visible columns**.

### What to export

- Always include the sticky-left identifier column (e.g. `serie`, `codigo`) even if not in `ALL_COLUMNS`.
- Include all columns currently visible in `ColumnManager`.
- **Never export** regardless of visibility:
  - `cuenta` — tenant identifier (security risk if file is shared)
  - `agrego_usuario`, `modifico_usuario` — internal UUIDs
  - The actions column (UI only)
- `agrego_fecha` and `modifico_fecha` are safe to export if visible.

### File name

`<entity-slug>-YYYY-MM-DD.csv` — defined per screen in its spec. Example: `series-recibos-2026-01-15.csv`.

### Implementation (copy verbatim, replace `Entity` and sticky column name)

```ts
// ── Module-level constants (outside component) ───────────────────────────
const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])

// COL_LABELS = { [key]: label } — built from ALL_COLUMNS + sticky column
const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: '<sticky-key>', label: '<Sticky Label>' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function exportCsv(rows: Entity[], colPrefs: ColPref[]) {
  const keys = ['<sticky-key>', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof Entity])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `<entity-slug>-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── In the toolbar (JSX) ─────────────────────────────────────────────────
// Place to the LEFT of <ColumnManager />, inside the same flex container:
<Button variant="outline" size="sm" onClick={() => exportCsv(filtered, colPrefs)} className="gap-1.5">
  <Download className="h-3.5 w-3.5" /> Exportar CSV
</Button>
```

> `formatCsvCell` wraps values in double-quotes when they contain commas, newlines, or quotes — no external CSV library needed.
