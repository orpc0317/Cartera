---
description: "Cartera app UI constants: accent colors per module, label naming rules, geo/flag rules, text normalization, and number formatting. Load for every _client.tsx."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera — UI Conventions

## Accent color per module

| Module     | Token pair                  |
|------------|-----------------------------|
| Empresas   | `emerald-100 / emerald-600` |
| Proyectos  | `sky-100 / sky-600`         |
| Fases      | `violet-100 / violet-600`   |
| Manzanas   | `amber-100 / amber-600`     |
| Lotes      | `rose-100 / rose-600`       |
| Clientes     | `indigo-100 / indigo-600`   |
| Supervisores | `purple-100 / purple-600`   |
| Supervisores | `purple-100 / purple-600` |

Used in: modal header gradient (`from-{accent}-50/70`), icon badge bg, table active row bg, sticky code cell border/text.

---

## Label naming rules

- **No accents/tildes** — `Codigo` not `Código`, `Direccion` not `Dirección`, `Regimen` not `Régimen`.
- **Title Case** — every word starts with a capital letter, **except** short prepositions and articles (`de`, `del`, `por`, `la`, `el`, `en`, `a`, `y`, `o`). Examples: `Cod. Postal`, `Razon Social`, `Nombre Factura`, `Regimen IVA`, `Unidad Medida`, `Fecha de Nacimiento`.
- Applies everywhere: `ALL_COLUMNS[].label`, `<TableHead>` stickies, `<ViewField label=...>`, `<Label>` in forms, toast messages.
- **Exception:** Section divider titles stay ALL-CAPS (rendered with `uppercase` CSS).

---

## Geo / country rules

- `pais` stores ISO-2 code (e.g. `'GT'`). `departamento` / `municipio` store numeric varchar codes.
- **Always resolve codes to names** via the `paises` / `departamentos` / `municipios` prop arrays.
- **Pais must always show the flag** (`https://flagcdn.com/w20/{iso.toLowerCase()}.png`, `width={20} height={14}`) to the left of the country name — in table cells, ViewField, and edit previews. No exceptions.
- Never display a raw code for Pais, Departamento, or Municipio.

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

## Number formatting

```ts
// Monetary / decimal — locale es-GT, always 2 decimal places
const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```

- `fmt()` → mora amounts, minimum amounts, any currency amount.
- `String(n)` → plain integers only (días, códigos).
