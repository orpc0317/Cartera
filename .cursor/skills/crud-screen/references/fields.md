# Snippets — campos

Copia la sección verbatim y reemplaza los placeholders `<angle-bracket>`. No inventes otra variante del control. El patrón de pantalla (`.cursor/rules/patterns.mdc`) define el layout y no cambia cómo se ve un Input, un Select o un Checkbox. Si el control no está en estas secciones, detente y pregunta.

Cursor no inyecta este archivo. Ábrelo cuando el skill `crud-screen` lo nombre.

Secciones: D, E, F, G, H, I, J, N, O, P, Y, Z, AD, AE.

## D · Form — Text Input

Requires `f()` helper (see `.cursor/rules/ui-conventions.mdc § Text input normalization`).

El asterisco de un campo requerido es `<RequiredMark />` (`@/components/ui/required-mark`). Es rojo. Va con un espacio antes del componente. No se escribe ` *` en el texto del label.

```tsx
<div className="grid gap-1">
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text> <RequiredMark />
  </Label>
  <Input
    id="<field>"
    variant="l-border"
    aria-invalid={campoInvalido?.id === '<field>' || undefined}
    value={form.<field>}
    onChange={(e) => f('<field>', e.target.value)}
    placeholder="<Sentence case placeholder>"
  />
</div>
```

---


## E · Form — Number Input

**With spin** (small bounded integers — e.g. `dias_fecha`, `formato`):
```tsx
<Input
  id="<field>"
  type="number"
  aria-invalid={campoInvalido?.id === '<field>' || undefined}
  value={form.<field>}
  onChange={(e) => f('<field>', Number(e.target.value))}
/>
```

**Without spin** (large numbers, correlativo, monetary amounts — spec marks `sin-spin: true`):
```tsx
<Input
  id="<field>"
  type="number"
  aria-invalid={campoInvalido?.id === '<field>' || undefined}
  value={form.<field>}
  onChange={(e) => f('<field>', Number(e.target.value))}
  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

---


## F · Form — Select (FK loaded from DB)

```tsx
<Select value={String(form.<field>)} onValueChange={(v) => f('<field>', Number(v))}>
  <SelectTrigger id="<field>" variant="l-border" aria-invalid={campoInvalido?.id === '<field>' || undefined} className="w-full">
```

---


## G · Form — Select (hardcoded catalog)

```ts
// Module-level constant (outside component):
const <LABELS>: Record<number, string> = { 1: 'Opción A', 2: 'Opción B' }
// First key = pre-selected default in openCreate()
```

```tsx
<Select value={String(form.<field>)} onValueChange={(v) => f('<field>', Number(v))}>
  <SelectTrigger id="<field>" variant="l-border" aria-invalid={campoInvalido?.id === '<field>' || undefined} className="w-full">
    <SelectValue placeholder="<Selecciona opcion>">
      {(v: string) => v !== '' ? (<LABELS>[Number(v)] ?? v) : null}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {Object.entries(<LABELS>).map(([k, label]) => (
      <SelectItem key={k} value={k}>{label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---


## H · Form — Select (codigo IS the display label)

Use when the raw value is already human-readable. **No render-prop.**

Campos que aplican en el proyecto: `manzana`, `lote`, `serie_recibo`, `serie_factura`.  
Regla: si el `<SelectItem value={x}>` y su texto visible son el mismo string, usa esta variante.

```tsx
<Select value={form.<field>} onValueChange={(v) => f('<field>', v)}>
  <SelectTrigger id="<field>" variant="l-border" aria-invalid={campoInvalido?.id === '<field>' || undefined} className="w-full">
    <SelectValue placeholder="<Selecciona opcion>" />
  </SelectTrigger>
  <SelectContent>
    {<items>.map((item) => (
      <SelectItem key={item.codigo} value={item.codigo}>{item.codigo}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---


## I · Form — Checkbox (standalone, full-width row)

```tsx
<div className="col-span-2 flex items-center gap-2 py-1">
  <Checkbox
    id="<field>"
    checked={!!form.<field>}
    onCheckedChange={(c) => setForm((p) => ({ ...p, <field>: c ? 1 : 0 }))}
  />
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text>
  </Label>
</div>
```

---


## J · Form — Checkbox aligned in a mixed grid row

Parent **must** have `items-end`. Checkbox wrapper **must** have `pb-1`. Without both, checkbox floats to the top of the row.

```tsx
{/* Parent — note items-end */}
<div className="grid grid-cols-2 gap-4 items-end">
  <div className="grid gap-1">
    <Label htmlFor="<field1>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}><Label 1></Label>
    <Select ...>...</Select>
  </div>
  {/* Checkbox wrapper — note pb-1 */}
  <div className="flex items-center gap-2 pb-1">
    <Checkbox
      id="<field2>"
      checked={!!form.<field2>}
      onCheckedChange={(c) => setForm((p) => ({ ...p, <field2>: c ? 1 : 0 }))}
    />
    <Label htmlFor="<field2>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}><Label 2></Label>
  </div>
</div>
```

Same rule applies to `col-span-2 grid grid-cols-3 gap-4 items-end` for third-width groups containing a checkbox.

---


## N · ViewField + SectionDivider

Definir **dentro de cada `_client.tsx`** (no son componentes compartidos).

> **Fuente única de tamaños** — los `style={{ fontSize: 'var(--ui-xxx)' }}` referencian variables CSS definidas en `src/app/globals.css :root`:
> `--ui-viewfield-label: 10px` · `--ui-viewfield-value: 11px` · `--ui-section-divider: 11px` · `--ui-form-label: 10px` · `--ui-input: 11px`.
> Para cambiar todos los tamaños a la vez, editar solo ese bloque en `globals.css`.

```tsx
function ViewField({ label, value, locked = false }: { label: string; value?: string | null | number; locked?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
        <span className="block font-medium" style={{ fontSize: 'var(--ui-viewfield-value)', color: locked ? '#b4bec9' : 'var(--foreground)' }}>{value || ''}</span>
      </div>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <div className="h-4 w-0.5 rounded-full bg-primary/40" />
      <span className="font-semibold uppercase tracking-wider text-primary" style={{ fontSize: 'var(--ui-section-divider)' }}>{label}</span>
    </div>
  )
}

function SegmentCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="col-span-2 grid gap-1.5">
      <div className="flex items-center gap-2">
        <div className="h-4 w-0.5 rounded-full bg-primary/40" />
        <span className="font-semibold uppercase tracking-wider text-primary" style={{ fontSize: 'var(--ui-section-divider)' }}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        {children}
      </div>
    </div>
  )
}
```

> **Estándar 2026-08 — `SegmentCard` reemplaza el uso suelto de `SectionDivider`.** Todo segmento
> (bloque de campos bajo un título) en modo Ver, Editar **y** Crear debe envolverse en `<SegmentCard
> label="...">...</SegmentCard>` en vez de `<SectionDivider label="..." />` + hermanos sueltos. El título
> queda **arriba** de la caja (no dentro) — mismo look de `SectionDivider` (barra + texto uppercase),
> solo que ahora el contenido del segmento queda visualmente agrupado en una caja con borde sutil.
> `SectionDivider` se mantiene definido únicamente por compatibilidad de pantallas aún no migradas —
> no usarlo directamente en pantallas nuevas ni en migraciones. Pantalla de referencia:
> `promesas/promesas/_client.tsx`.

### Reglas ViewField

> **Wrapper de campo:** usar siempre `<div className="grid gap-1">` — nunca `space-y-1.5`. El `grid gap-1` da 4 px de separación entre label y campo, idéntico al interior del `ViewField`, garantizando que los bordes inferiores de campos adyacentes queden alineados.

> **Estilo de label en ViewField:** `font-semibold tracking-wider leading-none` — igual peso visual que `<Label>` de formulario para coherencia cuando ViewField y Input/Select aparecen lado a lado en la misma fila.

- **Texto:** pasar el valor crudo; `ViewField` muestra en blanco si es `null`/`undefined`/`''`. Nunca pasar `|| '—'` a `ViewField`. En renderers de columna de tabla, `|| '—'` es aceptable.
- **Numérico:** si `0` significa "no definido", guardar en el call site: `value={viewTarget.valor ? fmt(viewTarget.valor) : ''}`. Si `0` es válido (p.ej. `dias_gracia`), pasar `fmt(x)` directo.
- **Códigos numéricos auto-increment:** mostrar como `String(viewTarget.codigo)` — nunca con `#` prefix.

---


## O · Grid modo vista (view mode)

```tsx
<div className="grid grid-cols-2 gap-2">
  <SectionDivider label="SECCION" />

  {/* full — ocupa toda la fila */}
  <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>

  {/* half — dos campos por fila */}
  <ViewField label="Campo A" value={viewTarget.campo_a} />
  <ViewField label="Campo B" value={viewTarget.campo_b} />

  {/* third — tres campos por fila; inner grid dentro de col-span-2 */}
  <div className="col-span-2 grid grid-cols-3 gap-2">
    <ViewField label="Dia"  value={String(viewTarget.dia)} />
    <ViewField label="Mes"  value={String(viewTarget.mes)} />
    <ViewField label="Anio" value={String(viewTarget.anio)} />
  </div>

  {/* boolean — checkbox libre, sin card container */}
  <div className="flex items-center gap-2 py-1">
    <Checkbox checked={!!viewTarget.activo} disabled />
    <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Activo</span>
  </div>
</div>
```

---


## P · Grid modo edición (edit mode)

```tsx
<div className="grid grid-cols-2 gap-2">
  <SectionDivider label="SECCION" />

  {/* full */}
  <div className="col-span-2 grid gap-1">
    <Label htmlFor="nombre" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Nombre <RequiredMark /></Label>
    <Input variant="l-border" id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del registro" />
  </div>

  {/* half */}
  <div className="grid gap-1">
    <Label htmlFor="campo_a" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Campo A</Label>
    <Input variant="l-border" id="campo_a" value={form.campo_a} onChange={(e) => f('campo_a', e.target.value)} placeholder="..." />
  </div>
  <div className="grid gap-1">
    <Label htmlFor="campo_b" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Campo B</Label>
    <Input variant="l-border" id="campo_b" value={form.campo_b} onChange={(e) => f('campo_b', e.target.value)} placeholder="..." />
  </div>

  {/* third — inner grid dentro de col-span-2 */}
  <div className="col-span-2 grid grid-cols-3 gap-2">
    <div className="grid gap-1">
      <Label htmlFor="dia" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Dia</Label>
      <Input variant="l-border" id="dia" type="number" value={form.dia} onChange={(e) => f('dia', Number(e.target.value))} />
    </div>
    <div className="grid gap-1">
      <Label htmlFor="mes" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Mes</Label>
      <Input variant="l-border" id="mes" type="number" value={form.mes} onChange={(e) => f('mes', Number(e.target.value))} />
    </div>
    <div className="grid gap-1">
      <Label htmlFor="anio" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Anio</Label>
      <Input variant="l-border" id="anio" type="number" value={form.anio} onChange={(e) => f('anio', Number(e.target.value))} />
    </div>
  </div>
</div>
```

**Reglas:**
- `gap-2` entre campos, `gap-1` dentro de cada wrapper label+input.
- Todos los `<Label>`: `className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}`.
- Todos los `<Input>`: `variant="l-border"`.
- Checkbox en fila mixta → ver **§ J**.
- Geo cascade (pais/depto/municipio) → `<select>` nativo, ver **§ X**.

---


## Y · Campo activo

**Tabla (cell renderer):**
```tsx
case 'activo':
  return (
    <TableCell key="activo">
      {row.activo === 1
        ? <Badge variant="secondary" className="font-normal bg-emerald-100 text-emerald-700">Activo</Badge>
        : <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">Inactivo</Badge>}
    </TableCell>
  )
```

**Vista (view mode) — Checkbox card:**
```tsx
<div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
  <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Activo</span>
  <Checkbox checked={!!viewTarget.activo} disabled />
</div>
```

**Edición (edit mode) — Checkbox libre:**
```tsx
{/* Si activo es el único campo en su fila — § I */}
<div className="col-span-2 flex items-center gap-2 py-1">
  <Checkbox id="activo" checked={!!form.activo} onCheckedChange={(c) => setForm((p) => ({ ...p, activo: c ? 1 : 0 }))} />
  <Label htmlFor="activo" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Activo</Label>
</div>

{/* Si activo comparte fila con otro campo — § J (requiere items-end en padre y pb-1 en wrapper) */}
```

**ColumnFilter values para activo:**
```ts
const uniqueActivoValues = ['Sí', 'No']
// En filtered useMemo:
if (col === 'activo') return vals.has(r.activo === 1 ? 'Sí' : 'No')
```

---


## Z · Textarea + Input fecha

**Textarea:**
```tsx
<div className="col-span-2 grid gap-1">
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text>
  </Label>
  <textarea
    id="<field>"
    value={form.<field>}
    onChange={(e) => f('<field>', e.target.value)}
    placeholder="<Sentence case placeholder>"
    rows={3}
    className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
  />
</div>
```

**Input fecha (ISO string `YYYY-MM-DD`):**
```tsx
<div className="grid gap-1">
  <Label htmlFor="<field>" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
    <Label text>
  </Label>
  <Input
    id="<field>"
    type="date"
    value={form.<field> ?? ''}
    onChange={(e) => setForm((p) => ({ ...p, <field>: e.target.value || null }))}
  />
</div>
```

> Las fechas no pasan por `f()` porque no son texto normalizable. Usar `setForm` directamente es correcto para campos `type="date"`.

---


## AD · Input numérico con sufijo de unidad (adornment)

Usar cuando un campo numérico lleva una unidad de medida reactiva a la derecha (p.ej. `extension` en lotes, donde la unidad viene de la fase seleccionada).

### State local (separado del `form`)

```ts
const [<field>Str, set<Field>Str] = useState('')
```

El string se mantiene separado del `form` para preservar la entrada del usuario mientras tipea (evitar pérdida de decimales).

### Helper de unidad

```ts
function get<Unit>(faseCode: number) {
  return fases.find((f) => f.codigo === faseCode)?.medida ?? ''
}
// Usar como computed value en el render:
const medida = get<Unit>(form.fase)
```

### Inicialización en openCreate()

```ts
set<Field>Str('')
```

### Inicialización en openView() y cancelEdit()

```ts
set<Field>Str(String(viewTarget.<field>))
```

### JSX — edit mode

```tsx
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}><Label text> <RequiredMark /></Label>
  <div className="flex gap-2 items-center">
    <Input
      type="number"
      min={0}
      step="0.01"
      value={<field>Str}
      onChange={(e) => set<Field>Str(e.target.value)}
      placeholder="0.00"
      className="flex-1"
    />
    {medida && <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{medida}</span>}
  </div>
</div>
```

### JSX — view mode (ViewField)

```tsx
<ViewField
  label="<Label text>"
  value={viewTarget.<field> ? `${fmt(viewTarget.<field>)} ${get<Unit>(viewTarget.fase)}` : ''}
/>
```

### Table cell

```tsx
case '<field>':
  return (
    <TableCell key="<field>" className="tabular-nums text-right whitespace-nowrap">
      {fmt(row.<field>)} {get<Unit>(row.fase)}
    </TableCell>
  )
```

### En handleSave() — parse antes de enviar

```ts
const <field> = parseFloat(<field>Str) || form.<field>
// Incluir <field> en el payload, no form.<field>
```

---


## AE · Selection Buttons — Radio group visual

Usar cuando hay exactamente 2-3 opciones mutuamente excluyentes que representan modos/estados con campos dependientes visualmente diferentes (p.ej. Eventual vs Estado Cuenta en Tipos de Ingresos). No usar para selects con más opciones — usar § G.

### Helper de estilos (computed value, en el cuerpo del componente)

```ts
const selBtnCls = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-<accent>-100 border-<accent>-400 text-<accent>-700'
      : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/70'
  }`
```

> Reemplazar `<accent>` por el color del módulo (p.ej. `yellow` para cuentas-cobrar). Ver `.cursor/rules/ui-conventions.mdc` para la tabla de colores por módulo.

### State local

```ts
const [modo, setModo] = useState<'<opcionA>' | '<opcionB>'>('<opcionA>')
```

### Init en openCreate()

```ts
setModo('<opcionA>')  // valor por defecto
```

### Init en openView() y cancelEdit()

```ts
// Derivar el modo del valor guardado en la entidad:
setModo(entity.<campo> === <valorA> ? '<opcionA>' : '<opcionB>')
```

### JSX — view mode (botones deshabilitados)

```tsx
<div className="col-span-2 flex gap-3">
  <button type="button" className={selBtnCls(<condition_A>)} disabled>
    <Etiqueta A>
  </button>
  <button type="button" className={selBtnCls(<condition_B>)} disabled>
    <Etiqueta B>
  </button>
</div>
```

### JSX — edit mode (botones activos, deshabilitados si `!isEditing`)

```tsx
<div className="col-span-2 flex gap-3">
  <button type="button" className={selBtnCls(modo === '<opcionA>')}
    onClick={() => setModo('<opcionA>')} disabled={!isEditing}>
    <Etiqueta A>
  </button>
  <button type="button" className={selBtnCls(modo === '<opcionB>')}
    onClick={() => setModo('<opcionB>')} disabled={!isEditing}>
    <Etiqueta B>
  </button>
</div>
```

### Campos dependientes del modo

Renderizar condicionalmente debajo de los botones:

```tsx
{modo === '<opcionA>' && (
  <div className="col-span-2 ...">
    {/* campos de <opcionA> */}
  </div>
)}
{modo === '<opcionB>' && (
  <div className="col-span-2 ...">
    {/* campos de <opcionB> */}
  </div>
)}
```

### En handleSave() — mapear modo a valor numérico antes de enviar

```ts
const <campo> = modo === '<opcionA>' ? <valorA> : <valorB>
// Incluir en el payload
```

---
