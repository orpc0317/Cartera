---
description: "Cartera CRUD modal and form patterns: DialogContent layout, header gradient, icon badge modes, ViewField, SectionDivider, view/edit grids, delete dialog, audit log."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera  Modal & Form Patterns

## File structure

```
page.tsx     Server Component: fetch with per-call .catch(() => [])
_client.tsx  Client Component: all UI, state, mutations
```

Mutations in `src/app/actions/<entity>.ts`. After mutations: `router.refresh()`.

---

## Page header

Every CRUD screen `_client.tsx` **must** start its `return` with a `{/* Header */}` block before the toolbar. The outer container uses `gap-6 p-6 md:p-8` (not `gap-4 p-6`).

```tsx
return (
  <div className="flex flex-col gap-6 p-6 md:p-8">

    {/* ── Header ── */}
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-{accent}-100 p-2.5">
          <{Icon} className="h-5 w-5 text-{accent}-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{Entidad en plural}</h1>
          <p className="text-sm text-muted-foreground">{Descripción breve}</p>
        </div>
      </div>
      {puedeAgregar && (
        <Button onClick={openCreate} className="gap-2 bg-{accent}-600 hover:bg-{accent}-700 text-white">
          <Plus className="h-4 w-4" />
          Nuevo {Entidad singular}
        </Button>
      )}
    </div>

    {/* ── Toolbar ── (search + column manager + export — sin el botón "Nuevo") */}
    ...
```

- The `<Button>Nuevo…</Button>` lives **only** in the header — do **not** duplicate it in the toolbar.
- Use the module's accent color (see `ui-conventions.instructions.md`) for the icon badge and the button.
- The `<Icon>` is the entity icon (same one used in the sidebar and in the modal icon badge).
- `h1` always has `className="text-xl font-bold tracking-tight text-foreground"` — never accent-colored.

---

## Modal layout

→ **Copiar verbatim de `components.instructions.md § R · Modal JSX completo`**  
→ Las variables computadas (`iconBadgeBg`, `icon`, `subtitle`) están en **§ B**  
→ Las funciones (`openCreate`, `openView`, `startEdit`, `cancelEdit`, `handleSave`) están en **§ C**

---

## ViewField + SectionDivider

→ **Copiar verbatim de `components.instructions.md § N · ViewField + SectionDivider`**  
Reglas de valores vacíos y numéricos también están en esa sección.

---

## View mode grid

```tsx
<div className="grid grid-cols-2 gap-3">
  <SectionDivider label="SECCION" />
  <div className="col-span-2"><ViewField label="Nombre" value={...} /></div>
  <ViewField label="Campo A" value={...} />
  <ViewField label="Campo B" value={...} />
</div>
```

- `gap-3` between cards. Full-width: wrap in `<div className="col-span-2">`. Half-width: no wrapper.
- País: show flag + nombre in a custom div (see ui-conventions.instructions.md geo rules).
- Boolean: `<Checkbox>` free-floating — **no card container**. Use `<div className="flex items-center gap-2 py-1"><Checkbox checked={!!record.field} disabled /><span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Label</span></div>`. Same rule in edit mode: `<div className="flex items-center gap-2 py-1"><Checkbox id="..." .../><Label htmlFor="...">Label</Label></div>` — never wrap in `rounded-lg bg-muted/50 border` containers.
- Logo: `<img>` inside a `col-span-2` muted card.

### Field width annotations in TABS_MODAL

Every field listed in a spec's `TABS_MODAL` section **must** carry a width annotation so the implementer knows the grid span without guessing:

| Annotation | Grid behaviour | When to use |
|---|---|---|
| `(full)` | `col-span-2` — occupies the whole row | Long text, addresses, names, selects with long options, any field that needs room |
| `(half)` | occupies one column; the next `(half)` field fills the other | Short codes, numbers, booleans paired side by side |
| `(third)` | occupies one third of the row; **must appear in groups of 3** | Three short fields that logically belong together (e.g. day / month / year, or code / type / status) |

**Rule:** the spec author decides width based on field semantics and expected content length. The implementer applies it literally.

**Thirds implementation:** the outer grid stays `grid-cols-2`. Three consecutive `(third)` fields are wrapped in a single `col-span-2` container that creates an inner 3-column grid:

```tsx
{/* view mode */}
<div className="col-span-2 grid grid-cols-3 gap-3">
  <ViewField label="Dia"  value={...} />
  <ViewField label="Mes"  value={...} />
  <ViewField label="Anio" value={...} />
</div>

{/* edit mode */}
<div className="col-span-2 grid grid-cols-3 gap-4">
  <div className="grid gap-1"><Label ...>Dia</Label><Input ... /></div>
  <div className="grid gap-1"><Label ...>Mes</Label><Input ... /></div>
  <div className="grid gap-1"><Label ...>Anio</Label><Input ... /></div>
</div>
```

Examples in spec syntax:
```
  - nombre            (view + edit; full)
  - empresa           (view + edit; half)
  - proyecto          (view + edit; half)
  - dia               (view + edit; third)
  - mes               (view + edit; third)
  - anio              (view + edit; third)
  - activo            (view + edit; half — Checkbox 0/1)
  - predeterminado    (view + edit; half — Checkbox 0/1)
```

---

## Edit mode grid

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="col-span-2 grid gap-1">
    <Label htmlFor="campo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Label *</Label>
    <Input id="campo" ... />
  </div>
</div>
```

- `gap-4` between fields, `gap-1` inside each field wrapper (label  input).
- All `<Label>`: `className="text-[11px] font-semibold tracking-wider text-muted-foreground"`.
- **Checkbox vertical alignment in edit mode grids**: A checkbox wrapper is shorter than a `grid gap-1 { label + input }` cell, so it floats to the top. Fix by adding `items-end` to the parent grid container AND `pb-1` to the checkbox wrapper div. This bottom-aligns the checkbox with the baseline of neighboring input fields.

  ```tsx
  {/* ✅ Correct — parent has items-end; checkbox wrapper has pb-1 */}
  <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
    <div className="grid gap-1">
      <Label ...>Moneda *</Label>
      <Select ...>...</Select>
    </div>
    <div className="flex items-center gap-2 pb-1">
      <Checkbox id="promesa_vencida" ... />
      <Label htmlFor="promesa_vencida" ...>Promesa Vencida</Label>
    </div>
  </div>

  {/* ✅ Also correct for half-width pairs — add items-end to the cols-2 row */}
  <div className="grid grid-cols-2 gap-4 items-end">
    <div className="grid gap-1"><Label ...>Tipo</Label><Select .../></div>
    <div className="flex items-center gap-2 pb-1"><Checkbox .../><Label ...>Activo</Label></div>
  </div>

  {/* ❌ Wrong — no items-end on parent; checkbox floats to the top of the row */}
  <div className="col-span-2 grid grid-cols-3 gap-4">
    <div className="grid gap-1"><Label ...>Moneda *</Label><Select .../></div>
    <div className="flex items-center gap-2"><Checkbox .../><Label ...>Promesa Vencida</Label></div>
  </div>
  ```

  **Exception**: When a checkbox is full-width (`col-span-2`) on its own row, it does not need alignment adjustments.
- **`<SelectTrigger>` width**: always add `className="w-full"` so the trigger fills its grid column. The base component defaults to `w-fit`, which causes it to shrink/expand with the selected text. This applies to every `<Select>` in edit mode, regardless of field width (full, half, third).
- Geo cascade: use native `<select>` (not Shadcn `<Select>`) with class:
  `flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50`
- Phone fields: see **PhoneField pattern** section below for the full implementation.
- **Numeric input spin buttons**: By default, `type="number"` inputs show up/down spin buttons. Control this per field:
  - **Con spin** (`sin-spin: false`): small bounded integers where stepping one-by-one is useful (e.g. `dias_fecha`, `formato`). No extra class needed — browser default.
  - **Sin spin** (`sin-spin: true`): large free-entry numbers where the spinner is useless and confusing (e.g. `correlativo`, monetary amounts, phone numbers). Add `className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"` to the `<Input>`.
  - The spec for each screen must mark each numeric field as `sin-spin: true/false` so the implementer knows which to apply.

- **Hardcoded Select fields**: When a `<Select>` has fixed options (not loaded from DB), define a `const` map or array above the component, use the **numeric code** as `value` in `<SelectItem>`, store the code in the form/DB, and display the label/description everywhere (edit mode `<SelectValue>`, view mode `<ViewField>`). Always use the render-prop on `<SelectValue>` — Base UI renders the raw value string without it, even for hardcoded selects. Example:
  ```tsx
  // definition (outside component)
  const TIPO_ID_LABELS: Record<number, string> = { 0: 'NIT', 1: 'DPI', 2: 'Extranjero' }

  // edit mode
  <Select value={String(form.tipo_id)} onValueChange={(v) => f('tipo_id', Number(v))}>
    <SelectTrigger>
      <SelectValue>
        {(v: string) => v !== '' ? (TIPO_ID_LABELS[Number(v)] ?? v) : null}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      {Object.entries(TIPO_ID_LABELS).map(([k, v]) => (
        <SelectItem key={k} value={k}>{v}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  // view mode
  <ViewField label="Tipo ID" value={TIPO_ID_LABELS[viewTarget.tipo_id] ?? `#${viewTarget.tipo_id}`} />
  ```

- **DB-loaded Select fields**: When a `<Select>` stores a numeric FK code but must display a name (loaded from DB), always add the render-prop child to `<SelectValue>` so the selected item shows the name — not the raw code. Use the entity's `Map` (e.g. `bancoMap`, `empresaMap`):
  ```tsx
  // Always — without this, Base UI SelectValue renders the raw value string after selection
  <SelectValue placeholder="Selecciona banco">
    {(v: string) => v ? (bancoMap.get(Number(v)) ?? v) : null}
  </SelectValue>
  ```
  This applies to **every** FK `<Select>`: empresa, proyecto, fase, banco, cuenta bancaria, vendedor, cobrador, etc.

  > **Exception — entities where `codigo` IS the display value:** Some entities have no separate `nombre` field; the `codigo` itself is the human-readable label (e.g. `manzana`, `serie_recibo`, `serie_factura`). For these, `<SelectValue />` clean (no render-prop) is correct — the raw value shown is already the display name. Do **not** add a lookup render-prop for them.

  > **❌ Antipatrón — NO usar hijo estático que lee `form.field` directamente:**
  > ```tsx
  > // WRONG — le quita al componente control del estado; el placeholder nunca se muestra correctamente
  > <SelectValue placeholder="Selecciona empresa">
  >   {empresaMap.get(form.empresa) ?? 'Selecciona empresa'}
  > </SelectValue>
  > ```
  > Usar **siempre** la render function `{(v: string) => v ? (...) : null}` para **todos** los selects — tanto FK (DB-loaded) como hardcoded. La diferencia es solo la función de lookup: para FK usar el Map de entidades; para hardcoded usar el Record de constantes con `Number(v)` como key.

- **Auto-select first item on form open**: Every `<Select>` (hardcoded or DB-loaded) **must** pre-select its first available item when the create dialog opens (`openCreate`) and whenever a cascade resets a downstream field. This speeds up data entry.
  - In `openCreate`: compute the first valid value for every dropdown and pass them to `setForm({...EMPTY_FORM, ...})` explicitly.
  - In the cascade inside `f()`: after resetting downstream fields, compute and set the first valid value for each one.
  - **Exception**: the `ClienteCombobox` is never auto-selected — it must always be chosen explicitly by the user.
  - Hardcoded dropdowns: pre-select the first key of the map/array (e.g. `forma_pago = Number(Object.keys(FORMAS_PAGO)[0])`).
  - DB-loaded dropdowns with cascades (fase → manzana → lote): follow the same cascade order, computing each first value from the filtered list.

---

## Hardcoded dropdown catalog

Catalog of all `Record<number, string>` constants used across the app. When a screen needs one of these, copy the constant definition verbatim — never redefine values differently. When a new constant is added, append it here.

```ts
// Tipo de identificación tributaria
const TIPO_ID_LABELS: Record<number, string> = {
  0: 'NIT',
  1: 'DPI',
  2: 'Extranjero',
}

// Regímenes de ISR (importar de @/lib/constants → REGIMENES_ISR)
// { 0: 'General', 1: 'Pequeño Contribuyente', ... } — ver constants.ts

// Regímenes de IVA (importar de @/lib/constants → REGIMENES_IVA)
// { 0: 'General', 1: 'Pequeño Contribuyente', ... } — ver constants.ts

// Formas de pago para reservas/transacciones de cobro
const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Depósito',
  4: 'Transferencia',
}

// Forma de cálculo — método de cálculo en tipos de ingreso (otros cargos)
const FORMA_CALCULO_OTROS: Record<number, string> = {
  1: 'Monto Mensual Fijo',
  2: '% (Anual) Precio Lote',
  3: '% (Anual) Precio Lote - Enganche',
  4: '% (Anual) Saldo Capital',
  5: '% Capital Cuota',
}
```

> **Regla:** la clave es siempre un entero (`number`). El primer item del `Record` es el pre-seleccionado por defecto en `openCreate()`. Si el backend almacena el campo como `smallint`, usar `Number(v)` en los handlers del Select.

---

## Moneda — patrón estándar

Toda pantalla que muestre o edite un campo de moneda debe seguir este patrón sin excepción.

### Origen de datos

- **`getMonedas()`** en `src/app/actions/geo.ts` — lee `cartera.t_moneda`. Llamar en `page.tsx` dentro del `Promise.all` y pasar como prop `monedas: Moneda[]` al Client Component.
- **Nunca** usar la constante `CURRENCIES` hardcodeada ni crear listas locales.

### Bandera

- Declarar `CURRENCY_FLAG_MAP` como constante de módulo en el `_client.tsx` (fuera del componente):

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

### Select editable (nuevo / editar)

```tsx
<Select value={form.moneda} onValueChange={(v) => f('moneda', v)}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Selecciona moneda">
      {(v: string) => {
        const flag = CURRENCY_FLAG_MAP.get(v)
        return flag ? (
          <span className="flex items-center gap-2">
            <img src={`https://flagcdn.com/w20/${flag}.png`} alt={v} width={20} height={14} className="object-cover rounded-sm shrink-0" />
            <span>{v}</span>
          </span>
        ) : null
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

### ViewField (solo lectura)

```tsx
{(() => {
  const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda ?? '')
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
      <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">Moneda</span>
      {flag ? (
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <img src={`https://flagcdn.com/w20/${flag}.png`} alt={viewTarget.moneda ?? ''} width={20} height={14} className="object-cover rounded-sm shrink-0" />
          {viewTarget.moneda}
        </span>
      ) : <span className="text-sm font-medium">{viewTarget.moneda ?? '—'}</span>}
    </div>
  )
})()}
```

### Display inline (tabla u otro contexto)

```tsx
{(() => {
  const flag = CURRENCY_FLAG_MAP.get(row.moneda)
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} alt={row.moneda} width={20} height={14} className="rounded-[2px] shrink-0" />}
      {row.moneda}
    </span>
  )
})()}
```

---

Use `<PhoneField>` from `@/components/ui/phone-field` for every telephone field. Import `DIAL_CODES` and `splitPhone` from the same module.

### State

Declare two local state pairs per phone field, **after** the `form` useState:

```ts
const [tel1Iso, setTel1Iso] = useState('')
const [tel1Local, setTel1Local] = useState('')
const [tel2Iso, setTel2Iso] = useState('')
const [tel2Local, setTel2Local] = useState('')
```

### Sync on edit open

When opening edit mode, use `splitPhone` to decompose the stored value:

```ts
const { iso, local } = splitPhone(cliente.telefono1)
setTel1Iso(iso); setTel1Local(local)
```

Or use `useEffect` to react to `form.telefono1` changes (placed after the `form` useState):

```ts
useEffect(() => {
  if (!form.telefono1) return
  const { iso, local } = splitPhone(form.telefono1)
  setTel1Iso(iso); setTel1Local(local)
}, [form.telefono1])
```

### JSX

```tsx
<PhoneField
  iso={tel1Iso}
  local={tel1Local}
  onIsoChange={(v) => {
    setTel1Iso(v)
    f('telefono1', v && DIAL_CODES[v] ? `+${DIAL_CODES[v]}${tel1Local}` : tel1Local)
  }}
  onLocalChange={(v) => {
    setTel1Local(v)
    f('telefono1', tel1Iso && DIAL_CODES[tel1Iso] ? `+${DIAL_CODES[tel1Iso]}${v}` : v)
  }}
  placeholder="Número local"
/>
```

The stored value in `form.telefono1` is `+{dialCode}{local}` when a country with a dial code is selected, or just `local` otherwise. Do **not** reimplement `splitPhone` — it already handles these cases.

### Initialization in openCreate()

When the dialog opens for create, initialize the ISO codes to the pre-selected country (see **Country / Geo pre-selection in openCreate()** below):

```ts
setTel1Iso(detectedCountryIso); setTel1Local('')
setTel2Iso(detectedCountryIso); setTel2Local('')
```

---

## Country / Geo pre-selection in openCreate()

Any screen that stores a `pais` / `direccion_pais` field **must** pre-select a sensible default when the create dialog opens. Use this 3-level priority chain:

1. **Project country** — read `pais` (or `direccion_pais`) from the active project record (`proyectos.find(p => p.codigo === firstProyecto)`).
2. **Empresa country** — if the project field is null/empty, read the same field from the active empresa record (`empresas.find(e => e.codigo === firstEmpresa)`).
3. **IP geolocation** — if both are null/empty, call `fetch('https://ipapi.co/json/')` and read `country_code` from the JSON response. Wrap in `.catch(() => {})` — never block the dialog on a network failure.

After obtaining the ISO-2 code from any of the three sources:
- Verify the code exists in the `paises` prop array. If not, fall back to `paises[0].codigo`. If `paises` is empty, use `''`.
- Apply the geo cascade immediately: pre-select the first matching `departamento` for that country, then the first matching `municipio` for that country + departamento. Use `''` for each level if no matches exist.
- Initialize phone field ISO states (`tel1Iso`, `tel2Iso`) to the same country code.

```ts
function applyWithPais(paisCode: string) {
  const resolved = paises.find((p) => p.codigo === paisCode) ? paisCode : (paises[0]?.codigo ?? '')
  const firstDepto = departamentos.find((d) => d.pais === resolved)
  const deptoCod = firstDepto?.codigo ?? ''
  const municipioCod = firstDepto
    ? (municipios.find((m) => m.pais === resolved && m.departamento === deptoCod)?.codigo ?? '')
    : ''
  setForm((prev) => ({ ...prev, direccion_pais: resolved, direccion_departamento: deptoCod, direccion_municipio: municipioCod }))
  setTel1Iso(resolved); setTel2Iso(resolved)
}

// In openCreate():
const paisFromProject = firstProyecto?.pais ?? ''
const paisFromEmpresa = firstEmpresa?.pais ?? ''
if (paisFromProject) {
  applyWithPais(paisFromProject)
} else if (paisFromEmpresa) {
  applyWithPais(paisFromEmpresa)
} else {
  fetch('https://ipapi.co/json/')
    .then((r) => r.json())
    .then((d: Record<string, unknown>) => { if (d.country_code) applyWithPais(d.country_code as string) })
    .catch(() => {})
}
```

> **Screens without geo cascade** (e.g. those without `departamento` / `municipio`): apply the same 3-level detection but skip the cascade steps. Use the ISO code only to pre-fill the `pais` field.

---

## Delete dialog

```tsx
<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar <entidad>?</AlertDialogTitle>
      <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente <strong>{deleteTarget?.nombre}</strong>.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

> **Base UI constraint:** `AlertDialogDescription` does NOT support `asChild` (that is a Radix UI pattern). If the description needs to contain block-level content (lists, multiple paragraphs), use the `render` prop to change the root element: `<AlertDialogDescription render={<div />}>`. Never nest `<p>` inside `AlertDialogDescription` — use `<div>` instead to avoid the hydration error `<p> cannot be a descendant of <p>`.

---

## Status badge variants

Use these classes for status/state badges anywhere in the UI (table cells, transaction headers, detail cards). These complement the `activo` badge rule in `ui-conventions.instructions.md`.

```tsx
// success — confirmed, active, paid
<Badge variant="secondary" className="font-normal bg-green-100 text-green-700">Confirmado</Badge>

// error — cancelled, rejected, overdue
<Badge variant="secondary" className="font-normal bg-red-100 text-red-700">Anulado</Badge>

// warning — pending, expiring, draft
<Badge variant="secondary" className="font-normal bg-amber-100 text-amber-700">Borrador</Badge>

// info — informational, neutral state
<Badge variant="secondary" className="font-normal bg-blue-100 text-blue-700">En Proceso</Badge>

// default — muted/neutral
<Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">Sin Estado</Badge>
```

**Rules:**
- Always use `variant="secondary"` as the base — it disables the default shadcn/ui color.
- Always include `font-normal` — `variant="secondary"` inherits `font-medium` which is too heavy for status text.
- Map all status values to one of the five variants above; never use raw accent colors for status badges.
- Define a `const` map above the component for multi-state entities (avoids inline conditionals):
  ```tsx
  const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
    borrador:   { label: 'Borrador',   className: 'bg-amber-100 text-amber-700' },
    confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-700' },
    anulado:    { label: 'Anulado',    className: 'bg-red-100   text-red-700'   },
  }
  // Usage:
  const badge = ESTADO_BADGE[row.estado] ?? { label: row.estado, className: 'bg-muted text-muted-foreground' }
  <Badge variant="secondary" className={`font-normal ${badge.className}`}>{badge.label}</Badge>
  ```

---

## Audit log dialog

```tsx
<AuditLogDialog
  open={!!auditTarget}
  onOpenChange={(o) => !o && setAuditTarget(null)}
  tabla="t_<entity>"
  cuenta={auditTarget.cuenta}
  codigo={auditTarget.codigo}
  titulo={auditTarget.nombre}
/>
```

---

## Permission mapping to UI

Applies to every CRUD screen. The three permissions from `t_menu_usuario` map to UI as follows:

| Permission | UI effect |
|---|---|
| `agregar`   | Shows/hides the **"Nuevo {NOMBRE}"** button in the toolbar — `{NOMBRE}` is the singular entity name declared in the prompt's `IDENTIFICACION.NOMBRE` field |
| `modificar` | Shows/hides the **"Editar"** button in the modal footer; changes the row dropdown label to **"Ver / Editar"** vs **"Ver"** |
| `eliminar`  | Shows/hides the **"Eliminar"** option in the row action dropdown |

Fetch in `page.tsx` using the `PERMISO` constant from the prompt's `IDENTIFICACION` table:

```ts
const permisos = await getPermisosDetalle(PERMISOS.{PERMISO})
// pass as props:
puedeAgregar={permisos.agregar}
puedeModificar={permisos.modificar}
puedeEliminar={permisos.eliminar}
```

---

## TABS_MODAL spec format

Each spec's `TABS_MODAL` section uses **one table per section** to declare fields. The rules below are global — do not repeat them inside spec files.

### Global structure rules

- The first tab is always **General** and is mandatory. Add tabs only if the screen requires it.
- Each tab groups fields under `SectionDivider` headings listed top-to-bottom in visual order.
- Fields not shown in a given mode get `—` in that column.
- When Nuevo and Edit are identical for all fields in a section, collapse into a single `Nuevo / Edit` column.

### Table format

```markdown
### Tab: General  (icono: <NombreIconoLucide>)

**[NOMBRE_SECCION]**

| Campo  | Label  | Ancho | View      | Nuevo      | Edit             | Notas |
|--------|--------|-------|-----------|------------|------------------|-------|
| campo1 | Label1 | full  | ViewField | Input; req | Input; req       |       |
| campo2 | Label2 | half  | ViewField | Select     | Select; disabled |       |
| campo3 | Label3 | half  | —         | —          | —                |       |
```

### Column legend

**Ancho:** `full` | `half` | `third` — same semantics as the grid width annotations above.

**View / Nuevo / Edit values:**

| Value               | Meaning |
|---------------------|---------|
| `ViewField`         | Standard read-only card (`rounded-lg bg-muted/50`) — label + value |
| `Checkbox card`     | `<Checkbox disabled />` inside a ViewField-style card (label above, checkbox below) |
| `Moneda display`    | Apply **Moneda display rules** from `ui-conventions.instructions.md` |
| `Input`             | `<Input>` text field |
| `Input; req`        | Required `<Input>` |
| `Input number ≥ 0`  | `type="number"` with `Math.max(0, …)` clamp |
| `Select`            | `<Select>` loaded from prop |
| `Select; disabled`  | `<Select disabled={!!viewTarget}>` — readonly after creation |
| `Select nullable`   | `<Select>` with blank first option (`value=""`) representing `null` in DB |
| `Checkbox 0/1`      | `<Checkbox>` storing smallint 0/1 |
| `—`                 | Field not shown in this mode |

**Notas column:** short constraint or cross-reference (`ver REGLA #N`). Full details go in `REGLAS_ESPECIFICAS`.

### Adding more tabs

```markdown
### Tab: <Nombre>  (icono: <NombreIconoLucide>)

**[NOMBRE_SECCION]**

| Campo | Label | Ancho | View | Nuevo / Edit | Notas |
|-------|-------|-------|------|--------------|-------|
| ...   | ...   | ...   | ...  | ...          | ...   |
```

---

## Canonical reference file

El archivo de referencia canónica del patrón es:
`src/app/dashboard/cuentas-cobrar/series-recibos/_client.tsx`

Es la implementación más completa y actualizada del proyecto. Usarlo como referencia concreta al generar un nuevo screen.
