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
const [filter, setFilter]         = useState('')
```

**Data table** (per `data-tables.instructions.md`):
- Define `ALL_COLUMNS`, `DEFAULT_PREFS`, `STORAGE_KEY = '<entity>_cols_v1_${userId}'`
- Include `ColumnFilter` and `ColumnManager` components
- Active row highlight with module accent color from `ui-conventions.instructions.md`
- Sticky `Codigo` column (left) + sticky actions column (right)
- Keyboard nav: `ArrowUp` / `ArrowDown` → move cursor; `Enter` → open view; `Escape` → close dialog
- Row `onClick` → `setCursorIdx(idx)`; `onDoubleClick` → `openView(row)`

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

### Step 7 — Register in sidebar

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

### Step 8 — Post-generation checklist

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
