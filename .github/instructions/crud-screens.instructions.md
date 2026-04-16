---
description: "Use when creating or modifying CRUD screens (list + modal) for the Cartera app. Covers page structure, modal look & feel, table conventions, field rendering, labels, section dividers, colors, and form patterns."
applyTo: "src/app/dashboard/**/_client.tsx"
---

# Cartera — CRUD Screen Conventions

## File structure

```
src/app/dashboard/<group>/<entity>/
  page.tsx        ← Server Component: fetch data, pass as props
  _client.tsx     ← Client Component: all UI, state, mutations
```

`page.tsx` always calls `router.refresh()` pattern; mutations live in `src/app/actions/<entity>.ts`.

---

## Color theme per module

| Module     | Accent color | Tailwind token |
|------------|--------------|----------------|
| Empresas   | Emerald      | `emerald-100 / emerald-600` |
| Proyectos  | Sky          | `sky-100 / sky-600` |
| Fases      | Violet       | `violet-100 / violet-600` |
| Manzanas   | Amber        | `amber-100 / amber-600` |
| Lotes      | Rose         | `rose-100 / rose-600` |

The modal header gradient, the icon badge, the table row highlight, and the sticky code cell all use the module accent color.

---

## Modal structure

```tsx
<Dialog modal={false} ...>
  <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

    {/* ── Header ── */}
    <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-{accent}-50/70 to-transparent border-b border-border/50 shrink-0">
      <div className="flex items-center gap-3 pr-8">
        <div className={`shrink-0 rounded-xl p-2 ${badge-bg}`}>
          {/* Icon: EntityIcon when viewing, Plus when creating, Pencil when editing */}
        </div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold leading-tight truncate">
            {/* "Nueva X" | "Editar X" | record.nombre */}
          </DialogTitle>
          {/* Subtitle only when viewing/editing existing record */}
          {viewTarget && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
              <span className="font-mono ml-1.5 text-muted-foreground/60">· #{viewTarget.codigo}</span>
            </p>
          )}
        </div>
      </div>
    </DialogHeader>

    {/* ── Tabs ── */}
    <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0">
        <TabsTrigger value="general" className="gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> General
        </TabsTrigger>
        {/* Additional tabs get SlidersHorizontal, FileText, etc. */}
      </TabsList>

      <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {!isEditing && viewTarget ? <ViewMode /> : <EditMode />}
      </TabsContent>
    </Tabs>

    {/* ── Footer ── */}
    <DialogFooter className="mt-4 shrink-0">
      {!isEditing && viewTarget ? (
        <>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
          <Button onClick={startEdit} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={cancelEdit}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
        </>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Icon badge colors by mode

| Mode        | Background    | Icon color    |
|-------------|---------------|---------------|
| Viewing     | `{accent}-100` | `{accent}-600` |
| Creating    | `{accent}-100` | `{accent}-600` |
| Editing     | `amber-100`   | `amber-600`   |

---

## ViewField component (read-only card)

```tsx
function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">{label}</span>
      <span className="block text-sm font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}
```

**Label convention:** Title-case (first word capitalized, rest lowercase). No `uppercase` CSS. Same casing as the edit-mode `<Label>`.

---

## Special field renderers (view mode)

### Country field (with flag)

> **Rule:** Every time the `pais` field is displayed — in view mode, edit mode previews, or table cells — the corresponding flag image **must** be shown alongside the country name. Never display the raw ISO code or a name without the flag.
>
> All geo fields (`pais`, `departamento`, `municipio`) store **codes** in the DB (ISO for pais, numeric varchar for departamento/municipio). Resolve to names using the `paises` / `departamentos` / `municipios` prop arrays before rendering.

```tsx
// pais stores the ISO code (e.g. 'GT')
const p = paises.find((x) => x.codigo === record.pais)

<div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
  <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">País</span>
  {p ? (
    <span className="flex items-center gap-1.5 text-sm font-medium">
      <img src={`https://flagcdn.com/w20/${p.codigo.toLowerCase()}.png`} alt={p.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />
      {p.nombre}
    </span>
  ) : <span className="text-sm font-medium">—</span>}
</div>
```

### Currency field (with flag)
```tsx
<div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
  <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">Moneda</span>
  {c ? (
    <span className="flex items-center gap-1.5 text-sm font-medium">
      <img src={`https://flagcdn.com/w20/${c.flagIso.toLowerCase()}.png`} alt={c.flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
      {c.iso} — {c.name}
    </span>
  ) : <span className="text-sm font-medium">{value ?? '—'}</span>}
</div>
```

### Boolean field (disabled checkbox)
```tsx
<div className="flex items-center gap-2.5 rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
  <Checkbox checked={!!record.field} disabled />
  <span className="text-sm font-medium">Label del campo</span>
</div>
```
Use for boolean flags: Mora automática, Mora enganche, Promesa vencida, etc.

### Logo field (view mode)
```tsx
<div className="col-span-2 rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-2">
  <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">Logo</span>
  <img src={record.logo_url} alt="Logo" className="max-h-20 max-w-[200px] rounded border border-border object-contain bg-white p-1" />
</div>
```

---

## Section dividers (view & edit mode)

```tsx
<div className="col-span-2 flex items-center gap-2 pt-1">
  <div className="h-4 w-0.5 rounded-full bg-primary/40" />
  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Nombre Sección</span>
  <div className="flex-1 border-t border-primary/30" />
</div>
```

- Vertical accent bar: `bg-primary/40`  
- Label: `text-primary`, `uppercase`, `tracking-wider` (exception to title-case — section titles stay uppercase)  
- Horizontal line: `border-primary/30`

---

## View mode grid layout

```tsx
<div className="grid grid-cols-2 gap-3">
  {/* Full-width fields */}
  <div className="col-span-2"><ViewField label="Nombre" value={...} /></div>

  {/* Half-width fields */}
  <ViewField label="País" value={...} />
  <ViewField label="Departamento" value={...} />

  {/* N fields on one row */}
  <div className="col-span-2 grid grid-cols-4 gap-3">
    <ViewField label="..." value={...} />
    ...
  </div>
</div>
```

Use `gap-3` (not `gap-x-8 gap-y-5`). Each ViewField card provides its own visual separation.

---

## Number formatting

```ts
// Monetary / decimal amounts — always 2 decimal places, locale es-GT
const formatMora = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```

Apply `formatMora` to: mora amounts, minimum amounts, currency amounts.  
Apply `String(n)` only to plain integers (días, códigos).

---

## Table conventions

```tsx
<TableRow className="bg-muted/30">
  <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Código</TableHead>
  ...
  <TableHead className="sticky right-0 z-20 w-12 bg-muted/30" /> {/* actions */}
</TableRow>
```

### Table cell renderers

| Column type | Render |
|-------------|--------|
| Country | Flag img + nombre (lookup by código or nombre) |
| Currency | Flag img + ISO — nombre |
| Boolean | `Badge` or text |
| Code/ID | `font-mono text-xs text-muted-foreground` |
| Nombre | `font-medium` (no color) |
| Rest | `text-muted-foreground` |

Always use `switch` in `visibleCols.map()` for explicit cases, `default` for generic columns.

**Geo columns (departamento, municipio):** Resolve code → name via props arrays.  
**Never display raw codes** for País, Departamento, Municipio.

### Active row highlight
- Row: `bg-{accent}-50 dark:bg-{accent}-950/30`  
- Sticky code cell: `border-l-[3px] border-l-{accent}-600 text-{accent}-700 font-semibold`

---

## Edit mode grid layout

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="col-span-2 grid gap-1.5">
    <Label htmlFor="field">Label *</Label>
    <Input id="field" ... />
  </div>
  ...
</div>
```

Use `gap-4` in edit mode (slightly more breathing room than view mode's `gap-3`).

---

## Edit mode: native `<select>` for geo cascades

```tsx
<select
  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
  ...
/>
```

---

## Text input normalization

**Rule:** All user-typed text is stored **UPPERCASE** with **accents/tildes removed**. The user can type in lowercase; the transformation is applied transparently before saving to state.

Apply the transformation inside `f()` / `handleField()` before setting form state:

```ts
function f(key: keyof XForm, value: string | number) {
  const v = typeof value === 'string' && !SKIP_KEYS.has(key as string)
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    : value
  setForm((prev) => ({ ...prev, [key]: v }))
}
```

**Keys that must NOT be sanitized (pass through as-is):**

| Key | Reason |
|-----|--------|
| `email` | Case-sensitive field |
| `medida` | Hardcoded dropdown with special chars (`v²`, `m²`, `ha`…) |
| `moneda` | Hardcoded ISO currency codes (`GTQ`, `USD`) |
| `pais` | ISO code from geo select |
| `departamento` | Numeric code from geo select |
| `municipio` | Numeric code from geo select |
| `manzana` *(in LoteForm)* | FK code from manzana select |

Number fields are automatically skipped by the `typeof value === 'string'` guard.

---

## Checklist for a new CRUD screen

1. Pick the **accent color** from the module table above
2. Create `page.tsx` (server) + `_client.tsx` (client)
3. Modal header: gradient, icon badge (entity icon / Plus / Pencil)
4. View mode: `ViewField` cards, special renderers for country/currency/boolean
5. Section dividers with `text-primary` / `border-primary/30`
6. Table: sticky code column left, actions column right, column manager, keyboard navigation
7. Geo columns always resolve code → name
8. Monetary fields use `formatMora`
9. Boolean fields in view mode use disabled `Checkbox`
10. Labels: Title-case everywhere except section divider titles (those stay uppercase)
11. Sanitize text inputs via `f()` / `handleField()`: uppercase + remove accents (see "Text input normalization" section)
