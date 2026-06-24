---
description: "Cartera — snippets para componentes especializados: Select moneda con bandera (§W), Select geo nativo (§X), CountrySelect con cascade (§AA), ClienteCombobox buscable (§AB). Cargar solo cuando la pantalla use alguno de estos campos."
---

# Cartera — Advanced Component Snippets

Snippets especializados para campos geográficos, de moneda y comboboxes buscables.  
Copia cada sección verbatim — reemplaza los `<angle-bracket>` placeholders.

| § | Objeto |
|---|--------|
| W | Select moneda con bandera |
| X | Select geo nativo (país / departamento / municipio) |
| AA | CountrySelect (selector de país con bandera + cascade) |
| AB | ClienteCombobox (select buscable por texto) |

---

## W · Select moneda con bandera

Constante de módulo (fuera del componente):

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

**Tabla (cell renderer):**
```tsx
case 'moneda': {
  const flag = CURRENCY_FLAG_MAP.get(row.moneda)
  return (
    <TableCell key="moneda" className="text-muted-foreground">
      {flag ? (
        <span className="flex items-center gap-1.5">
          <img src={`https://flagcdn.com/w20/${flag}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
          {row.moneda}
        </span>
      ) : row.moneda || '—'}
    </TableCell>
  )
}
```

**Edit mode:**
```tsx
<Select value={form.moneda} onValueChange={(v) => f('moneda', v)}>
  <SelectTrigger variant="l-border" className="w-full">
    <SelectValue placeholder="Selecciona moneda">
      {(v: string) => {
        const flag = CURRENCY_FLAG_MAP.get(v)
        return flag ? (
          <span className="flex items-center gap-1.5">
            <img src={`https://flagcdn.com/w20/${flag}.png`} alt={v} width={20} height={14} className="object-cover rounded-sm shrink-0" />
            {v}
          </span>
        ) : v || null
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

**ViewField:**
```tsx
{(() => {
  const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda ?? '')
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Moneda</span>
      <div className="rounded-none bg-muted/50 border border-border/40 px-3 py-2.5">
        {flag ? (
          <span className="flex items-center gap-1.5 text-[13px] font-medium">
            <img src={`https://flagcdn.com/w20/${flag}.png`} alt={viewTarget.moneda ?? ''} width={20} height={14} className="object-cover rounded-sm shrink-0" />
            {viewTarget.moneda}
          </span>
        ) : <span className="text-[13px] font-medium">{viewTarget.moneda || '—'}</span>}
      </div>
    </div>
  )
})()}
```

**ColumnFilter — unique values para el filtro de la columna moneda:**
```ts
// uniqueValues — solo el código ISO (sin nombre)
const uniqueMonedaLabels = useMemo(() =>
  [...new Set(initialData.map((r) => r.moneda))].sort(),
  [initialData]
)
// En filtered useMemo:
if (col === 'moneda') return vals.has(r.moneda)
```

**Origen:** llamar `getMonedas()` en `page.tsx` dentro de `Promise.all`, pasar como prop `monedas: Moneda[]`. Nunca usar lista hardcodeada.

---

## X · Select geo nativo (pais / departamento / municipio)

Usar `<select>` HTML nativo — **no** el `<Select>` de Base UI — para estos tres campos.

**IMPORTANTE — Cascada en los onChange:** cada nivel debe auto-seleccionar el primer elemento del nivel inferior. Los `onChange` no deben simplemente resetear a `''` — deben buscar el primer item disponible y pre-seleccionarlo.

Clase estándar (l-border, igual que los inputs del modal):
```
w-full rounded-none border-0 border-b border-primary/50 bg-transparent px-2 py-0 outline-none focus:border-b-2 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50
```
Estilo de altura y fuente via `style={{ height: 'var(--ui-field-height)', fontSize: 'var(--ui-input)' }}`.

```tsx
{/* País — al cambiar, auto-selecciona primer depto y primer municipio */}
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Pais</Label>
  <select
    value={form.pais}
    onChange={(e) => {
      const codigo = e.target.value
      const firstDepto = departamentos.find((d) => d.pais === codigo)
      const dCode = firstDepto?.codigo ?? ''
      const mCode = firstDepto
        ? (municipios.find((m) => m.pais === codigo && m.departamento === dCode)?.codigo ?? '')
        : ''
      setPaisCodigo(codigo)
      setDeptoCodigo(dCode)
      setForm((p) => ({ ...p, pais: codigo, departamento: dCode, municipio: mCode }))
    }}
    className="w-full rounded-none border-0 border-b border-primary/50 bg-transparent px-2 py-0 outline-none focus:border-b-2 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
    style={{ height: 'var(--ui-field-height)', fontSize: 'var(--ui-input)' }}
  >
    <option value="">Selecciona país</option>
    {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
  </select>
</div>

{/* Departamento — filtrado por pais; al cambiar, auto-selecciona primer municipio */}
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Departamento</Label>
  <select
    value={form.departamento}
    disabled={!paisCodigo}
    onChange={(e) => {
      const v = e.target.value
      const mCode = municipios.find((m) => m.pais === paisCodigo && m.departamento === v)?.codigo ?? ''
      setDeptoCodigo(v)
      setForm((p) => ({ ...p, departamento: v, municipio: mCode }))
    }}
    className="w-full rounded-none border-0 border-b border-primary/50 bg-transparent px-2 py-0 outline-none focus:border-b-2 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
    style={{ height: 'var(--ui-field-height)', fontSize: 'var(--ui-input)' }}
  >
    <option value="">{paisCodigo ? 'Selecciona departamento' : 'Primero selecciona un país'}</option>
    {departamentos.filter((d) => d.pais === paisCodigo).map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
  </select>
</div>

{/* Municipio — filtrado por pais + departamento */}
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Municipio</Label>
  <select
    value={form.municipio}
    disabled={!deptoCodigo}
    onChange={(e) => setForm((p) => ({ ...p, municipio: e.target.value }))}
    className="w-full rounded-none border-0 border-b border-primary/50 bg-transparent px-2 py-0 outline-none focus:border-b-2 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
    style={{ height: 'var(--ui-field-height)', fontSize: 'var(--ui-input)' }}
  >
    <option value="">{deptoCodigo ? 'Selecciona municipio' : 'Primero selecciona un departamento'}</option>
    {municipios.filter((m) => m.pais === paisCodigo && m.departamento === deptoCodigo).map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
  </select>
</div>
```

**Reglas:**
- La cascada aplica tanto en `openCreate()` como en los `onChange` del usuario — ver `crud-screens.instructions.md § Country/Geo pre-selection`.
- Los nombres de campos (`pais`, `departamento`, `municipio`) pueden variar por entidad (ej. `direccion_pais`, `direccion_departamento`, `direccion_municipio` en Clientes). Adaptar los `setForm` al nombre real de la columna.
- En vista (`ViewField`): resolver código → nombre via los props arrays; mostrar bandera del país.
- Nunca mostrar el código raw de pais/depto/municipio en la UI.

---

## AA · CountrySelect — Selector de país con bandera y cascade

Usa el componente `<CountrySelect>` de `@/components/ui/country-select` — **nunca** recrear la lógica inline.

### Import

```ts
import { CountrySelect } from '@/components/ui/country-select'
```

### State local (en el componente principal)

```ts
const [paisCodigo, setPaisCodigo]   = useState('')
const [deptoCodigo, setDeptoCodigo] = useState('')
```

Estos son **separados** de `form.direccion_pais` / `form.direccion_departamento`: los native `<select>` de departamento y municipio los consumen directamente para su filtrado en tiempo real.

### JSX — edit mode

```tsx
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Pais *</Label>
  <CountrySelect
    paises={paises}
    value={paisCodigo}
    onChange={(codigo, _nombre) => {
      setPaisCodigo(codigo)
      setDeptoCodigo('')
      const autoMoneda = countryToCurrency[codigo] ?? form.moneda
      setForm((prev) => ({
        ...prev,
        direccion_pais: codigo,
        direccion_departamento: '',
        direccion_municipio: '',
        moneda: autoMoneda,
      }))
    }}
  />
</div>
```

> `countryToCurrency` proviene de `COUNTRY_CURRENCY_MAP` en `src/lib/constants.ts` — ver `ui-conventions.instructions.md § Currency pre-selection from country`.

### JSX — view mode

Usar un `ViewField` con bandera construida desde el código ISO:

```tsx
<ViewField
  label="Pais"
  value={viewTarget.direccion_pais
    ? paises.find((p) => p.codigo === viewTarget.direccion_pais)?.nombre ?? viewTarget.direccion_pais
    : ''}
/>
```

### Inicialización en openCreate()

Usar `applyWithPais` para pre-seleccionar el primer depto y municipio del país (ver `crud-screens.instructions.md § Country/Geo pre-selection`):

```ts
function applyWithPais(paisCode: string) {
  const resolved = paises.find((p) => p.codigo === paisCode) ? paisCode : (paises[0]?.codigo ?? '')
  const firstDepto = departamentos.find((d) => d.pais === resolved)
  const deptoCod = firstDepto?.codigo ?? ''
  const municipioCod = firstDepto
    ? (municipios.find((m) => m.pais === resolved && m.departamento === deptoCod)?.codigo ?? '')
    : ''
  const autoMoneda = countryToCurrency[resolved] ?? 'GTQ'
  setPaisCodigo(resolved)
  setDeptoCodigo(deptoCod)
  setForm((prev) => ({
    ...prev,
    direccion_pais: resolved,
    direccion_departamento: deptoCod,
    direccion_municipio: municipioCod,
    moneda: autoMoneda,
  }))
}

// In openCreate() — priority: project pais > empresa pais > IP geolocation
const paisFromProject = firstProyecto?.pais ?? ''
const paisFromEmpresa = firstEmpresa?.pais ?? ''
if (paisFromProject) {
  applyWithPais(paisFromProject)
} else if (paisFromEmpresa) {
  applyWithPais(paisFromEmpresa)
} else {
  applyWithPais(paises[0]?.codigo ?? '')
  fetch('https://ipapi.co/json/')
    .then((r) => r.json())
    .then((d: Record<string, unknown>) => { if (d.country_code) applyWithPais(d.country_code as string) })
    .catch(() => {})
}
```

### Inicialización en openView() y cancelEdit()

```ts
const pCode = entity.direccion_pais ?? ''
const dCode = entity.direccion_departamento ?? ''
setPaisCodigo(pCode)
setDeptoCodigo(dCode)
setForm((prev) => ({ ...prev, direccion_pais: pCode, direccion_departamento: dCode }))
```

---

## AB · ClienteCombobox — Select buscable por texto

Combobox con búsqueda de texto libre para entidades que pueden tener muchos registros (p.ej. clientes). Definir como función interna **antes** del componente principal.

### Imports adicionales

```ts
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
// Icons: Search, X, ChevronDown ya deben estar en el bloque de imports de lucide-react
```

### Definición del componente (antes del componente principal)

```tsx
function ClienteCombobox({
  clientes, value, onChange, disabled, placeholder,
}: {
  clientes: Cliente[]
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>()

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q))
  }, [clientes, query])

  const selected = clientes.find((c) => c.codigo === value)

  useEffect(() => {
    if (open) {
      if (wrapperRef.current) setPopoverWidth(wrapperRef.current.offsetWidth)
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setQuery('')
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={
          <button
            type="button"
            disabled={disabled}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`truncate ${!selected ? 'text-muted-foreground' : ''}`}>
              {selected ? selected.nombre : (placeholder ?? 'Selecciona...')}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        } />
        <PopoverContent
          align="start"
          className="p-0 overflow-hidden"
          style={popoverWidth ? { width: popoverWidth } : undefined}
        >
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" title="Limpiar búsqueda" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.codigo}
                  type="button"
                  className={`flex w-full cursor-default items-center px-3 py-2 text-sm hover:bg-accent ${
                    c.codigo === value ? 'bg-accent/40 font-medium' : 'text-foreground/80'
                  }`}
                  onClick={() => { onChange(c.codigo); setOpen(false) }}
                >
                  <span className="flex-1 truncate text-left">{c.nombre}</span>
                  {c.codigo === value && <span className="ml-2 shrink-0 text-teal-600">✓</span>}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

### Filtrado en el componente principal (cascade por proyecto)

```ts
const clientesFiltrados = useMemo(
  () => clientes.filter((c) => c.proyecto === form.proyecto),
  [clientes, form.proyecto]
)
```

### Uso en JSX

```tsx
<div className="grid gap-1">
  <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Cliente *</Label>
  <ClienteCombobox
    clientes={clientesFiltrados}
    value={form.cliente}
    onChange={(v) => f('cliente', v)}
    disabled={!isEditing}
    placeholder="Selecciona cliente..."
  />
</div>
```

> **Regla:** el `ClienteCombobox` **nunca** se auto-selecciona al cambiar de proyecto — el usuario siempre debe elegirlo explícitamente. Al cambiar de proyecto, hacer `f('cliente', 0)` para limpiar.
