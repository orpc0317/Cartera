---
description: "Cartera  data table patterns: column definitions, filtering, row/cell rules, keyboard nav. Full component code lives in existing _client.tsx files."
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
