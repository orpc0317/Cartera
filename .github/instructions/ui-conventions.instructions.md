---
description: "Cartera app UI constants: accent colors per module, label naming rules, geo/flag rules, text normalization, and number formatting. Load for every _client.tsx."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera — UI Conventions

## Accent color per module

> **IMPORTANTE — tabla maestra de colores:** esta es la unica fuente de verdad para colores de acento.
> Al generar una pantalla nueva, la IA debe:
> 1. Leer esta tabla para determinar que colores ya estan en uso.
> 2. Elegir un tono de Tailwind que no figure en la columna "Token pair".
> 3. Agregar la fila del nuevo modulo a esta tabla al final de los archivos generados.

| Module           | Token pair                    |
|------------------|-------------------------------|
| Empresas         | `emerald-100 / emerald-600`   |
| Proyectos        | `sky-100 / sky-600`           |
| Fases            | `violet-100 / violet-600`     |
| Manzanas         | `amber-100 / amber-600`       |
| Lotes            | `rose-100 / rose-600`         |
| Clientes         | `indigo-100 / indigo-600`     |
| Supervisores     | `purple-100 / purple-600`     |
| Cobradores       | `orange-100 / orange-600`     |
| Bancos           | `teal-100 / teal-600`         |
| Cuentas Bancarias | `cyan-100 / cyan-600`        |
| Serie Recibos    | `green-100 / gree-600`        |
| Coordinadores    | `blue-100 / blue-600`         |

Used in: modal header gradient (`from-{accent}-50/70`), icon badge bg, table active row bg, sticky code cell border/text.

---

## Module icon per screen

> **IMPORTANTE — tabla maestra de iconos:** esta es la unica fuente de verdad para iconos de modulo.
> Al generar una pantalla nueva, la IA debe:
> 1. Leer esta tabla para verificar que el icono elegido no este ya en uso por otro modulo.
> 2. Si el icono propuesto ya aparece en la tabla, elegir una alternativa semanticamente equivalente.
> 3. Verificar que el icono exista en https://lucide.dev/icons/ antes de usarlo.
> 4. Agregar la fila del nuevo modulo a esta tabla al final de los archivos generados.
>
> **Nota:** `MapPin` es el icono estandar de la pestana **General** en todos los modales — no es un icono de modulo.

| Module            | Lucide icon      |
|-------------------|------------------|
| Empresas          | `Building2`      |
| Proyectos         | `FolderKanban`   |
| Fases             | `Layers`         |
| Manzanas          | `Grid3x3`        |
| Lotes             | `MapPin`         |
| Clientes          | `Users`          |
| Supervisores      | `UserCog`        |
| Cobradores        | `Banknote`       |
| Bancos            | `Landmark`       |
| Cuentas Bancarias | `CreditCard`     |
| Serie Recibos     | `Receipt`        |
| Coordinadores    | `Network`        |

---

## Label naming rules

- **No accents/tildes** — `Codigo` not `Código`, `Direccion` not `Dirección`, `Regimen` not `Régimen`.
- **Title Case** — every word starts with a capital letter, **except** short prepositions and articles (`de`, `del`, `por`, `la`, `el`, `en`, `a`, `y`, `o`). Examples: `Cod. Postal`, `Razon Social`, `Nombre Factura`, `Regimen IVA`, `Unidad Medida`, `Fecha de Nacimiento`.
- Applies everywhere: `ALL_COLUMNS[].label`, `<TableHead>` stickies, `<ViewField label=...>`, `<Label>` in forms, toast messages.
- **Exception:** Section divider titles stay ALL-CAPS (rendered with `uppercase` CSS).

## Numeric codigo display rule

Numeric `codigo` fields (auto-increment PKs) are displayed as plain `N` **without** a `#` prefix anywhere in the UI — table sticky columns, `ViewField`, modal header subtitle. This applies globally to all screens.

```tsx
// ✅ Correct
{row.codigo}
<ViewField label="Codigo" value={String(viewTarget.codigo)} />
<span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>

// ❌ Wrong
#{row.codigo}
<ViewField label="Codigo" value={`#${viewTarget.codigo}`} />
```

---

## Geo / country rules

- `pais` stores ISO-2 code (e.g. `'GT'`). `departamento` / `municipio` store numeric varchar codes.
- **Always resolve codes to names** via the `paises` / `departamentos` / `municipios` prop arrays.
- **Pais must always show the flag** (`https://flagcdn.com/w20/{iso.toLowerCase()}.png`, `width={20} height={14}`) to the left of the country name — in table cells, ViewField, and edit previews. No exceptions.
- Never display a raw code for Pais, Departamento, or Municipio.

---

## Placeholder text rules

> **Scope:** This rule applies **only** to `placeholder=` props in UI components. It has zero effect on data rendered from the database — all DB-sourced text is always stored and displayed UPPERCASE with accents removed (see *Text input normalization* below).

- **Sentence case** — first letter of the entire placeholder string uppercase, all other letters lowercase.
  - ✅ `"Selecciona empresa"`, `"Nombre del proyecto"`, `"Buscar clientes..."`, `"Correo@ejemplo.com"`
  - ✅ `"Ej: fase 1, etapa a..."` — the "Ej:" opening starts with uppercase E; the rest is lowercase
  - ❌ `"Nombre Del Proyecto"` (Title Case), `"CUENTA OPERATIVA"` (all-caps), `"Ej: Fase 1, Etapa A"` (uppercase mid-string)
  - **Exception**: genuine abbreviations/codes that are inherently uppercase remain uppercase even in the middle of a placeholder (e.g. `"NIT o equivalente"`, `"Ej: NIT, DPI..."`, numeric/code examples like `"Ej: 01001"`, `"Ej: A, B, REC1..."`)
- Applies to **every** `placeholder=` prop: `<Input>`, `<Textarea>`, `<SelectValue placeholder=...>`, search boxes.

---

## Text input normalization

All user-typed text → stored **UPPERCASE, accents removed**. Apply inside `f()` before setting form state:

```ts
const v = typeof value === 'string' && !SKIP_KEYS.has(key)
  ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  : value
```

**Keys in SKIP_KEYS (must NOT be sanitized):**
`correo`, `pais` / `direccion_pais`, `departamento` / `direccion_departamento`, `municipio` / `direccion_municipio`, `moneda`, `medida`, `manzana` (in LoteForm).
Number fields are skipped automatically by the `typeof === 'string'` guard.

---

## Activo column — global badge rule

The `activo` field (smallint 0/1) renders as a badge in every table and as a `Checkbox card` in every view mode modal. No exceptions unless the spec explicitly overrides.

- **Table cell:** `<Badge variant="secondary" className="font-normal bg-emerald-100 text-emerald-700">Activo</Badge>` when `activo === 1`; `<Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">Inactivo</Badge>` when `activo === 0`.
- **View mode:** `<Checkbox checked={!!record.activo} disabled />` inside a `rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5` card (same container as `ViewField`), label above in `text-[10px] font-bold tracking-widest text-muted-foreground/55`.

---

## Number formatting

```ts
// Monetary / decimal — locale es-GT, always 2 decimal places
const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```

- `fmt()` → mora amounts, minimum amounts, any currency amount.
- `String(n)` → plain integers only (días, códigos).

---

## Select (dropdown) rendering rule

This app uses **Base UI** (`@base-ui/react/select`). `SelectValue` does **not** automatically display the children of the selected `SelectItem` — it shows the raw `value` string unless you provide a render function.

**Always** pass a render-function child to `SelectValue` whenever the option values are codes/IDs:

```tsx
// ✅ Correct — shows the name, stores the code
<Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
  <SelectTrigger>
    <SelectValue placeholder="Selecciona una empresa">
      {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
  </SelectContent>
</Select>

// ❌ Wrong — shows the numeric code after selection
<SelectValue placeholder="Selecciona una empresa" />
```

- For optional/"all" filters where empty means no filter: use `value=""` for the blank state (not `"0"`) so the placeholder shows instead of a code.
- The render function receives the selected `value` string; resolve it to a label via the corresponding `Map` (e.g. `empresaMap`, `vendedorMap`).

---

## Moneda display rules

**Global rule — applies everywhere: table cells, ViewField cards, Select triggers, Select items, CSV export.**

Display format: **flag + ISO code only**. Never show the currency name.

```
🇬🇹 GTQ     ✅
🇺🇸 USD     ✅
GTQ — Quetzal guatemalteco  ❌
USD (US Dollar)             ❌
```

### Table cells

```tsx
case 'moneda': {
  const flag = CURRENCY_FLAG_MAP.get(cb.moneda)
  return (
    <TableCell key="moneda" className="text-muted-foreground">
      {flag ? (
        <span className="flex items-center gap-1.5">
          <img src={`https://flagcdn.com/w20/${flag.toLowerCase()}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
          {cb.moneda}
        </span>
      ) : cb.moneda || '—'}
    </TableCell>
  )
}
```

### ViewField card (view mode)

```tsx
<div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
  <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Moneda</span>
  {(() => {
    const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda)
    return flag ? (
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <img src={`https://flagcdn.com/w20/${flag.toLowerCase()}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
        {viewTarget.moneda}
      </span>
    ) : <span className="text-sm font-medium">{viewTarget.moneda || '—'}</span>
  })()}
</div>
```

### Select trigger (edit / create mode)

```tsx
<SelectValue placeholder="Selecciona moneda">
  {(v: string) => {
    const flag = CURRENCY_FLAG_MAP.get(v)
    return flag ? (
      <span className="flex items-center gap-1.5">
        <img src={`https://flagcdn.com/w20/${flag.toLowerCase()}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
        {v}
      </span>
    ) : v || null
  }}
</SelectValue>
```

### Select items

```tsx
{monedas.map((m) => {
  const flag = CURRENCY_FLAG_MAP.get(m.codigo)
  return (
    <SelectItem key={m.codigo} value={m.codigo}>
      {flag ? (
        <span className="flex items-center gap-2">
          <img src={`https://flagcdn.com/w20/${flag.toLowerCase()}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
          {m.codigo}
        </span>
      ) : m.codigo}
    </SelectItem>
  )
})}
```

### CURRENCY_FLAG_MAP

Local constant in each `_client.tsx` that uses moneda. Maps ISO code → country ISO-2 for `flagcdn.com`.
Only include the currencies that exist in the app; others fall back to code-only display.

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

### Column filter values

When building `uniqueMonedaLabels` for the column filter dropdown, use only the ISO code (no name):

```ts
const uniqueMonedaLabels = useMemo(() =>
  [...new Set(initialData.map((r) => r.moneda))].sort(),
  [initialData]
)
```

And in the filter match:
```ts
if (col === 'moneda') return vals.has(r.moneda)
```

---

## Currency pre-selection from country (COUNTRY_CURRENCY_MAP)

Any screen that has a `moneda` field **must** pre-select a sensible default in `openCreate()` based on the detected country. Use `COUNTRY_CURRENCY_MAP` from `@/lib/constants` to convert the ISO-2 country code to an ISO-4217 currency code.

### Algorithm (apply after country detection — see *Country / Geo pre-selection* in `crud-screens.instructions.md`):

```ts
import { COUNTRY_CURRENCY_MAP } from '@/lib/constants'

const detectedMoneda = COUNTRY_CURRENCY_MAP[detectedCountryIso] ?? ''
const monedaDefault = monedas.find((m) => m.codigo === detectedMoneda)
  ? detectedMoneda
  : (monedas[0]?.codigo ?? '')
setForm((prev) => ({ ...prev, moneda: monedaDefault }))
```

### COUNTRY_CURRENCY_MAP definition (in `src/lib/constants.ts`)

If the map does not yet exist in `constants.ts`, add it:

```ts
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  AR: 'ARS', BO: 'BOB', BR: 'BRL', CA: 'CAD',
  CL: 'CLP', CO: 'COP', CR: 'CRC', CU: 'CUP',
  DO: 'DOP', EC: 'USD', EU: 'EUR', GB: 'GBP',
  GT: 'GTQ', HN: 'HNL', MX: 'MXN', NI: 'NIO',
  PA: 'PAB', PE: 'PEN', PY: 'PYG', SV: 'SVC',
  US: 'USD', UY: 'UYU', VE: 'VES',
}
```

> This map is a **shared constant** — define it once in `@/lib/constants` and import it in every `_client.tsx` that needs currency pre-selection. Never redefine it inline.
