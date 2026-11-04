---
name: crud-screen
description: 'Build a complete catalog CRUD screen for the Cartera ERP project. USE FOR: a new catalog CRUD (list, modal, create, update, delete) with Clientes as the required first reference; implementing create/read/update/delete from a request or a prompts/crud-*.md spec. Covers: Clientes structure, getCuentaActiva, requirePermiso, writeAudit, optimistic concurrency with modifico_fecha, permission-gated UI, campo con error al grabar, and the Playwright file in test/definidas. DO NOT USE FOR: pagos, depósitos, promesas, KPI dashboards, or schema migrations. Do not edit the spec after building or updating the screen.'
argument-hint: 'Ruta al spec, e.g. prompts/crud-bancos.md — o el pedido de la pantalla, si no hay spec'
---

# CRUD Screen Builder

Builds a catalog CRUD screen for Cartera. The screen layout comes from Clientes. Area rules support widgets and traps that reference does not show.

## When to Use

- The request is a new catalog CRUD (lista, modal, alta, cambio, baja)
- User references a `prompts/crud-*.md` file
- User asks to build, implement, or create a CRUD screen for a catalog entity
- User asks to update or modify an existing catalog screen

Do not use the Clientes layout for pagos, depósitos, promesas, or KPIs.

---

## Procedure

### Step 1 — Read Clientes first

Before writing a new catalog CRUD, read these files:

- `src/app/dashboard/promesas/clientes/page.tsx`
- `src/app/dashboard/promesas/clientes/_client.tsx`
- `src/app/actions/clientes.ts`
- The `Cliente` / `ClienteForm` types in `src/lib/types/proyectos.ts`

Follow that structure: list, modal, create, update, delete. Do not move `Cliente` out of `proyectos.ts`.

Table, fields, route, permission, and relations come from the request or from a new spec. They do not come from copying Clientes' columns.

If the request includes a widget Clientes does not have (image, geo, currency, combobox), use the snippet in the matching rule and the component in `src/components/ui`. The screen layout stays Clientes.

- Image: `.cursor/rules/image-upload.mdc`
- Geo, currency, or combobox: `.cursor/rules/advanced-components.mdc`

### Step 2 — Read the area rules

Read these before writing:

| File | Covers |
|------|--------|
| `.cursor/rules/business-context.mdc` | Domain hierarchy, cuenta isolation |
| `.cursor/rules/server-actions.mdc` | getCuentaActiva, requirePermiso, page.tsx pattern, optimistic concurrency, writeAudit |
| `.cursor/rules/crud-screens.mdc` | Modal composition, and § Campo con error al grabar |
| `.cursor/rules/ui-conventions.mdc` | Accent colors, Lucide icons, label rules |
| `.cursor/rules/data-tables.mdc` | Column defs, ColumnFilter, ColumnManager, keyboard nav |
| `.cursor/rules/base-ui-gotchas.mdc` | Base UI vs Radix API differences |
| `.cursor/rules/components.mdc` | Snippets for cases the Clientes reference does not show |

`.cursor/rules/components.mdc` and `.cursor/rules/spec-field-tokens.mdc` are support for cases the reference does not show, and for Base UI traps, security, and audit. They are not the layout to copy.

### Step 3 — Read the request or the spec

When a `prompts/crud-*.md` file is the request, read it and extract:

| Field | Purpose |
|-------|---------|
| `NOMBRE` | Display name for labels and sidebar |
| `MODULO` | Nav group in sidebar |
| `TABLA_BD` | `cartera.<table>` — used in all queries |
| `RUTA` | Next.js route (e.g. `/dashboard/bancos/bancos`) |
| `PERMISO` | Constant key (e.g. `BAN_CAT`) |
| `COLOR_ACENTO` | Tailwind token pair; if "elegir" → pick the **first row** in the accent-color table in `.cursor/rules/ui-conventions.mdc` whose "En uso" column is empty, reading top-to-bottom |
| `ICONO_LUCIDE` | Lucide icon; if "elegir" → same rule: first row in the icon table whose "En uso" column is empty, reading top-to-bottom |
| `MODO` | `nuevo` or `actualizar` |
| `ENTIDAD` | Type definitions and PK composition |
| `RELACIONES` | FK dependencies, cascade rules, and which action functions to call |
| `CAMPOS_FORMULARIO` | User-editable fields with validation rules |
| `ACCIONES` | Permission gates for each operation |
| `CAMBIOS_PENDIENTES` | (only in `actualizar` mode) list of changes to apply to code |

Scan every field token. A token that is not in `.cursor/rules/spec-field-tokens.mdc` stops the work. Do not invent a widget for it.

**MODO guard:**

- `nuevo` → check if `src/app/dashboard/<ruta>/page.tsx` already exists. If it does, **STOP — do not generate any file**. Tell the user the screen already exists and ask whether to overwrite or switch the spec to `actualizar`.
- `actualizar` → apply each item under `### Cambios a aplicar:` inside `CAMBIOS_PENDIENTES` to the code. Do not edit the spec. Do not set `MODO` back to `nuevo`. Do not clear `CAMBIOS_PENDIENTES`.

### Step 4 — Verify / add PERMISO constant

Open `src/lib/permisos.ts`. Check if `PERMISOS.<PERMISO>` already exists.

If not, add it following the existing pattern (max 8 chars, format `XXX.XXX`):

```ts
// Example — add inside the PERMISOS object
BAN_CAT: 'BAN.CAT',
```

The value comes from the spec's `PERMISO` field. Match the dot-notation style of existing entries.

### Step 5 — Generate types

Follow the shape of `Cliente` / `ClienteForm`. Create `src/lib/types/<entity>.ts` for the new entity:

```ts
export type Entity = {
  // All fields from ENTIDAD — match DB column types exactly
  // timestamptz → string, number columns → number, varchar → string
}

export type EntityForm = {
  // Only the user-editable fields from ENTIDAD > EntityForm block
}
```

Derive the filename from `TABLA_BD`: strip the schema prefix and leading `t_`, pluralize in Spanish, use kebab-case for multi-word names (e.g. `cartera.t_banco` → `bancos.ts`, `cartera.t_tipo_ingreso` → `tipos-ingreso.ts`).

Do not move `Cliente` / `ClienteForm` out of `src/lib/types/proyectos.ts`.

### Step 6 — Generate Server Action

Create `src/app/actions/<entity>.ts`. Required exports:

| Function | Description |
|----------|-------------|
| `getEntities()` | Fetch all rows filtered by cuenta |
| `createEntity(form: EntityForm)` | Insert with audit fields |
| `updateEntity(pk, form, lastModified?)` | Update with optimistic concurrency |
| `deleteEntity(pk)` | Hard delete |
| `getRelation()` | One per FK in RELACIONES; call the existing action from `page.tsx` if it already exists — do not re-export values from a `"use server"` file |

Rules (from `.cursor/rules/server-actions.mdc`):

- Import `getCuentaActiva` and `requirePermiso` from `@/app/actions/permisos`. Never redeclare `getCuentaActiva`.
- Every write (`create*`, `update*`, `delete*`, `upload*`): `requirePermiso(...)` is the first instruction. If it returns `{ error }`, return that immediately.
- Then `const cuenta = await getCuentaActiva(); if (!cuenta) return { error: 'Sesión no válida.' }`
- `updateEntity` must use `modifico_fecha` for optimistic concurrency — see the rule for the exact query pattern
- Call `writeAudit(...)` after every successful mutation (import from `src/app/actions/audit.ts`)
- Do not re-export values from a `"use server"` file. In `page.tsx`, import FK helpers from their source action file.

### Step 7 — Generate page.tsx

Create `src/app/dashboard/<ruta>/page.tsx` as a Server Component (no `'use client'`), following `src/app/dashboard/promesas/clientes/page.tsx`:

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

### Step 8 — Generate _client.tsx

Create `src/app/dashboard/<ruta>/_client.tsx` with `'use client'` at the top. Match the structure of `src/app/dashboard/promesas/clientes/_client.tsx`: list, modal, create, update, delete.

**State to declare:**

```ts
const [dialogOpen, setDialogOpen] = useState(false)
const [isEditing, setIsEditing]   = useState(false)
const [viewTarget, setViewTarget] = useState<Entity | null>(null)
const [isPending, startTransition] = useTransition()
const { activeTab, setActiveTab, campoInvalido, rechazar, limpiarCampoInvalido } = useCampoInvalido()
const [hadConflict, setHadConflict] = useState(false)
const [cursorIdx, setCursorIdx]   = useState<number | null>(null)
const [colPrefs, setColPrefs]     = useState<ColPref[]>(DEFAULT_PREFS)
const [search, setSearch]         = useState('')
```

The modal state block (dialogOpen, isEditing, viewTarget, form, isPending, hadConflict, similarWarning, deleteTarget, auditTarget, auditOpen) follows Clientes. Use `.cursor/rules/components.mdc` § A only when the reference does not show the case.

**Data table** (per Clientes and `.cursor/rules/data-tables.mdc`):

- Define `ALL_COLUMNS`, `DEFAULT_PREFS`, `STORAGE_KEY = '<entity>_cols_v1_${userId}'`
- ColumnFilter, ColumnManager, and handleTableKeyDown follow Clientes. Use `.cursor/rules/components.mdc` § M when the reference does not show the case.
- Active row highlight with module accent color from `.cursor/rules/ui-conventions.mdc`
- Sticky `Codigo` column (left) + sticky actions column (right)
- Keyboard nav: `ArrowUp` / `ArrowDown` → move cursor; `Enter` → open view; `Escape` → close dialog
- Row `onClick` → `setCursorIdx(idx)`; `onDoubleClick` → `openView(row)`

**Before declaring the screen finished, verify every item below.**

#### Campo con error al grabar

Follow `.cursor/rules/crud-screens.mdc` § Campo con error al grabar. Copy the wiring from `src/app/dashboard/proyectos/fases/_client.tsx`. Do not invent a second focus helper.

- [ ] `useCampoInvalido` comes from `@/lib/campo-invalido`. `Tabs` uses `value={activeTab}` and `onValueChange={setActiveTab}`.
- [ ] Every client-side field error calls `rechazar(id, mensaje, tab)` and returns before `startTransition`. The Spanish message is the one the screen already shows.
- [ ] `limpiarCampoInvalido()` runs at the start of `f()`, `openCreate`, `openView`, `startEdit`, and `cancelEdit`. Those four also call `setActiveTab('general')`.
- [ ] The rejected control has the same `id`. `Input`, `SelectTrigger`, and native `<select>` set `aria-invalid`. `PhoneField` uses `inputId` and `invalid`. `CountrySelect` and combobox buttons use `id` plus `data-invalid`. A `<button>` does not get `aria-invalid`.
- [ ] `toast.error(result.error)` stays for the server response, including the `modifico_fecha` conflict. It is not the way to report a field error.

#### Selects

- [ ] **Every `<SelectTrigger>` has `className="w-full"`** — the base component defaults to `w-fit` and shrinks to its content without it. No exceptions: full-width, half-width, and third-width fields all need it.
- [ ] **Every `<SelectValue>` that resolves a label uses the `(v: string) =>` render-prop signature** — never `({ value }: { value: string }) =>`. Base UI passes the value as a plain string argument, not as an object property. Using the destructured form means `value` is always `undefined` and the placeholder shows permanently.
- [ ] **No `<SelectValue>` reads `form.field` directly as a static child** — e.g. `{empresaMap.get(form.empresa) ?? 'Selecciona'}` is wrong. Always use the render function `{(v: string) => v ? (...) : null}`.
- [ ] **Every FK `<Select>` (empresa, proyecto, fase, banco, cobrador, vendedor, etc.) has a render-prop child on `<SelectValue>`** — without it, Base UI shows the raw numeric code after selection instead of the name.
- [ ] **Every `openCreate()` call pre-selects the first available item for each dropdown** — hardcoded and DB-loaded alike. See the auto-select rule in `.cursor/rules/crud-screens.mdc`.

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
- [ ] **Sticky left column is `codigo`; sticky right column is the "Ver" button** (single action, no dropdown/chevron) — both have `z-10` and mirror their background class to the active-row highlight class.
- [ ] **Toolbar structure matches Clientes and `.cursor/rules/data-tables.mdc` § Toolbar layout.** Violations to catch:
  - Search input has `max-w-xs` (fixed), **not** `flex-1`.
  - `hasActiveFilters = Object.keys(colFilters).length > 0` is declared near other derived constants.
  - "Limpiar filtros" button is present and conditionally rendered on `hasActiveFilters`.
  - Exportar CSV and ColumnManager are wrapped together in `<div className="ml-auto flex items-center gap-2">`.
  - Order inside that wrapper: **Exportar CSV first, then ColumnManager** — never reversed.
  - Button label is **"Exportar CSV"**, never just "Exportar".

**Modal** (Clientes, with notes in `.cursor/rules/crud-screens.mdc`):

- Header gradient with module accent color
- Icon badge: module icon when viewing, `<Plus>` when creating, `<Pencil>` when editing
- Tabs with at least "General" tab; add more tabs only if spec defines them
- **View mode:** `ViewField` for each field, grouped into `SegmentCard` per section (title above a bordered card — replaces bare `SectionDivider`)
- **Edit mode:** form fields per `CAMPOS_FORMULARIO`, same `SegmentCard` grouping; if RELACIONES defines cascade selects, on parent change reset child to first available item or `0`
- **Footer (estándar 2026-08):** view mode → single row of ghost buttons: Historial, [acciones extra de la entidad], Eliminar (if `puedeEliminar`), Editar (if `puedeModificar`) — **no** botón "Cerrar" (la "x" del header ya cierra); edit mode → Cancelar/Volver + Guardar
- **Delete:** `AlertDialog` with "¿Estás seguro?" pattern, triggered from the footer's Eliminar button (not a row dropdown); only shown if `puedeEliminar`
- **Guard obligatorio:** el `modal={false}` del Dialog principal debe ignorar `onOpenChange(false)` mientras `auditTarget`/`deleteTarget`/cualquier otro dialog anidado esté abierto — ver `.cursor/rules/base-ui-gotchas.mdc` § 5

**Permission gates** (from spec's `ACCIONES`):

- `puedeAgregar` → "Nuevo" button visibility
- `puedeModificar` → Editar button in modal footer
- `puedeEliminar` → Eliminar button in modal footer (not a row dropdown)

### Step 9 — Register in sidebar

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

### Step 10 — Playwright for the new catalog

A new catalog CRUD includes `test/definidas/<entidad>.spec.ts`. `<entidad>` is the kebab-case name used for the action file (`fases`, `bancos`, `cuentas-bancarias`).

Do not add this battery for pagos, depósitos, promesas, transacciones, or KPIs. Do not create another auth setup. The `definidas` project in `playwright.config.ts` already logs in through `test/auth.setup.ts` and stores `test/.auth/user.json`.

Read the screen you just wrote and copy its strings. Do not invent toasts, empty-state copy, placeholders, CSV headers, button labels, or column names.

| What the screen does | Copy the shape from |
|---|---|
| Search, CSV, create with the first empty required field, view and cancel, edit with that field empty | `test/definidas/fases.spec.ts` |
| Another required field that `openCreate` leaves empty | `test/definidas/empresas.spec.ts`, test `nueva empresa exige razon social` |
| The invalid field lives on another tab | `test/definidas/proyectos.spec.ts`, test `editar desde otra pestaña vuelve al campo obligatorio vacío` |
| Save warns about a similar name | `test/definidas/bancos.spec.ts`, test `un nombre parecido avisa y cancelar no guarda` |
| One create and delete that removes the row | `test/definidas/bancos.spec.ts`, helpers plus `crea un banco con nombre único y lo elimina` |
| Two tabs edit the same row | `test/definidas/bancos.spec.ts`, test `dos pestañas editan el mismo banco y solo la primera grabación vale` |

Every new catalog file includes these tests:

1. `beforeEach` opens the route, expects status under 400, expects the URL not to contain `/login`, expects the `h1`, and calls `assertSinOverlayDeNext` from `../soporte`.
2. A search for `___sin_coincidencias___` shows the counter at 0 and the empty copy from the client. Clearing the search restores the previous counter. The placeholder and the counter regex come from the client (`0 fases`, `0 bancos`).
3. Exportar CSV downloads `<archivo>-YYYY-MM-DD.csv`. The date is the UTC day from `new Date().toISOString().slice(0, 10)`, because the screen builds the filename that way. The header contains the visible default columns and does not contain `cuenta` or a column the default view hides.
4. Create: open the dialog, press Guardar, and assert the first `rechazar` that fires with the form `openCreate` left behind. Toast text, tab `General` selected (`getByRole('tab', { name: 'General', selected: true })`), the control visible, `aria-invalid="true"` (or `data-invalid="true"` on a button), and focused. The success toast has count 0. Close with the button named `Close`. The dialog hides. Repeat once per additional required field that `openCreate` leaves empty: fill the earlier ones with a value that is not saved, then Guardar. Do not retest a dropdown `openCreate` already filled.
5. View and cancel. Skip when the client's empty-state sentence is visible. Double-click the first row. The name is the text of `td.font-medium`. The dialog heading matches that name. Historial and Editar are visible. Editar, change the field, Cancelar, and the view heading returns. Close. The cell still has the original name. After Editar, find the dialog with `getByRole('dialog')`. Filtering the dialog by the record name fails once the title changes.
6. Edit with the required field empty. One tab: stay on General, as in Fases. More than one tab: switch to the other tab before Guardar, as in Proyectos, and expect the tab of the field to become selected. Cancelar, then Close. The row is unchanged. There is no success toast.
7. Similar-name warning, only when `handleSave` opens that alert. Use an existing row's name. The alert heading is `Nombres similares encontrados`. Click `Cancelar`. Do not click `Si, es diferente — Continuar` in this test. The success toast has count 0 and the counter is unchanged.
8. One create and one delete. Read `create*` and `delete*` first and fill only what the form still requires. The name is `E2E <ENTIDAD> ${Date.now()}`. The success and delete toasts are the exact strings from the client. The row count goes to 0. `finally` deletes the row if the test fails, and throws `Quedó <nombre>. Bórralo a mano.` when cleanup fails. A unique name may still trip the similar-name warning: only this test and the lock test may click `Si, es diferente — Continuar`, and only after the warning is actually visible. Copy `confirmarSiElNombreParece` from Bancos.
9. Optimistic lock, when `update*` sends `modifico_fecha`. `test.setTimeout(90_000)`. `page.context().newPage()` shares the session. Create `E2E <ENTIDAD> ${marca}`. Edit it in both pages. The second page saves `KILO NORTE ${marca}` and sees the success toast. The first page saves `VASO SUR ${marca}` and sees exactly `Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.` The edit dialog stays open. The losing name is absent from the list. `finally` closes the extra page and deletes the row. Those two names stay far from each other and from existing catalog names.

A new-mode footer has no Cancelar. Close it with `Close`. Edit mode uses Cancelar to leave edit and `Close` to leave the dialog.

Run this before the screen is finished:

```bash
npx playwright test --project=definidas test/definidas/<entidad>.spec.ts
```

The dev server and `TEST_LOGIN_USERNAME` / `TEST_LOGIN_PASSWORD` come from the Playwright config and the setup project. Do not print those secrets. Do not leave `E2E` rows behind.

### Step 11 — Definition of done

Run these before reporting the screen finished. Do not use `get_errors` or PowerShell.

- [ ] `npx tsc --noEmit` if any TypeScript or TSX file was touched
- [ ] `npx eslint` on the touched files
- [ ] Writes call `requirePermiso` as the first instruction, then `getCuentaActiva`, then `writeAudit` after success
- [ ] JSX comments are closed (`{/* ... */}`)
- [ ] `src/lib/types/<entity>.ts` created with `Entity` and `EntityForm`
- [ ] `src/app/actions/<entity>.ts` created; all functions exported
- [ ] `src/app/dashboard/<ruta>/page.tsx` created as Server Component
- [ ] `src/app/dashboard/<ruta>/_client.tsx` created with `'use client'`, structured like Clientes
- [ ] `src/lib/permisos.ts` contains `PERMISOS.<PERMISO>`
- [ ] `src/components/layout/app-sidebar.tsx` has the new route registered
- [ ] Accent color table in `.cursor/rules/ui-conventions.mdc` updated (add row if new module)
- [ ] Icon table in `.cursor/rules/ui-conventions.mdc` updated (add row if new icon)
- [ ] The spec file was not edited
- [ ] `test/definidas/<entidad>.spec.ts` exists and `npx playwright test --project=definidas test/definidas/<entidad>.spec.ts` is green
- [ ] Guardar on an invalid field toasts, selects that field's tab, marks the control, and focuses it

Mark the task done only when the checks above are green. If the change is visible on screen, walk the flow in the browser first.
