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
| Vendedores       | `lime-100 / lime-600`         |
| Tipos Ingresos   | `yellow-100 / yellow-600`     |

Used in: modal header gradient (`from-{accent}-50/70`), icon badge bg, table active row bg, sticky code cell border/text.

---

## Module group color buckets

When adding a new entity, pick a tone from the bucket of its parent module group **before** choosing an arbitrary color. Then verify the exact token is not already in use in the master accent table above.

| Module group | Suggested tones |
|---|---|
| Cartera (receivables, collections) | sky, cyan, blue, indigo |
| Catalogos (entities, people, places) | emerald, teal, green, lime |
| Tesoreria (banks, payments, series) | amber, orange, yellow |
| Configuracion (system, roles, menus) | violet, purple, fuchsia |

> **Rule:** always verify the chosen tone is not already in the master accent table above before assigning it.

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
| Vendedores       | `UserCheck`      |
| Tipos Ingresos   | `Tags`           |

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

**Every `_client.tsx` must declare a `f()` helper** that applies normalization before updating form state. Using `setForm` inline directly on a text `<Input>` is **forbidden** — it bypasses this rule.

```ts
// ── Module-level constant (outside the component) ──────────────────────────
// List every string key that must NOT be uppercased.
// Number fields are skipped automatically by the typeof guard.
const SKIP_KEYS = new Set<keyof MyEntityForm>(['correo', 'moneda', ...])

// ── Inside the component ───────────────────────────────────────────────────
function f(key: keyof MyEntityForm, value: string | number) {
  const v = typeof value === 'string' && !SKIP_KEYS.has(key)
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    : value
  setForm((p) => ({ ...p, [key]: v }))
}
```

Usage in JSX:
```tsx
<Input onChange={(e) => f('nombre', e.target.value)} />   // ✅ normalized
<Input onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />  // ❌ bypasses normalization
```

**Keys that must always be in SKIP_KEYS** (never uppercased):
`correo`, `pais` / `direccion_pais`, `departamento` / `direccion_departamento`, `municipio` / `direccion_municipio`, `moneda`, `medida`, `manzana` (in LoteForm).

**Spec-level exception — "only remove accents, no uppercase":**
When the spec notes `NO normalizar a mayúsculas; SÍ quitar tildes` for a field, add it to `SKIP_KEYS` **and** apply accent-only removal directly in its `onChange`:
```tsx
// Field is in SKIP_KEYS → f() won't uppercase it.
// Apply accent removal inline so the field still gets sanitized.
<Input onChange={(e) => f('etiqueta', e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))} />
```

---

## Activo column — global badge rule

The `activo` field (smallint 0/1) renders as a badge in every table and as a `Checkbox card` in every view mode modal. No exceptions unless the spec explicitly overrides.

→ **Snippets verbatim en `components.instructions.md § Y · Campo activo`** (tabla, vista y edición).

- **Table cell:** Badge verde `Activo` cuando `activo === 1`, badge muted `Inactivo` cuando `activo === 0`.
- **View mode:** `<Checkbox>` disabled dentro de card `rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5`.
- **Edit mode:** Para checkboxes que comparten fila con input/select → ver **§ J** en `components.instructions.md`.

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

## Typography scale

Consistent type sizes used across all components. Do not introduce sizes outside this scale without a documented reason.

| Token | Tailwind class | Size | Usage |
|-------|---------------|------|-------|
| `xs`   | `text-[11px]`  | 11 px | Labels above inputs (`font-semibold tracking-wider`), table header text, badge text |
| `sm`   | `text-xs`      | 12 px | Secondary labels, subtitles, `SectionDivider` text |
| `base` | `text-sm`      | 14 px | Body text, input values, table cell content, `ViewField` values (`text-[13px]` ≈ base) |
| `lg`   | `text-base`    | 16 px | Modal titles, section headings |
| `2xl`  | `text-xl`      | 20 px | Page `<h1>` — always paired with `font-bold tracking-tight` |

Font weights in use: `400` (normal), `500` (medium / `font-medium`), `600` (semibold / `font-semibold`), `700` (bold / `font-bold`).

Font family: Inter, system-ui, sans-serif — set globally in `globals.css`; never override per-component.

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

**Global rule — two contexts with different verbosity:**

| Contexto | Formato | Ejemplos |
|----------|---------|---------|
| Display (tabla, ViewField, **Select trigger**) | bandera + ISO code only | `🇬🇹 GTQ` ✅ |
| Selección (**Select dropdown items**) | bandera + ISO | `🇬🇹 GTQ` ✅ |

```
🇬🇹 GTQ           ✅ (trigger, tabla, ViewField, dropdown items)
GTQ               ❌ (sin bandera)
USD (US Dollar)   ❌ (sin bandera, mal formato)
```

> **Razón:** el trigger es compacto (espacio limitado); el dropdown también muestra bandera + código ISO para consistencia visual.

→ **Snippets verbatim (CURRENCY_FLAG_MAP, tabla, ViewField, Select trigger, Select items, ColumnFilter):**  
→ **`components.instructions.md § W · Select moneda con bandera`**

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
