---
name: crud-screen
description: 'Build a complete CRUD screen for the Cartera ERP project. USE FOR: creating a new CRUD screen from a prompts/crud-*.md spec file; implementing create/read/update/delete for an entity; generating page.tsx + _client.tsx + Server Actions + types. Covers: getCuentaActiva pattern, optimistic concurrency with modifico_fecha, permission-gated UI, modal with tabs, ViewField, data table with ColumnManager, sidebar registration, and permisos.ts constant. DO NOT USE FOR: non-CRUD screens, KPI dashboards, or schema migrations.'
argument-hint: 'Ruta al spec, e.g. prompts/crud-bancos.md'
---

# CRUD Screen Builder

Builds a complete, production-ready CRUD screen following the Cartera ERP conventions.

## When to Use

- User references a `prompts/crud-*.md` file
- User asks to build, implement, or create a CRUD screen for an entity
- User asks to update or modify an existing screen based on a prompt spec

---

## Required Reading

Before writing any code, load these instruction files **in parallel**:

| File | Covers |
|------|--------|
| `.github/instructions/business-context.instructions.md` | Domain hierarchy, cuenta isolation |
| `.github/instructions/server-actions.instructions.md` | getCuentaActiva, page.tsx pattern, optimistic concurrency |
| `.github/instructions/crud-screens.instructions.md` | Modal layout, ViewField, SectionDivider, icon badge |
| `.github/instructions/ui-conventions.instructions.md` | Accent colors, Lucide icons, label rules |
| `.github/instructions/data-tables.instructions.md` | Column defs, ColumnFilter, ColumnManager, keyboard nav |
| `.github/instructions/base-ui-gotchas.instructions.md` | Base UI vs Radix API differences (SelectValue, SelectTrigger, AlertDialog, DropdownMenu) |
| `.github/instructions/components.instructions.md` | **Copy-verbatim snippets** — modal state/functions, iconBadgeBg, subtitle, form inputs, selects, checkboxes, AlertDialog delete, row dropdown, ColumnFilter, ColumnManager, handleTableKeyDown |

> **Si el spec contiene algún campo de tipo imagen** (p.ej. `logo_url`), cargar también:
> `.github/instructions/image-upload.instructions.md` — magic bytes, SVG risk, cleanup de archivo anterior, patrón `LogoUploadField`.

---

## Procedure

### Step 1 — Read & validate the spec

Read the prompt file (e.g. `prompts/crud-bancos.md`). Extract these fields:

| Field | Purpose |
|-------|---------|
| `NOMBRE` | Display name for labels and sidebar |
| `MODULO` | Nav group in sidebar |
| `TABLA_BD` | `cartera.<table>` — used in all queries |
| `RUTA` | Next.js route (e.g. `/dashboard/bancos/bancos`) |
| `PERMISO` | Constant key (e.g. `BAN_CAT`) |
| `COLOR_ACENTO` | Tailwind token pair; if "elegir" → pick unused from ui-conventions table |
| `ICONO_LUCIDE` | Lucide icon; if "elegir" → pick unused from ui-conventions table |
| `MODO` | `nuevo` or `actualizar` |
| `ENTIDAD` | Type definitions and PK composition |
| `RELACIONES` | FK dependencies, cascade rules, and which action functions to call |
| `CAMPOS_FORMULARIO` | User-editable fields with validation rules |
| `ACCIONES` | Permission gates for each operation |
| `CAMBIOS_PENDIENTES` | (only in `actualizar` mode) list of changes to apply |

**MODO guard** (also enforced by the `## MODO_GUARD` block in the spec file):
- `nuevo` → use the file tool to check if `src/app/dashboard/<ruta>/page.tsx` already exists. If it does, **STOP — do not generate any file**. Tell the user the screen already exists and ask for explicit confirmation to overwrite before proceeding.
- `actualizar` → apply only the changes listed in `CAMBIOS_PENDIENTES`; when done, reset `MODO` to `nuevo` and clear `CAMBIOS_PENDIENTES` to `_(sin cambios pendientes)_`.

---

### Step 2 — Verify / add PERMISO constant

Open `src/lib/permisos.ts`. Check if `PERMISOS.<PERMISO>` already exists.

If not, add it following the existing pattern (max 8 chars, format `XXX.XXX`):

```ts
// Example — add inside the PERMISOS object
BAN_CAT: 'BAN.CAT',
```

The value comes from the spec's `PERMISO` field. Match the dot-notation style of existing entries.

---

### Step 3 — Generate types

Create `src/lib/types/<entity>.ts`:

```ts
export type Entity = {
  // All fields from ENTIDAD — match DB column types exactly
  // timestamptz → string, number columns → number, varchar → string
}

export type EntityForm = {
  // Only the user-editable fields from ENTIDAD > EntityForm block
}
```

Derive the filename from `TABLA_BD` (e.g. `cartera.t_banco` → `bancos.ts`).

---

### Step 4 — Generate Server Action

Create `src/app/actions/<entity>.ts`. Required exports:

| Function | Description |
|----------|-------------|
| `getEntities()` | Fetch all rows filtered by cuenta |
| `createEntity(form: EntityForm)` | Insert with audit fields |
| `updateEntity(pk, form, lastModified?)` | Update with optimistic concurrency |
| `deleteEntity(pk)` | Hard delete |
| `getRelation()` | One per FK in RELACIONES; import from existing action file if already exported there |

Rules (from `server-actions.instructions.md`):
- `getCuentaActiva()` private helper at the top of every action file
- Every **write** operation: `const cuenta = await getCuentaActiva(); if (!cuenta) return { error: 'Sesión no válida.' }`
- `updateEntity` must use `modifico_fecha` for optimistic concurrency — see the instruction file for the exact query pattern
- Call `writeAudit(...)` after every successful mutation (import from `src/app/actions/audit.ts`)
- For FK data already exposed by another action file (e.g. `getEmpresas`, `getProyectos`), **import and re-export** — do not duplicate logic

---

### Step 5 — Generate page.tsx

Create `src/app/dashboard/<ruta>/page.tsx` as a Server Component (no `'use client'`):

```tsx
const [entities, relation1, permisos] = await Promise.all([
  getEntities().catch((e: Error) => { console.error('getEntities:', e.message); return [] as Awaited<ReturnType<typeof getEntities>> }),
  getRelation1().catch((e: Error) => { console.error('getRelation1:', e.message); return [] as Awaited<ReturnType<typeof getRelation1>> }),
  getPermisosDetalle(PERMISOS.<PERMISO>),
])

return (
  <EntityClient
    entities={entities}
    relation1={relation1}
    puedeAgregar={permisos.agregar}
    puedeModificar={permisos.modificar}
    puedeEliminar={permisos.eliminar}
  />
)
```

One `.catch()` per call — **never** a single `try/catch` wrapping all calls.

---

### Step 6 — Generate _client.tsx

Create `src/app/dashboard/<ruta>/_client.tsx` with `'use client'` at the top.

**State to declare:**

```ts
const [dialogOpen, setDialogOpen] = useState(false)
const [isEditing, setIsEditing]   = useState(false)
const [viewTarget, setViewTarget] = useState<Entity | null>(null)
const [isPending, startTransition] = useTransition()
const [hadConflict, setHadConflict] = useState(false)
const [cursorIdx, setCursorIdx]   = useState<number | null>(null)
const [colPrefs, setColPrefs]     = useState<ColPref[]>(DEFAULT_PREFS)
const [search, setSearch]         = useState('')
```

> **Full modal state block** (dialogOpen, isEditing, viewTarget, form, isPending, hadConflict, similarWarning, deleteTarget, auditTarget, auditOpen) — copy from `components.instructions.md § A`.

**Data table** (per `data-tables.instructions.md`):
- Define `ALL_COLUMNS`, `DEFAULT_PREFS`, `STORAGE_KEY = '<entity>_cols_v1_${userId}'`
- Copy `ColumnFilter`, `ColumnManager`, `handleTableKeyDown` verbatim from `components.instructions.md § M`
- Active row highlight with module accent color from `ui-conventions.instructions.md`
- Sticky `Codigo` column (left) + sticky actions column (right)
- Keyboard nav: `ArrowUp` / `ArrowDown` → move cursor; `Enter` → open view; `Escape` → close dialog
- Row `onClick` → `setCursorIdx(idx)`; `onDoubleClick` → `openView(row)`

---

### Step 7 — Post-Generation Checklist

**Before declaring the screen finished, verify every item below.** This is not optional — these are the most common generation errors. Fix any violation before responding to the user.

#### Selects

- [ ] **Every `<SelectTrigger>` has `className="w-full"`** — the base component defaults to `w-fit` and shrinks to its content without it. No exceptions: full-width, half-width, and third-width fields all need it.
- [ ] **Every `<SelectValue>` that resolves a label uses the `(v: string) =>` render-prop signature** — never `({ value }: { value: string }) =>`. Base UI passes the value as a plain string argument, not as an object property. Using the destructured form means `value` is always `undefined` and the placeholder shows permanently.
- [ ] **No `<SelectValue>` reads `form.field` directly as a static child** — e.g. `{empresaMap.get(form.empresa) ?? 'Selecciona'}` is wrong. Always use the render function `{(v: string) => v ? (...) : null}`.
- [ ] **Every FK `<Select>` (empresa, proyecto, fase, banco, cobrador, vendedor, etc.) has a render-prop child on `<SelectValue>`** — without it, Base UI shows the raw numeric code after selection instead of the name.
- [ ] **Every `openCreate()` call pre-selects the first available item for each dropdown** — hardcoded and DB-loaded alike. See the auto-select rule in `crud-screens.instructions.md`.

#### Checkboxes in mixed rows

- [ ] **Any row that mixes `<Input>`/`<Select>` cells with a `<Checkbox>` cell** has `items-end` on the parent grid div **and** `pb-1` on the checkbox wrapper div — otherwise the checkbox floats to the top of the row.

#### Labels & Layout

- [ ] **`f()` helper exists and is used for every text `<Input>`** — no `setForm` inline on text fields. Verify `SKIP_KEYS` is declared and includes all non-uppercased fields (`correo`, `moneda`, and any field the spec marks as "NO normalizar a mayúsculas").
- [ ] **Spec-exception fields (only remove accents, no uppercase)** are in `SKIP_KEYS` AND have the accent-removal applied inline in their `onChange`: `e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`.
- [ ] **Every `<Label>` has** `className="text-[11px] font-semibold tracking-wider text-muted-foreground"`.
- [ ] **Field widths match the spec's `Ancho` column exactly** — `full` → `col-span-2`, `half` → no wrapper, `third` → inner `grid-cols-3` wrapper inside a `col-span-2` div.

#### AlertDialog

- [ ] **`<AlertDialogDescription>` uses `render={<div />}`** when its content includes block-level elements — never `asChild` (Base UI does not support it). Never nest `<p>` inside it; use `<div>` to avoid hydration errors.

#### Table & Export

- [ ] **`STORAGE_KEY` includes `${userId}`** so column preferences are per-user.
- [ ] **Export filename matches the spec's `EXPORTACION` section** exactly (e.g. `tipos-ingresos-YYYY-MM-DD.csv`).
- [ ] **Sticky left column is `codigo`; sticky right column is the actions dropdown** — both have `z-10` and mirror their background class to the active-row highlight class.
- [ ] **Toolbar structure** — copy the exact block from `data-tables.instructions.md § Toolbar layout`. Violations to catch:
  - Search input has `max-w-xs` (fixed), **not** `flex-1`.
  - `hasActiveFilters = Object.keys(colFilters).length > 0` is declared near other derived constants.
  - "Limpiar filtros" button is present and conditionally rendered on `hasActiveFilters`.
  - Exportar CSV and ColumnManager are wrapped together in `<div className="ml-auto flex items-center gap-2">`.
  - Order inside that wrapper: **Exportar CSV first, then ColumnManager** — never reversed.
  - Button label is **"Exportar CSV"**, never just "Exportar".

**Modal** (per `crud-screens.instructions.md`):
- Header gradient with module accent color
- Icon badge: module icon when viewing, `<Plus>` when creating, `<Pencil>` when editing
- Tabs with at least "General" tab; add more tabs only if spec defines them
- **View mode:** `ViewField` for each field
- **Edit mode:** form fields per `CAMPOS_FORMULARIO`; if RELACIONES defines cascade selects, on parent change reset child to first available item or `0`
- **Footer:** view mode → Cerrar + Editar (if `puedeModificar`); edit mode → Cancelar/Volver + Guardar
- **Delete:** `AlertDialog` with "¿Estás seguro?" pattern; only shown if `puedeEliminar`

**Permission gates** (from spec's `ACCIONES`):
- `puedeAgregar` → "Nuevo" button visibility
- `puedeModificar` → Edit button in modal footer; row dropdown shows "Ver / Editar" vs only "Ver"
- `puedeEliminar` → Delete option in row actions dropdown

---

### Step 8 — Register in sidebar

In `src/components/layout/app-sidebar.tsx`:

1. Add the Lucide icon to the import block at the top (if not already present).
2. Find the `NavItem` group matching `MODULO` in the `NAV` array.
3. Add a `NavChild` inside `children`:

```ts
{ label: '<NOMBRE>', href: '<RUTA>', icon: <LucideIcon> }
```

4. If no matching group exists, add a new `NavItem`:

```ts
{
  label: '<MODULO>',
  icon: <GroupIcon>,
  permiso: PERMISOS.<PERMISO>,
  children: [
    { label: '<NOMBRE>', href: '<RUTA>', icon: <LucideIcon> },
  ],
},
```

---

### Step 9 — Post-generation checklist

Run `get_errors` after all files are created and fix any TypeScript issues before reporting completion.

- [ ] `src/lib/types/<entity>.ts` created with `Entity` and `EntityForm`
- [ ] `src/app/actions/<entity>.ts` created; all functions exported
- [ ] `src/app/dashboard/<ruta>/page.tsx` created as Server Component
- [ ] `src/app/dashboard/<ruta>/_client.tsx` created with `'use client'`
- [ ] `src/lib/permisos.ts` contains `PERMISOS.<PERMISO>`
- [ ] `src/components/layout/app-sidebar.tsx` has the new route registered
- [ ] Accent color table in `ui-conventions.instructions.md` updated (add row if new module)
- [ ] Icon table in `ui-conventions.instructions.md` updated (add row if new icon)
- [ ] No TypeScript errors
- [ ] If `MODO` was `actualizar`: reset to `nuevo`, clear `CAMBIOS_PENDIENTES`
