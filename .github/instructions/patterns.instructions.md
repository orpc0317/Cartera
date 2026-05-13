---
description: "Cartera — layout patterns for non-trivial screens: pattern selection guide, Maestro-Detalle, Transacción, Reporte, and Drawer. Load when designing screens beyond a simple CRUD list."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera — Screen Patterns

## Pattern selection guide

Use this decision tree to pick the right layout before writing any code:

| Scenario | Pattern |
|---|---|
| Simple catalog entity (no child tables, no totals) | **Formulario simple** — the default CRUD pattern in `crud-screens.instructions.md` |
| Entity that owns child rows (header + lines) | **Maestro-Detalle** |
| Financial document with totals and workflow states | **Transacción** |
| Analytical listing for reporting/export | **Reporte** |
| Quick inline edit without navigating away | **Drawer** |
| History / event log for an entity | **Auditoría tab** (add to existing modal — see `crud-screens.instructions.md`) |

---

## Maestro-Detalle

Two-panel layout. The master panel lists entities; selecting one loads its detail on the right.

```
┌────────────────┬──────────────────────────────┐
│  Master panel  │  Detail panel                │
│  (list/table)  │  (header + child table)      │
│                │  Botón "Nuevo" lives here    │
└────────────────┴──────────────────────────────┘
```

### Layout

```tsx
<div className="flex gap-4 h-full">
  {/* Master */}
  <div className="w-72 shrink-0 flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden">
    {/* search input at top */}
    {/* list of rows — click sets selectedId */}
  </div>

  {/* Detail */}
  <div className="flex-1 flex flex-col gap-4 min-w-0">
    {/* detail header with "Nuevo" button */}
    {/* child table */}
  </div>
</div>
```

### Rules

- Click on master row → sets `selectedId`; detail panel re-renders with the filtered child data.
- "Nuevo" button lives in the **detail panel header**, not in the master panel or the global page header.
- Use the same `Dialog` modal pattern from `crud-screens.instructions.md` for create/edit of child rows.
- Master list highlights selected row: `bg-{accent}-50/60 border-l-2 border-{accent}-500`.
- Master panel has its own text search input; the detail panel has a separate search/toolbar for child rows.

---

## Transacción

For documents that have a header, one or more line-item tables, computed totals, and workflow states (borrador → confirmado → anulado).

```
┌──────────────────────────────────────────┐
│  Header — document data + status badge  │
├──────────────────────────────────────────┤
│  Tabs: General │ Detalle │ Auditoría    │
├──────────────────────────────────────────┤
│  Tab content (scrollable)               │
├──────────────────────────────────────────┤
│  Footer — totals + action buttons       │  ← sticky
└──────────────────────────────────────────┘
```

### Rules

- Header always shows: document code, date, entity (client/supplier), and status badge.
- Status badge uses the global badge variants (see `crud-screens.instructions.md → Status badge variants`).
- Footer is `sticky bottom-0 bg-card border-t border-border/60 px-6 py-3 flex items-center justify-between`.
- Totals in footer: right-aligned, formatted with `fmt()` for monetary values.
- Action buttons (Confirmar / Anular) live in the footer, gated by permissions and current status.
- Workflow transitions are one-way (borrador → confirmado is irreversible without an explicit "Anular" action). Never allow direct state edits.

---

## Reporte

Analytical listing optimized for filtering and export. No create/edit modals.

```
┌──────────────────────────────────────────┐
│  Header — title + export button (right) │
├──────────────────────────────────────────┤
│  Toolbar — multiple filter controls     │
├──────────────────────────────────────────┤
│  Large data table (overflow-x-auto)     │
└──────────────────────────────────────────┘
```

### Rules

- Export button lives in the **header** (right side), not in the toolbar.
- Toolbar can contain date-range pickers, multi-selects, and text search — more controls than a standard CRUD toolbar.
- No row action dropdown (no edit/delete). Rows may be clickable to open a read-only detail drawer.
- Summary / totals row pinned at the bottom of the table when applicable.
- No `ColumnManager` unless the column count exceeds 8. Prefer a fixed, well-chosen set of columns.

---

## Drawer

Right-side slide-over panel for quick edits without navigating away. Uses the `<Sheet>` component from `@/components/ui/sheet` (already installed).

```tsx
<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
  <SheetContent className="w-[400px] sm:w-[480px] flex flex-col">
    <SheetHeader className="-mx-6 -mt-6 px-6 pt-5 pb-4 bg-gradient-to-br from-{accent}-50/70 to-transparent border-b border-border/50">
      <SheetTitle>{title}</SheetTitle>
    </SheetHeader>

    <div className="flex-1 overflow-y-auto py-4">
      {/* form content — same grid/field patterns as modal edit mode */}
    </div>

    <div className="border-t border-border/60 pt-4 flex justify-end gap-2">
      <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
      <Button onClick={handleSave}>Guardar</Button>
    </div>
  </SheetContent>
</Sheet>
```

### Rules

- Interior form uses the **exact same** `grid grid-cols-2 gap-4` edit-mode patterns as the Dialog modal.
- Header gradient uses the module accent color, same as the `Dialog` modal header.
- No tabs inside a drawer — keep content to a single logical group. If tabs are needed, use a `Dialog` instead.
- Icon badge modes (view/create/edit) do not apply to Drawers; omit the icon badge from `SheetHeader`.
