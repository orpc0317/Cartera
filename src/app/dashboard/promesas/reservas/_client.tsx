'use client'

import { useState, useMemo, useRef, useCallback, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ClipboardList, Plus, Search, X, Settings2,
  ChevronDown, ChevronUp, MoreHorizontal, Eye, History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import type { Empresa, Proyecto, Fase, Manzana, Lote, Cliente, Banco, CuentaBancaria, Vendedor, Cobrador, SerieRecibo } from '@/lib/types/proyectos'
import { createReserva, type ReservaRow } from '@/app/actions/lotes'

// ─── Tipos locales ─────────────────────────────────────────────────────────

type ColFilters = Record<string, Set<string>>
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

// ─── Formulario de reserva ─────────────────────────────────────────────────

const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Depósito',
  4: 'Transferencia',
}

type ReservaForm = {
  empresa:         number
  proyecto:        number
  fase:            number
  manzana:         string
  lote:            string
  cliente:         number
  fecha:           string   // ISO date string YYYY-MM-DD
  monto:           string   // string para el input, se convertirá a número al guardar
  serie_recibo:     string
  recibo:           string   // número de recibo; vacío si la serie es automática
  forma_pago:      number   // 1=Efectivo 2=Cheque 3=Depósito 4=Transferencia
  banco:           number   // solo Cheque
  num_cuenta:      string   // solo Cheque
  cuenta_bancaria: number   // solo Depósito/Transferencia
  num_documento:   string   // Cheque/Depósito/Transferencia
  vendedor:        number
  cobrador:        number
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM: ReservaForm = {
  empresa:         0,
  proyecto:        0,
  fase:            0,
  manzana:         '',
  lote:            '',
  cliente:         0,
  fecha:           today,
  monto:           '',
  serie_recibo:     '',
  recibo:           '',
  forma_pago:      0,
  banco:           0,
  num_cuenta:      '',
  cuenta_bancaria: 0,
  num_documento:   '',
  vendedor:        0,
  cobrador:        0,
}

// ─── Catálogo de monedas (ISO → país para bandera) ─────────────────────────

const CURRENCIES: { iso: string; flagIso: string }[] = [
  { iso: 'ARS', flagIso: 'AR' }, { iso: 'BOB', flagIso: 'BO' }, { iso: 'BRL', flagIso: 'BR' },
  { iso: 'CAD', flagIso: 'CA' }, { iso: 'CLP', flagIso: 'CL' }, { iso: 'COP', flagIso: 'CO' },
  { iso: 'CRC', flagIso: 'CR' }, { iso: 'CUP', flagIso: 'CU' }, { iso: 'DOP', flagIso: 'DO' },
  { iso: 'EUR', flagIso: 'EU' }, { iso: 'GBP', flagIso: 'GB' }, { iso: 'GTQ', flagIso: 'GT' },
  { iso: 'HNL', flagIso: 'HN' }, { iso: 'MXN', flagIso: 'MX' }, { iso: 'NIO', flagIso: 'NI' },
  { iso: 'PAB', flagIso: 'PA' }, { iso: 'PEN', flagIso: 'PE' }, { iso: 'PYG', flagIso: 'PY' },
  { iso: 'SVC', flagIso: 'SV' }, { iso: 'USD', flagIso: 'US' }, { iso: 'UYU', flagIso: 'UY' },
  { iso: 'VES', flagIso: 'VE' },
]

const RESERVA_ESTADOS: Record<number, { label: string; cls: string }> = {
  1:  { label: 'Abierta',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  2:  { label: 'Promesa',    cls: 'bg-sky-100     text-sky-700     border-sky-200     hover:bg-sky-100'     },
  3:  { label: 'Devolucion', cls: 'bg-amber-100   text-amber-700   border-amber-200   hover:bg-amber-100'   },
  99: { label: 'Anulado',    cls: 'bg-red-100     text-red-700     border-red-200     hover:bg-red-100'     },
}

// ─── Columnas ──────────────────────────────────────────────────────────────

const ALL_COLUMNS: ColDef[] = [
  { key: '__proyecto', label: 'Proyecto',    defaultVisible: true  },
  { key: '__fase',     label: 'Fase',        defaultVisible: true  },
  { key: '__manzana',  label: 'Manzana',     defaultVisible: true  },
  { key: 'lote',       label: 'Lote',        defaultVisible: true  },
  { key: '__cliente',  label: 'Cliente',     defaultVisible: true  },
  { key: '__vendedor', label: 'Vendedor',    defaultVisible: false },
  { key: 'fecha',      label: 'Fecha',       defaultVisible: true  },
  { key: 'monto',      label: 'Monto',       defaultVisible: true  },
  { key: '__estado',   label: 'Estado',      defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// ─── Helpers de formato ────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Subcomponentes ────────────────────────────────────────────────────────

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <div className="h-4 w-0.5 rounded-full bg-primary/40" />
      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
      <div className="flex-1 border-t border-primary/30" />
    </div>
  )
}

function ColumnFilter({
  label, values, active, onChange,
}: { label: string; values: string[]; active: Set<string>; onChange: (next: Set<string>) => void }) {
  const isFiltered = active.size > 0
  return (
    <Popover>
      <PopoverTrigger render={
        <button type="button" className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium transition-colors hover:bg-accent ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
          <ChevronDown className="h-3 w-3" />
          {isFiltered && <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{active.size}</span>}
        </button>
      } />
      <PopoverContent className="w-52 p-2" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {isFiltered && (
            <button type="button" onClick={() => onChange(new Set())} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
              <Checkbox checked={active.has(v)} onCheckedChange={(checked: boolean) => {
                const next = new Set(active); checked ? next.add(v) : next.delete(v); onChange(next)
              }} />
              <span className="truncate">{v || '(vacío)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

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
              placeholder="Buscar cliente..."
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

function ColumnManager({ prefs, onToggle, onMove, onReset }: {
  prefs: ColPref[]; onToggle: (key: string) => void; onMove: (key: string, dir: -1 | 1) => void; onReset: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Columnas
        </Button>
      } />
      <PopoverContent className="w-56 p-3" align="end">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Columnas visibles</span>
          <button type="button" onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground">Restablecer</button>
        </div>
        <div className="space-y-0.5">
          {prefs.map((pref, i) => {
            const col = ALL_COLUMNS.find((c) => c.key === pref.key)!
            return (
              <div key={pref.key} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-accent">
                <Checkbox checked={pref.visible} onCheckedChange={() => onToggle(pref.key)} />
                <span className="flex-1 text-sm">{col.label}</span>
                <button type="button" disabled={i === 0} onClick={() => onMove(pref.key, -1)} title="Subir" className="text-muted-foreground hover:text-foreground disabled:opacity-25"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)} title="Bajar" className="text-muted-foreground hover:text-foreground disabled:opacity-25"><ChevronDown className="h-3.5 w-3.5" /></button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Tipo Reserva (estado local, no hay tabla aún) ─────────────────────────

type Reserva = {
  id: string        // temporal UUID en memoria
  empresa:         number
  proyecto:        number
  fase:            number
  manzana:         string
  lote:            string
  cliente:         number
  fecha:           string
  monto:           number
  moneda:          string
  estado:          number
  forma_pago:      number
  banco:           number
  num_cuenta:      string
  cuenta_bancaria: number
  num_documento:   string
  vendedor:        number
  cobrador:        number
  serie_recibo:    string
  recibo:          string
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  reservasIniciales:  ReservaRow[]
  lotesDisponibles:  Lote[]
  manzanas:          Manzana[]
  fases:             Fase[]
  proyectos:         Proyecto[]
  empresas:          Empresa[]
  clientes:          Cliente[]
  bancos:            Banco[]
  cuentasBancarias:  CuentaBancaria[]
  vendedores:        Vendedor[]
  cobradores:        Cobrador[]
  seriesRecibo:      SerieRecibo[]
  puedeAgregar:      boolean
  userId:            string
}

// ─── Componente principal ──────────────────────────────────────────────────

// Devuelve la serie predeterminada de una lista ya filtrada por empresa+proyecto
function getDefaultSerie(series: SerieRecibo[]): string {
  if (series.length === 0) return ''
  // Comparación numérica explícita por si Supabase devuelve smallint como string
  return (series.find((s) => Number(s.predeterminado) === 1) ?? series[0]).serie
}

function filterSeries(all: SerieRecibo[], empresa: number, proyecto: number): SerieRecibo[] {
  return all.filter(
    (s) => Number(s.activo) === 1
        && ((s.empresa === empresa && s.proyecto === proyecto)
         || (s.empresa === 0 && s.proyecto === 0)),
  )
}

/** Calcula la primera fase disponible (que tenga lotes disponibles) para empresa+proyecto */
function firstFaseId(lotes: Lote[], fasesList: Fase[], empresa: number, proyecto: number): number {
  const ids = new Set(lotes.filter((l) => l.empresa === empresa && l.proyecto === proyecto).map((l) => l.fase))
  return fasesList.find((f) => f.empresa === empresa && f.proyecto === proyecto && ids.has(f.codigo))?.codigo ?? 0
}

/** Calcula la primera manzana disponible para empresa+proyecto+fase */
function firstManzanaCodigo(lotes: Lote[], manzanasList: Manzana[], empresa: number, proyecto: number, fase: number): string {
  const ids = new Set(lotes.filter((l) => l.empresa === empresa && l.proyecto === proyecto && l.fase === fase).map((l) => l.manzana))
  return manzanasList.find((m) => m.empresa === empresa && m.proyecto === proyecto && m.fase === fase && ids.has(m.codigo))?.codigo ?? ''
}

/** Calcula el primer lote disponible para empresa+proyecto+fase+manzana */
function firstLoteCodigo(lotes: Lote[], empresa: number, proyecto: number, fase: number, manzana: string): string {
  return lotes.find((l) => l.empresa === empresa && l.proyecto === proyecto && l.fase === fase && l.manzana === manzana)?.codigo ?? ''
}

/** Mapea ReservaRow (BD) al tipo local Reserva */
function mapReservas(rows: ReservaRow[]): Reserva[] {
  return rows.map((r) => ({
    id:              String(r.numero),
    empresa:         r.empresa,
    proyecto:        r.proyecto,
    fase:            r.fase,
    manzana:         r.manzana,
    lote:            r.lote,
    cliente:         r.cliente,
    fecha:           r.fecha,
    monto:           r.monto,
    moneda:          r.moneda,
    estado:          r.estado,
    forma_pago:      r.forma_pago,
    banco:           r.banco,
    num_cuenta:      r.numero_cuenta,
    cuenta_bancaria: r.cuenta_deposito,
    num_documento:   r.numero_documento,
    vendedor:        r.vendedor,
    cobrador:        r.cobrador,
    serie_recibo:    r.recibo_serie,
    recibo:          String(r.recibo_numero),
  }))
}

export function ReservasClient({
  reservasIniciales, lotesDisponibles, manzanas, fases, proyectos, empresas, clientes,
  bancos, cuentasBancarias, vendedores, cobradores, seriesRecibo, puedeAgregar, userId,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Estado de tabla ─────────────────────────────────────────────────────────────────
  const [reservas, setReservas] = useState<Reserva[]>(() => mapReservas(reservasIniciales))

  useEffect(() => {
    setReservas(mapReservas(reservasIniciales))
  }, [reservasIniciales])

  // ── Búsqueda y filtros ────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [vendedorFiltro, setVendedorFiltro] = useState(0)

  // ── Diálogo ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [viewTarget, setViewTarget] = useState<Reserva | null>(null)

  // ── Formulario ────────────────────────────────────────────────────────
  const [form, setForm] = useState<ReservaForm>(EMPTY_FORM)
  // Control de concurrencia optimista: modifico_fecha del lote seleccionado
  const [loteLastModified, setLoteLastModified] = useState<string | undefined>(undefined)
  const [isSaving,         setIsSaving]         = useState(false)

  // ── Mapas FK ──────────────────────────────────────────────────────────
  const empresaMap          = useMemo(() => new Map(empresas.map((e)  => [e.codigo, e.nombre])), [empresas])
  const proyectoMap         = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const faseMap             = useMemo(() => new Map(fases.map((f)     => [f.codigo, f.nombre])), [fases])
  const clienteMap          = useMemo(() => new Map(clientes.map((c)  => [c.codigo, c.nombre])), [clientes])
  const bancoMap            = useMemo(() => new Map(bancos.map((b)    => [b.codigo, b.nombre])), [bancos])
  const cuentaBancariaMap   = useMemo(() => new Map(cuentasBancarias.map((cb) => [cb.codigo, `${bancoMap.get(cb.banco) ?? cb.banco}: ${cb.numero}`])), [cuentasBancarias, bancoMap])
  const vendedorMap         = useMemo(() => new Map(vendedores.map((v) => [v.codigo, v.nombre])), [vendedores])
  const cobradorMap         = useMemo(() => new Map(cobradores.map((c) => [c.codigo, c.nombre])), [cobradores])

  // ── Listas filtradas para los selects del formulario ─────────────────

  // Proyectos disponibles según empresa elegida
  const proyectosPorEmpresa = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  // Lotes disponibles filtrados por empresa + proyecto elegidos
  const lotesEnProyecto = useMemo(
    () => lotesDisponibles.filter(
      (l) => l.empresa === form.empresa && l.proyecto === form.proyecto,
    ),
    [lotesDisponibles, form.empresa, form.proyecto],
  )

  // Fases que tienen al menos un lote disponible en el proyecto elegido
  const fasesConLotes = useMemo(() => {
    const fasesIds = new Set(lotesEnProyecto.map((l) => l.fase))
    return fases.filter((f) => f.empresa === form.empresa && f.proyecto === form.proyecto && fasesIds.has(f.codigo))
  }, [fases, lotesEnProyecto, form.empresa, form.proyecto])

  // Manzanas que tienen al menos un lote disponible en la fase elegida
  const manzanasConLotes = useMemo(() => {
    if (!form.fase) return []
    const manzIds = new Set(lotesEnProyecto.filter((l) => l.fase === form.fase).map((l) => l.manzana))
    return manzanas.filter((m) => m.empresa === form.empresa && m.proyecto === form.proyecto && m.fase === form.fase && manzIds.has(m.codigo))
  }, [manzanas, lotesEnProyecto, form.empresa, form.proyecto, form.fase])

  // Lotes disponibles en la manzana elegida
  const lotesEnManzana = useMemo(() => {
    if (!form.manzana) return []
    return lotesEnProyecto.filter((l) => l.fase === form.fase && l.manzana === form.manzana)
  }, [lotesEnProyecto, form.fase, form.manzana])

  // Lote seleccionado (para mostrar detalle)
  const loteSeleccionado = useMemo(
    () => lotesEnManzana.find((l) => l.codigo === form.lote) ?? null,
    [lotesEnManzana, form.lote],
  )

  // Capturar modifico_fecha del lote elegido para control de concurrencia optimista.
  // Se limpia automáticamente cuando lote se resetea por cascada (empresa/proyecto/fase/manzana).
  useEffect(() => {
    if (!form.lote) { setLoteLastModified(undefined); return }
    const lote = lotesDisponibles.find(
      (l) => l.empresa === form.empresa && l.proyecto === form.proyecto &&
             l.fase === form.fase && l.manzana === form.manzana && l.codigo === form.lote,
    )
    setLoteLastModified(lote?.modifico_fecha ?? undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.lote, form.empresa, form.proyecto, form.fase, form.manzana])

  // Clientes filtrados por proyecto
  const clientesPorProyecto = useMemo(
    () => clientes.filter((c) => c.proyecto === form.proyecto),
    [clientes, form.proyecto],
  )

  // Vendedores activos filtrados por empresa + proyecto
  const vendedoresPorProyecto = useMemo(
    () => vendedores.filter((v) => v.activo === 1 && v.empresa === form.empresa && v.proyecto === form.proyecto),
    [vendedores, form.empresa, form.proyecto],
  )

  // Cobradores activos filtrados por empresa + proyecto
  const cobradoresPorProyecto = useMemo(
    () => cobradores.filter((c) => c.activo === 1 && c.empresa === form.empresa && c.proyecto === form.proyecto),
    [cobradores, form.empresa, form.proyecto],
  )

  // Bancos filtrados por empresa + proyecto
  const bancosPorProyecto = useMemo(
    () => bancos.filter((b) => b.empresa === form.empresa && b.proyecto === form.proyecto),
    [bancos, form.empresa, form.proyecto],
  )

  // Cuentas bancarias activas filtradas por empresa + proyecto
  const cuentasActivas = useMemo(
    () => cuentasBancarias.filter((cb) => cb.activo === 1 && cb.empresa === form.empresa && cb.proyecto === form.proyecto),
    [cuentasBancarias, form.empresa, form.proyecto],
  )

  // Series de recibo para el proyecto seleccionado (ordenadas alfabético, ya vienen así del servidor).
  // Incluye series globales (empresa=0, proyecto=0) como fallback.
  const seriesReciboPorProyecto = useMemo(
    () => filterSeries(seriesRecibo, form.empresa, form.proyecto),
    [seriesRecibo, form.empresa, form.proyecto],
  )

  // Serie de recibo actualmente seleccionada (para leer recibo_automatico)
  const serieSeleccionada = useMemo(
    () => seriesReciboPorProyecto.find((s) => s.serie === form.serie_recibo) ?? null,
    [seriesReciboPorProyecto, form.serie_recibo],
  )
  const reciboAutomatico = serieSeleccionada?.recibo_automatico === 1

  // ── Función de actualización del formulario ───────────────────────────

  function f(key: keyof ReservaForm, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Cascada: al cambiar empresa, resetear desde proyecto hacia abajo
      if (key === 'empresa') {
        const emp  = Number(value)
        const proy = proyectos.find((p) => p.empresa === emp)?.codigo ?? 0
        const fase = firstFaseId(lotesDisponibles, fases, emp, proy)
        const manz = firstManzanaCodigo(lotesDisponibles, manzanas, emp, proy, fase)
        next.proyecto        = proy
        next.fase            = fase
        next.manzana         = manz
        next.lote            = firstLoteCodigo(lotesDisponibles, emp, proy, fase, manz)
        next.vendedor        = vendedores.find((v) => v.empresa === emp && v.proyecto === proy)?.codigo ?? 0
        next.cobrador        = cobradores.find((c) => c.empresa === emp && c.proyecto === proy)?.codigo ?? 0
        next.banco           = 0
        next.cuenta_bancaria = 0
        next.serie_recibo    = getDefaultSerie(filterSeries(seriesRecibo, emp, proy))
      }
      // Al cambiar proyecto, resetear fase → manzana → lote
      if (key === 'proyecto') {
        const emp  = prev.empresa
        const proy = Number(value)
        const fase = firstFaseId(lotesDisponibles, fases, emp, proy)
        const manz = firstManzanaCodigo(lotesDisponibles, manzanas, emp, proy, fase)
        next.fase            = fase
        next.manzana         = manz
        next.lote            = firstLoteCodigo(lotesDisponibles, emp, proy, fase, manz)
        next.vendedor        = vendedores.find((v) => v.empresa === emp && v.proyecto === proy)?.codigo ?? 0
        next.cobrador        = cobradores.find((c) => c.empresa === emp && c.proyecto === proy)?.codigo ?? 0
        next.banco           = 0
        next.cuenta_bancaria = 0
        next.serie_recibo    = getDefaultSerie(filterSeries(seriesRecibo, emp, proy))
      }
      // Al cambiar fase, pre-seleccionar primera manzana y primer lote
      if (key === 'fase') {
        const manz = firstManzanaCodigo(lotesDisponibles, manzanas, prev.empresa, prev.proyecto, Number(value))
        next.manzana = manz
        next.lote    = firstLoteCodigo(lotesDisponibles, prev.empresa, prev.proyecto, Number(value), manz)
      }
      // Al cambiar manzana, pre-seleccionar primer lote
      if (key === 'manzana') {
        next.lote = firstLoteCodigo(lotesDisponibles, prev.empresa, prev.proyecto, prev.fase, String(value))
      }
      // Al cambiar forma_pago, pre-seleccionar primer banco / primera cuenta bancaria según aplique
      if (key === 'forma_pago') {
        const fp = Number(value)
        next.num_cuenta      = ''
        next.num_documento   = ''
        next.banco           = fp === 2
          ? (bancos.find((b) => b.empresa === prev.empresa && b.proyecto === prev.proyecto)?.codigo ?? 0)
          : 0
        next.cuenta_bancaria = (fp === 3 || fp === 4)
          ? (cuentasBancarias.find((cb) => cb.activo === 1 && cb.empresa === prev.empresa && cb.proyecto === prev.proyecto)?.codigo ?? 0)
          : 0
      }
      // Al cambiar serie_recibo, limpiar el número de recibo manual
      if (key === 'serie_recibo') {
        next.recibo = ''
      }
      return next
    })
  }

  // ── Pipeline de filtrado de la tabla ─────────────────────────────────

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const afterSearch = useMemo(() => reservas.filter((r) => {
    const q = search.toLowerCase()
    if (!q) return true
    const proyNombre = proyectoMap.get(r.proyecto)?.toLowerCase() ?? ''
    const clienteNombre = clienteMap.get(r.cliente)?.toLowerCase() ?? ''
    return proyNombre.includes(q) || clienteNombre.includes(q) || r.lote.toLowerCase().includes(q) || r.fecha.includes(q)
  }), [reservas, search, proyectoMap, clienteMap])

  const filtered = useMemo(() => afterSearch.filter((r) => {
    if (fechaDesde && r.fecha < fechaDesde) return false
    if (fechaHasta && r.fecha > fechaHasta) return false
    if (vendedorFiltro !== 0 && r.vendedor !== vendedorFiltro) return false
    return Object.entries(colFilters).every(([col, vals]) => {
      if (col === '__proyecto') return vals.has(String(r.proyecto))
      if (col === '__fase')     return vals.has(String(r.fase))
      if (col === '__manzana')  return vals.has(r.manzana)
      if (col === '__cliente')  return vals.has(String(r.cliente))
      if (col === '__vendedor') return vals.has(String(r.vendedor))
      if (col === 'lote')       return vals.has(r.lote)
      if (col === 'fecha')      return vals.has(r.fecha)
      return true
    })
  }), [afterSearch, colFilters, fechaDesde, fechaHasta, vendedorFiltro])

  const hasActiveFilters = Object.keys(colFilters).length > 0 || !!fechaDesde || !!fechaHasta || vendedorFiltro !== 0

  // ── Preferencias de columnas ──────────────────────────────────────────
  const STORAGE_KEY = `reservas_cols_v1_${userId}`
  const [colPrefs, setColPrefs] = useState<ColPref[]>(DEFAULT_PREFS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed: ColPref[] = JSON.parse(raw)
      const knownKeys = new Set(parsed.map((p) => p.key))
      setColPrefs([
        ...parsed.filter((p) => ALL_COLUMNS.some((c) => c.key === p.key)),
        ...DEFAULT_PREFS.filter((p) => !knownKeys.has(p.key)),
      ])
    } catch { /* ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveColPrefs(next: ColPref[]) {
    setColPrefs(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
  }
  function toggleCol(key: string) { saveColPrefs(colPrefs.map((p) => p.key === key ? { ...p, visible: !p.visible } : p)) }
  function moveCol(key: string, dir: -1 | 1) {
    const idx = colPrefs.findIndex((p) => p.key === key)
    if (idx < 0) return
    const next = [...colPrefs]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    saveColPrefs(next)
  }
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ── Cursor de teclado ─────────────────────────────────────────────────
  const tableRef = useRef<HTMLDivElement>(null)
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursorIdx((prev) => prev === null ? 0 : Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursorIdx((prev) => prev === null ? 0 : Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && cursorIdx !== null) {
      e.preventDefault()
      openView(filtered[cursorIdx])
    } else if (e.key === 'Escape') {
      setCursorIdx(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, cursorIdx])

  useEffect(() => { setCursorIdx(null) }, [search, colFilters, fechaDesde, fechaHasta, vendedorFiltro])

  // ── Acciones de diálogo ───────────────────────────────────────────────

  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    const emp  = empresas[0]?.codigo ?? 0
    const proy = proyectos.find((p) => p.empresa === emp)?.codigo ?? 0
    const fase = firstFaseId(lotesDisponibles, fases, emp, proy)
    const manz = firstManzanaCodigo(lotesDisponibles, manzanas, emp, proy, fase)
    const lote = firstLoteCodigo(lotesDisponibles, emp, proy, fase, manz)
    const vend = vendedores.find((v) => v.empresa === emp && v.proyecto === proy)?.codigo ?? 0
    const cobr = cobradores.find((c) => c.empresa === emp && c.proyecto === proy)?.codigo ?? 0
    const fpago = Number(Object.keys(FORMAS_PAGO)[0])
    const banco1 = fpago === 2 ? (bancos.find((b) => b.empresa === emp && b.proyecto === proy)?.codigo ?? 0) : 0
    const cb1   = (fpago === 3 || fpago === 4) ? (cuentasBancarias.find((cb) => cb.activo === 1 && cb.empresa === emp && cb.proyecto === proy)?.codigo ?? 0) : 0
    const series = filterSeries(seriesRecibo, emp, proy)
    setForm({
      ...EMPTY_FORM,
      empresa: emp, proyecto: proy,
      fase, manzana: manz, lote,
      vendedor: vend, cobrador: cobr,
      forma_pago: fpago, banco: banco1, cuenta_bancaria: cb1,
      serie_recibo: getDefaultSerie(series),
    })
    setDialogOpen(true)
  }

  function openView(r: Reserva) {
    setViewTarget(r)
    setIsEditing(false)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.empresa)  { toast.error('Selecciona una empresa.');  return }
    if (!form.proyecto) { toast.error('Selecciona un proyecto.');  return }
    if (!form.fase)     { toast.error('Selecciona una fase.');     return }
    if (!form.manzana)  { toast.error('Selecciona una manzana.');  return }
    if (!form.lote)     { toast.error('Selecciona un lote.');      return }
    if (!form.vendedor)  { toast.error('Selecciona un vendedor.');                     return }
    if (!form.cliente)    { toast.error('Selecciona un cliente.');                     return }
    if (!form.fecha)      { toast.error('La fecha es requerida.');                     return }
    const montoNum = parseFloat(form.monto.replace(',', '.'))
    if (isNaN(montoNum) || montoNum <= 0) { toast.error('El monto debe ser mayor a 0.'); return }
    if (loteSeleccionado && montoNum > loteSeleccionado.valor) {
      toast.error(`El monto no puede ser mayor al valor del lote (${loteSeleccionado.moneda} ${fmt(loteSeleccionado.valor)}).`)
      return
    }
    if (!form.serie_recibo) { toast.error('Selecciona la serie de recibo.');           return }
    if (!reciboAutomatico && !form.recibo.trim()) { toast.error('Ingresa el número de recibo.'); return }
    if (!form.forma_pago) { toast.error('Selecciona la forma de pago.');               return }
    if (form.forma_pago === 2 && !form.banco)           { toast.error('Selecciona el banco.');            return }
    if (form.forma_pago === 2 && !form.num_cuenta.trim()) { toast.error('Ingresa el número de cuenta.');  return }
    if (form.forma_pago === 2 && !form.num_documento.trim()) { toast.error('Ingresa el número de documento.'); return }
    if ((form.forma_pago === 3 || form.forma_pago === 4) && !form.cuenta_bancaria) { toast.error('Selecciona la cuenta bancaria.'); return }
    if ((form.forma_pago === 3 || form.forma_pago === 4) && !form.num_documento.trim()) { toast.error('Ingresa el número de documento.'); return }
    if (!form.cobrador) { toast.error('Selecciona un cobrador.'); return }

    if (viewTarget) {
      // Edición — pendiente de implementar persistencia
      setReservas((prev) => prev.map((r) => r.id === viewTarget.id
        ? { ...r, ...form, monto: montoNum }
        : r,
      ))
      toast.success('Reserva actualizada.')
      setDialogOpen(false)
      return
    }

    // ── Creación con persistencia en BD ────────────────────────────────────
    setIsSaving(true)
    const result = await createReserva(
      {
        empresa:          form.empresa,
        proyecto:         form.proyecto,
        fase:             form.fase,
        manzana:          form.manzana,
        lote:             form.lote,
        cliente:          form.cliente,
        cliente_nombre:   clienteMap.get(form.cliente) ?? '',
        fase_nombre:      faseMap.get(form.fase) ?? '',
        vendedor:         form.vendedor,
        cobrador:         form.cobrador,
        serie_recibo:     form.serie_recibo,
        recibo:           form.recibo,
        recibo_automatico: reciboAutomatico,
        fecha:            form.fecha,
        monto:            form.monto,
        forma_pago:       form.forma_pago,
        banco:            form.banco,
        num_cuenta:       form.num_cuenta,
        num_documento:    form.num_documento,
        cuenta_bancaria:  form.cuenta_bancaria,
        moneda:           loteSeleccionado?.moneda ?? '',
      },
      loteLastModified,
    )
    setIsSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Reserva grabada correctamente.')
    router.refresh()
    setDialogOpen(false)
  }

  // ── Render ────────────────────────────────────────────────────────────

  const iconBadgeBg = isEditing && !viewTarget
    ? 'bg-teal-100'
    : isEditing
      ? 'bg-amber-100'
      : 'bg-teal-100'
  const iconColor   = isEditing && !viewTarget
    ? 'text-teal-600'
    : isEditing
      ? 'text-amber-600'
      : 'text-teal-600'

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-100 p-2.5">
            <ClipboardList className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Reservas</h1>
            <p className="text-sm text-muted-foreground">Registro de reservas de lotes por proyecto</p>
          </div>
        </div>
        <Button onClick={openCreate} disabled={!puedeAgregar} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Reserva
        </Button>
      </div>

      {/* ── Búsqueda + ColumnManager ── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar reservas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setColFilters({}); setFechaDesde(''); setFechaHasta(''); setVendedorFiltro(0) }} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto">
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => saveColPrefs(DEFAULT_PREFS)} />
        </div>
      </div>

      {/* ── Filtros rápidos: fecha + vendedor ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">Desde</span>
          <Input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">Hasta</span>
          <Input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <Select value={vendedorFiltro === 0 ? '' : String(vendedorFiltro)} onValueChange={(v) => setVendedorFiltro(v === '' ? 0 : Number(v))}>
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="Todos los vendedores">
              {(v: string) => v ? (vendedorMap.get(Number(v)) ?? v) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {vendedores.map((v) => (
              <SelectItem key={v.codigo} value={String(v.codigo)}>{v.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabla ── */}
      <div
        ref={tableRef}
        className="rounded-xl border border-border/60 bg-card shadow-sm outline-none overflow-x-auto"
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
        onFocus={() => { if (cursorIdx === null && filtered.length > 0) setCursorIdx(0) }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30"><span className="text-xs font-medium text-muted-foreground">Codigo</span></TableHead>
              {visibleCols.map((col) => {
                const def = ALL_COLUMNS.find((c) => c.key === col.key)!
                if (col.key === '__proyecto') {
                  return (
                    <TableHead key="__proyecto">
                      <ColumnFilter
                        label="Proyecto"
                        values={[...new Set(reservas.map((r) => proyectoMap.get(r.proyecto) ?? `#${r.proyecto}`))].sort()}
                        active={new Set([...(colFilters['__proyecto'] ?? new Set())].map((k) => proyectoMap.get(Number(k)) ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = new Map(proyectos.map((p) => [p.nombre, String(p.codigo)]))
                          setColFilter('__proyecto', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                if (col.key === '__cliente') {
                  return (
                    <TableHead key="__cliente">
                      <ColumnFilter
                        label="Cliente"
                        values={[...new Set(reservas.map((r) => clienteMap.get(r.cliente) ?? `#${r.cliente}`))].sort()}
                        active={new Set([...(colFilters['__cliente'] ?? new Set())].map((k) => clienteMap.get(Number(k)) ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = new Map(clientes.map((c) => [c.nombre, String(c.codigo)]))
                          setColFilter('__cliente', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                if (col.key === '__vendedor') {
                  return (
                    <TableHead key="__vendedor">
                      <ColumnFilter
                        label="Vendedor"
                        values={[...new Set(reservas.map((r) => vendedorMap.get(r.vendedor) ?? `#${r.vendedor}`))].sort()}
                        active={new Set([...(colFilters['__vendedor'] ?? new Set())].map((k) => vendedorMap.get(Number(k)) ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = new Map(vendedores.map((v) => [v.nombre, String(v.codigo)]))
                          setColFilter('__vendedor', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                return (
                  <TableHead key={col.key}>
                    <ColumnFilter
                      label={def.label}
                      values={[...new Set(reservas.map((r) => String(r[col.key as keyof Reserva] ?? '')))].sort()}
                      active={colFilters[col.key] ?? new Set()}
                      onChange={(v) => setColFilter(col.key, v)}
                    />
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-20 w-12 bg-muted/30" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length + 2} className="py-16 text-center text-muted-foreground">
                  {search || hasActiveFilters
                    ? 'No se encontraron reservas con ese criterio.'
                    : 'Todavía no hay reservas. Haz clic en "Nueva Reserva" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={r.id}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(r)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-950/30 border-l-[3px] border-l-teal-600 text-teal-700 dark:text-teal-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      #{rowIdx + 1}
                    </TableCell>

                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case '__proyecto':
                          return <TableCell key="__proyecto" className="font-medium">{proyectoMap.get(r.proyecto) ?? `#${r.proyecto}`}</TableCell>
                        case '__fase':
                          return <TableCell key="__fase" className="text-muted-foreground">{faseMap.get(r.fase) ?? `#${r.fase}`}</TableCell>
                        case '__manzana':
                          return <TableCell key="__manzana" className="text-muted-foreground">{r.manzana}</TableCell>
                        case 'lote':
                          return <TableCell key="lote" className="font-mono text-xs text-muted-foreground">{r.lote}</TableCell>
                        case '__cliente':
                          return <TableCell key="__cliente" className="text-muted-foreground">{clienteMap.get(r.cliente) ?? `#${r.cliente}`}</TableCell>
                        case '__vendedor':
                          return <TableCell key="__vendedor" className="text-muted-foreground">{vendedorMap.get(r.vendedor) ?? `#${r.vendedor}`}</TableCell>
                        case 'fecha':
                          return <TableCell key="fecha" className="text-muted-foreground">{r.fecha}</TableCell>
                        case 'monto': {
                          const curr = CURRENCIES.find((c) => c.iso === r.moneda)
                          return (
                            <TableCell key="monto" className="w-32 text-right font-mono text-sm">
                              <span className="inline-flex items-center justify-end gap-1.5">
                                {curr && (
                                  <img
                                    src={`https://flagcdn.com/w20/${curr.flagIso.toLowerCase()}.png`}
                                    width={20} height={14}
                                    alt={r.moneda}
                                    className="rounded-[2px] shrink-0"
                                  />
                                )}
                                {fmt(r.monto)}
                              </span>
                            </TableCell>
                          )
                        }
                        case '__estado': {
                          const est = RESERVA_ESTADOS[r.estado]
                          return (
                            <TableCell key="__estado">
                              {est
                                ? <Badge className={est.cls}>{est.label}</Badge>
                                : <Badge variant="outline">{r.estado}</Badge>}
                            </TableCell>
                          )
                        }
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{String(r[col.key as keyof Reserva] ?? '—')}</TableCell>
                      }
                    })}

                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger title="Acciones" className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(r)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver / Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Diálogo Nueva / Ver / Editar Reserva ── */}
      <Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) { setIsEditing(false) }
      }}>
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[38rem] h-[700px] max-h-[90vh] overflow-hidden">

          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-teal-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>
                <ClipboardList className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nueva Reserva' : isEditing ? 'Editar Reserva' : 'Detalle de Reserva'}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {proyectoMap.get(viewTarget.proyecto)} — Lote {viewTarget.lote}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">

              {/* ── Vista ─────────────────────────────────────────── */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)}  />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto)} />
                  </div>

                  <SectionDivider label="Ubicacion del Lote" />
                  <ViewField label="Fase"    value={faseMap.get(viewTarget.fase)} />
                  <ViewField label="Manzana" value={viewTarget.manzana} />
                  <div className="col-span-2">
                    <ViewField label="Lote" value={viewTarget.lote} />
                  </div>

                  <SectionDivider label="Datos Reserva" />
                  <div className="col-span-2">
                    <ViewField label="Vendedor" value={vendedorMap.get(viewTarget.vendedor)} />
                  </div>
                  <ViewField label="Cliente" value={clienteMap.get(viewTarget.cliente)} />
                  <ViewField label="Fecha"   value={viewTarget.fecha} />
                  <div className="col-span-2">
                    <ViewField label="Monto" value={viewTarget.monto ? fmt(viewTarget.monto) : ''} />
                  </div>

                  <SectionDivider label="Forma Pago" />
                  <div className="col-span-2">
                    <ViewField label="Forma de Pago" value={FORMAS_PAGO[viewTarget.forma_pago] ?? `#${viewTarget.forma_pago}`} />
                  </div>
                  {viewTarget.forma_pago === 2 && (
                    <>
                      <ViewField label="Banco"         value={bancoMap.get(viewTarget.banco)} />
                      <ViewField label="No. Cuenta"    value={viewTarget.num_cuenta || '—'} />
                      <div className="col-span-2">
                        <ViewField label="No. Documento" value={viewTarget.num_documento || '—'} />
                      </div>
                    </>
                  )}
                  {(viewTarget.forma_pago === 3 || viewTarget.forma_pago === 4) && (
                    <>
                      <div className="col-span-2">
                        <ViewField label="Cuenta Bancaria" value={cuentaBancariaMap.get(viewTarget.cuenta_bancaria)} />
                      </div>
                      <div className="col-span-2">
                        <ViewField label="No. Documento" value={viewTarget.num_documento || '—'} />
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <ViewField label="Cobrador" value={cobradorMap.get(viewTarget.cobrador)} />
                  </div>
                </div>

              ) : (
              /* ── Edición / Creación ──────────────────────────── */
                <div className="grid grid-cols-2 gap-4">

                  {/* Empresa */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="res-empresa" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Empresa *
                    </Label>
                    <Select
                      value={form.empresa ? String(form.empresa) : ''}
                      onValueChange={(v) => f('empresa', Number(v))}
                    >
                      <SelectTrigger id="res-empresa" className="w-full">
                        <SelectValue placeholder="Selecciona empresa">{(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => (
                          <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Proyecto */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="res-proyecto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Proyecto *
                    </Label>
                    <Select
                      value={form.proyecto ? String(form.proyecto) : ''}
                      onValueChange={(v) => f('proyecto', Number(v))}
                      disabled={!form.empresa}
                    >
                      <SelectTrigger id="res-proyecto" className="w-full">
                        <SelectValue placeholder={form.empresa ? 'Selecciona proyecto' : 'Primero selecciona empresa'}>{(v: string) => v ? (proyectoMap.get(Number(v)) ?? v) : null}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectosPorEmpresa.map((p) => (
                          <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selección de lote */}
                  <SectionDivider label="Seleccion Lote" />

                  {/* Fase + Manzana + Lote en una fila (4 cols: Fase=2, Manzana=1, Lote=1) */}
                  <div className="col-span-2 grid grid-cols-4 gap-4">

                    {/* Fase */}
                    <div className="col-span-2 grid gap-1">
                      <Label htmlFor="res-fase" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Fase *
                      </Label>
                      <Select
                        value={form.fase ? String(form.fase) : ''}
                        onValueChange={(v) => f('fase', Number(v))}
                        disabled={!form.proyecto}
                      >
                        <SelectTrigger id="res-fase" className="w-full">
                          <SelectValue placeholder={form.proyecto ? fasesConLotes.length === 0 ? 'Sin fases' : 'Selecciona fase' : '—'}>
                            {(v: string) => v ? (faseMap.get(Number(v)) ?? v) : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {fasesConLotes.map((fa) => (
                            <SelectItem key={fa.codigo} value={String(fa.codigo)}>{fa.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Manzana */}
                    <div className="grid gap-1">
                      <Label htmlFor="res-manzana" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Manzana *
                      </Label>
                      <Select
                        value={form.manzana}
                        onValueChange={(v) => f('manzana', v)}
                        disabled={!form.fase}
                      >
                        <SelectTrigger id="res-manzana" className="w-full">
                          <SelectValue placeholder={form.fase ? manzanasConLotes.length === 0 ? '—' : 'Manzana' : '—'} />
                        </SelectTrigger>
                        <SelectContent>
                          {manzanasConLotes.map((m) => (
                            <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Lote */}
                    <div className="grid gap-1">
                      <Label htmlFor="res-lote" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Lote *
                      </Label>
                      <Select
                        value={form.lote}
                        onValueChange={(v) => f('lote', v)}
                        disabled={!form.manzana}
                      >
                        <SelectTrigger id="res-lote" className="w-full">
                          <SelectValue placeholder={form.manzana ? lotesEnManzana.length === 0 ? '—' : 'Lote' : '—'} />
                        </SelectTrigger>
                        <SelectContent>
                          {lotesEnManzana.map((l) => (
                            <SelectItem key={l.codigo} value={l.codigo}>{l.codigo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>{/* fin fila Fase/Manzana/Lote */}

                  {/* Resumen del lote seleccionado */}
                  {loteSeleccionado && (
                    <div className="col-span-2 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600/70">Extension</p>
                        <p className="text-sm font-semibold text-teal-900">{loteSeleccionado.extension} m²</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600/70">Precio Venta</p>
                        <p className="text-sm font-semibold text-teal-900">{loteSeleccionado.moneda} {fmt(loteSeleccionado.valor)}</p>
                      </div>
                    </div>
                  )}

                  {/* Transacción */}
                  <SectionDivider label="Datos Reserva" />

                  {/* Vendedor */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="res-vendedor" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Vendedor *
                    </Label>
                    <Select
                      value={form.vendedor ? String(form.vendedor) : ''}
                      onValueChange={(v) => f('vendedor', Number(v))}
                      disabled={!form.proyecto}
                    >
                      <SelectTrigger id="res-vendedor" className="w-full">
                        <SelectValue placeholder={form.proyecto ? 'Selecciona vendedor' : 'Primero selecciona proyecto'}>{(v: string) => v ? (vendedorMap.get(Number(v)) ?? v) : null}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {vendedoresPorProyecto.map((vend) => (
                          <SelectItem key={vend.codigo} value={String(vend.codigo)}>{vend.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cliente */}
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Cliente *
                    </Label>
                    <ClienteCombobox
                      clientes={clientesPorProyecto}
                      value={form.cliente}
                      onChange={(v) => f('cliente', v)}
                      disabled={!form.proyecto}
                      placeholder={form.proyecto ? 'Selecciona cliente...' : 'Primero selecciona proyecto'}
                    />
                  </div>

                  {/* Fecha */}
                  <div className="grid gap-1">
                    <Label htmlFor="res-fecha" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Fecha *
                    </Label>
                    <Input
                      id="res-fecha"
                      type="date"
                      value={form.fecha}
                      onChange={(e) => f('fecha', e.target.value)}
                    />
                  </div>

                  {/* Monto */}
                  <div className="grid gap-1">
                    <Label htmlFor="res-monto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Monto *
                    </Label>
                    <Input
                      id="res-monto"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.monto}
                      onChange={(e) => f('monto', e.target.value)}
                    />
                  </div>

                  {/* ── Forma Pago ───────────────────────────────── */}
                  <SectionDivider label="Forma Pago" />

                  {/* Serie Recibo + Recibo + Forma Pago en la misma fila (3 columnas) */}
                  <div className="col-span-2 grid grid-cols-3 gap-4">

                    {/* Serie Recibo */}
                    <div className="grid gap-1">
                      <Label htmlFor="res-serie-recibo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Serie Recibo *
                      </Label>
                      <Select
                        value={form.serie_recibo}
                        onValueChange={(v) => f('serie_recibo', v)}
                      >
                        <SelectTrigger id="res-serie-recibo" className="w-full">
                          <SelectValue placeholder={seriesReciboPorProyecto.length === 0 ? 'Sin series' : 'Selecciona serie'} />
                        </SelectTrigger>
                        <SelectContent>
                          {seriesReciboPorProyecto.map((s) => (
                            <SelectItem key={s.serie} value={s.serie}>{s.serie}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Recibo */}
                    <div className="grid gap-1">
                      <Label htmlFor="res-recibo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Recibo{!reciboAutomatico && ' *'}
                      </Label>
                      <Input
                        id="res-recibo"
                        placeholder={reciboAutomatico ? 'Automático' : 'No. recibo'}
                        disabled={reciboAutomatico}
                        value={form.recibo}
                        onChange={(e) => f('recibo', e.target.value)}
                      />
                    </div>

                    {/* Forma Pago */}
                    <div className="grid gap-1">
                      <Label htmlFor="res-forma-pago" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Forma Pago *
                      </Label>
                      <Select
                        value={form.forma_pago ? String(form.forma_pago) : ''}
                        onValueChange={(v) => f('forma_pago', Number(v))}
                      >
                        <SelectTrigger id="res-forma-pago" className="w-full">
                          <SelectValue placeholder="Selecciona forma de pago">{(v: string) => v ? (FORMAS_PAGO[Number(v)] ?? v) : null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FORMAS_PAGO).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>{/* fin fila Serie/Recibo/FormaPago */}

                  {/* Cheque: Banco */}
                  {form.forma_pago === 2 && (
                    <div className="col-span-2 grid gap-1">
                      <Label htmlFor="res-banco" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Banco *
                      </Label>
                      <Select
                        value={form.banco ? String(form.banco) : ''}
                        onValueChange={(v) => f('banco', Number(v))}
                      >
                        <SelectTrigger id="res-banco" className="w-full">
                          <SelectValue placeholder={bancosPorProyecto.length === 0 ? 'Sin bancos registrados' : 'Selecciona banco'}>{(v: string) => v ? (bancoMap.get(Number(v)) ?? v) : null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {bancosPorProyecto.map((b) => (
                            <SelectItem key={b.codigo} value={String(b.codigo)}>{b.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Cheque: No. Cuenta + No. Documento */}
                  {form.forma_pago === 2 && (
                    <>
                      <div className="grid gap-1">
                        <Label htmlFor="res-num-cuenta" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                          No. Cuenta *
                        </Label>
                        <Input
                          id="res-num-cuenta"
                          placeholder="Número de cuenta"
                          value={form.num_cuenta}
                          onChange={(e) => f('num_cuenta', e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="res-num-doc-cheque" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                          No. Documento *
                        </Label>
                        <Input
                          id="res-num-doc-cheque"
                          placeholder="Número de cheque"
                          value={form.num_documento}
                          onChange={(e) => f('num_documento', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Depósito / Transferencia: Cuenta Bancaria */}
                  {(form.forma_pago === 3 || form.forma_pago === 4) && (
                    <div className="col-span-2 grid gap-1">
                      <Label htmlFor="res-cuenta-bancaria" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        Cuenta Bancaria *
                      </Label>
                      <Select
                        value={form.cuenta_bancaria ? String(form.cuenta_bancaria) : ''}
                        onValueChange={(v) => f('cuenta_bancaria', Number(v))}
                      >
                        <SelectTrigger id="res-cuenta-bancaria" className="w-full">
                          <SelectValue placeholder={cuentasActivas.length === 0 ? 'Sin cuentas activas' : 'Selecciona cuenta bancaria'}>{(v: string) => v ? (cuentaBancariaMap.get(Number(v)) ?? v) : null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {cuentasActivas.map((cb) => (
                            <SelectItem key={cb.codigo} value={String(cb.codigo)}>{bancoMap.get(cb.banco) ?? cb.banco}: {cb.numero}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Depósito / Transferencia: No. Documento */}
                  {(form.forma_pago === 3 || form.forma_pago === 4) && (
                    <div className="col-span-2 grid gap-1">
                      <Label htmlFor="res-num-doc" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                        No. Documento *
                      </Label>
                      <Input
                        id="res-num-doc"
                        placeholder="Número de documento"
                        value={form.num_documento}
                        onChange={(e) => f('num_documento', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Cobrador */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="res-cobrador" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                      Cobrador *
                    </Label>
                    <Select
                      value={form.cobrador ? String(form.cobrador) : ''}
                      onValueChange={(v) => f('cobrador', Number(v))}
                      disabled={!form.proyecto}
                    >
                      <SelectTrigger id="res-cobrador" className="w-full">
                        <SelectValue placeholder={form.proyecto ? 'Selecciona cobrador' : 'Primero selecciona proyecto'}>{(v: string) => v ? (cobradorMap.get(Number(v)) ?? v) : null}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {cobradoresPorProyecto.map((cob) => (
                          <SelectItem key={cob.codigo} value={String(cob.codigo)}>{cob.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              )}

            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                <Button onClick={startEdit} className="gap-2">Editar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
                <Button onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  )
}
