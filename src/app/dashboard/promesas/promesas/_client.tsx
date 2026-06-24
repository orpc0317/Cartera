'use client'

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Trash2, Plus, Search, History,
  Settings2, ChevronDown, ChevronUp, X, FileSignature, Download,
  ChevronLeft, ChevronRight,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { createPromesa, updatePromesa, deletePromesa } from '@/app/actions/promesas'
import type { Promesa, PromesaForm } from '@/lib/types/promesas'
import type { Empresa, Proyecto, Fase, Manzana, Lote, Cliente, Vendedor } from '@/lib/types/proyectos'

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

const SKIP_KEYS = new Set(['moneda', 'manzana', 'lote'])

const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])

const fmtDate = (d: string | null | undefined) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const fmtNum = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function calcEnganche(monto: number, plazo: number, primer: number) {
  if (!monto || !plazo || plazo < 1) return { cuotas: 0, montoCuota: 0, ultimaCuota: 0 }
  const montoBase = primer > 0 ? monto - primer : monto
  const divisor   = primer > 0 ? plazo - 1      : plazo
  if (divisor <= 0 || montoBase <= 0) return { cuotas: 0, montoCuota: 0, ultimaCuota: 0 }
  const rawCuota  = montoBase / divisor
  const cuota2dec = Math.floor(rawCuota * 100) / 100
  if (Math.abs(rawCuota - cuota2dec) < 1e-9) {
    return { cuotas: divisor, montoCuota: cuota2dec, ultimaCuota: 0 }
  }
  const cuotasReg = divisor - 1
  const ultima    = Math.round((montoBase - cuota2dec * cuotasReg) * 100) / 100
  return { cuotas: cuotasReg, montoCuota: cuota2dec, ultimaCuota: ultima }
}

function calcFinanciamiento(monto: number, plazo: number) {
  if (!monto || !plazo || plazo < 1) return { cuotas: 0, montoCuota: 0, ultimaCuota: 0 }
  const rawCuota  = monto / plazo
  const cuota2dec = Math.floor(rawCuota * 100) / 100
  if (Math.abs(rawCuota - cuota2dec) < 1e-9) {
    return { cuotas: plazo, montoCuota: cuota2dec, ultimaCuota: 0 }
  }
  const cuotasReg = plazo - 1
  const ultima    = Math.round((monto - cuota2dec * cuotasReg) * 100) / 100
  return { cuotas: cuotasReg, montoCuota: cuota2dec, ultimaCuota: ultima }
}

const FORMAS_CALCULO: Record<number, string> = {
  1: 'Cuota Nivelada',
}

const EMPTY_FORM: PromesaForm = {
  empresa: 0,
  proyecto: 0,
  numero: 0,
  referencia: '',
  fecha: new Date().toISOString().slice(0, 10),
  cliente: 0,
  vendedor: 0,
  fase: 0,
  manzana: '',
  lote: '',
  moneda: '',
  valor_lote: 0,
  subsidio: 0,
  arras: 0,
  monto_enganche: 0,
  primer_enganche: 0,
  plazo_enganche: 0,
  interes_anual: 0,
  forma_mora: 0,
  interes_mora: 0,
  fijo_mora: 0,
  mora_enganche: 0,
  dias_gracia: 0,
  dias_afectos: 0,
  forma_financiamiento: 1,
  fecha_financiamiento: null,
  monto_financiamiento: 0,
  plazo_financiamiento: 0,
  fecha_cancelacion: null,
  venta: 1,
  observacion: '',
  estado: 1,
}

// â”€â”€â”€ Column definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',  label: 'Empresa',  defaultVisible: false },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: true  },
  { key: 'fecha',    label: 'Fecha',    defaultVisible: true  },
  { key: 'fase',     label: 'Fase',     defaultVisible: true  },
  { key: 'manzana',  label: 'Manzana',  defaultVisible: true  },
  { key: 'lote',     label: 'Lote',     defaultVisible: true  },
  { key: 'cliente',  label: 'Cliente',  defaultVisible: true  },
  { key: 'vendedor', label: 'Vendedor', defaultVisible: false },
]

const COL_LABELS: Record<string, string> = {
  numero: 'Numero',
  ...Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.label])),
}

type ColFilters = Record<string, Set<string>>

// â”€â”€â”€ Helper components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
        <span className="block font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{value || ''}</span>
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

function ColumnFilter({ label, values, active, onChange }: {
  label: string; values: string[]; active: Set<string>; onChange: (next: Set<string>) => void
}) {
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
              <Checkbox
                checked={active.has(v)}
                onCheckedChange={(checked: boolean) => {
                  const next = new Set(active)
                  checked ? next.add(v) : next.delete(v)
                  onChange(next)
                }}
              />
              <span className="truncate">{v || '(vacio)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColumnManager({ prefs, onToggle, onMove, onReset }: {
  prefs: ColPref[]; onToggle: (key: string) => void; onMove: (key: string, dir: -1 | 1) => void; onReset: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Columnas</Button>} />
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
            className="flex h-8 w-full items-center justify-between rounded-t-sm border-0 border-b border-input bg-muted/30 px-2.5 py-1 transition-colors outline-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:border-dashed disabled:bg-muted/20"
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
            <Input variant="l-border"
              ref={inputRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" title="Limpiar busqueda" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
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
                  {c.codigo === value && <span className="ml-2 shrink-0 text-fuchsia-600">âœ“</span>}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PromesasClient({
  initialData,
  empresas,
  proyectos,
  fases,
  manzanas,
  lotes,
  clientes,
  vendedores,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: Promesa[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  fases: Fase[]
  manzanas: Manzana[]
  lotes: Lote[]
  clientes: Cliente[]
  vendedores: Vendedor[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch]           = useState('')
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [isEditing, setIsEditing]     = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget]   = useState<Promesa | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Promesa | null>(null)
  const [auditTarget, setAuditTarget]   = useState<Promesa | null>(null)
  const [tipoCalculo, setTipoCalculo]   = useState(0)
  const [form, setForm]               = useState<PromesaForm>(EMPTY_FORM)
  const [colFilters, setColFilters]   = useState<ColFilters>({})

  // -- Column prefs ----------------------------------------------------------
  const STORAGE_KEY = `promesas_cols_v1_${userId}`
  const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

  const [colPrefs, setColPrefs] = useState<ColPref[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: ColPref[] = JSON.parse(saved)
        const merged = DEFAULT_PREFS.map((dp) => {
          const found = parsed.find((p) => p.key === dp.key)
          return found ?? dp
        })
        return merged.sort((a, b) => {
          const ai = parsed.findIndex((p) => p.key === a.key)
          const bi = parsed.findIndex((p) => p.key === b.key)
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
      }
    } catch { /* ignore */ }
    return DEFAULT_PREFS
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colPrefs))
  }, [colPrefs, STORAGE_KEY])

  // -- FK Maps ---------------------------------------------------------------
  const empresaMap  = useMemo(() => new Map(empresas.map((e)  => [e.codigo,  e.nombre])),  [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`,  p.nombre])),  [proyectos])
  const faseMap     = useMemo(() => new Map(fases.map((f)     => [`${f.empresa}-${f.proyecto}-${f.codigo}`,  f.nombre])),  [fases])
  const clienteMap  = useMemo(() => new Map(clientes.map((c)  => [`${c.empresa}-${c.proyecto}-${c.codigo}`,  c.nombre])),  [clientes])
  const vendedorMap = useMemo(() => new Map(vendedores.map((v) => [`${v.empresa}-${v.proyecto}-${v.codigo}`, v.nombre])), [vendedores])

  // -- Cascade filters for form ---------------------------------------------
  const proyectosFiltrados  = useMemo(() => proyectos.filter((p) => p.empresa === form.empresa),  [proyectos, form.empresa])
  const fasesFiltradas       = useMemo(() => fases.filter((fa) => fa.empresa === form.empresa && fa.proyecto === form.proyecto), [fases, form.empresa, form.proyecto])
  const manzanasFiltradas    = useMemo(() => manzanas.filter((m) => m.empresa === form.empresa && m.proyecto === form.proyecto && m.fase === form.fase), [manzanas, form.empresa, form.proyecto, form.fase])
  const lotesFiltrados       = useMemo(() => lotes.filter((l) => l.empresa === form.empresa && l.proyecto === form.proyecto && l.fase === form.fase && l.manzana === form.manzana), [lotes, form.empresa, form.proyecto, form.fase, form.manzana])
  const loteActivoForm       = useMemo(() => lotes.find((l) => l.empresa === form.empresa && l.proyecto === form.proyecto && l.fase === form.fase && l.manzana === form.manzana && l.codigo === form.lote), [lotes, form.empresa, form.proyecto, form.fase, form.manzana, form.lote])
  const medidaForm           = useMemo(() => fases.find((f) => f.empresa === form.empresa && f.proyecto === form.proyecto && f.codigo === form.fase)?.medida ?? '', [fases, form.empresa, form.proyecto, form.fase])
  const loteActivoVista      = useMemo(() => viewTarget ? lotes.find((l) => l.empresa === viewTarget.empresa && l.proyecto === viewTarget.proyecto && l.fase === viewTarget.fase && l.manzana === viewTarget.manzana && l.codigo === viewTarget.lote) : undefined, [lotes, viewTarget])
  const medidaVista          = useMemo(() => viewTarget ? fases.find((f) => f.empresa === viewTarget.empresa && f.proyecto === viewTarget.proyecto && f.codigo === viewTarget.fase)?.medida ?? '' : '', [fases, viewTarget])
  const engancheCalcForm          = useMemo(() => calcEnganche(form.monto_enganche, form.plazo_enganche, form.primer_enganche), [form.monto_enganche, form.plazo_enganche, form.primer_enganche])
  const engancheCalcVista          = useMemo(() => viewTarget ? calcEnganche(viewTarget.monto_enganche, viewTarget.plazo_enganche, viewTarget.primer_enganche) : { cuotas: 0, montoCuota: 0, ultimaCuota: 0 }, [viewTarget])
  const montoFinancCalc            = useMemo(() => Math.max(0, (form.valor_lote || 0) - (form.subsidio || 0) - (form.monto_enganche || 0)), [form.valor_lote, form.subsidio, form.monto_enganche])
  const financiamientoCalcForm     = useMemo(() => calcFinanciamiento(montoFinancCalc, form.plazo_financiamiento), [montoFinancCalc, form.plazo_financiamiento])
  const financiamientoCalcVista    = useMemo(() => viewTarget ? calcFinanciamiento(viewTarget.monto_financiamiento, viewTarget.plazo_financiamiento) : { cuotas: 0, montoCuota: 0, ultimaCuota: 0 }, [viewTarget])
  const clientesFiltrados    = useMemo(() => clientes.filter((c) => c.empresa === form.empresa && c.proyecto === form.proyecto), [clientes, form.empresa, form.proyecto])
  const vendedoresFiltrados  = useMemo(() => vendedores.filter((v) => v.empresa === form.empresa && v.proyecto === form.proyecto), [vendedores, form.empresa, form.proyecto])
  const proyectoActivo       = useMemo(() => proyectos.find((p) => p.empresa === form.empresa && p.codigo === form.proyecto), [proyectos, form.empresa, form.proyecto])
  const moraEditable         = proyectoActivo?.fijar_parametros_mora === 1

  // -- Unique filter values for table columns --------------------------------
  const uniqueEmpresaNames  = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa)   ?? ''))].filter(Boolean).sort(), [initialData, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? ''))].filter(Boolean).sort(), [initialData, proyectoMap])
  const uniqueFechaVals     = useMemo(() => [...new Set(initialData.map((r) => r.fecha))].filter(Boolean).sort(), [initialData])
  const uniqueFaseNames     = useMemo(() => [...new Set(initialData.map((r) => faseMap.get(`${r.empresa}-${r.proyecto}-${r.fase}`) ?? ''))].filter(Boolean).sort(), [initialData, faseMap])
  const uniqueManzanaVals   = useMemo(() => [...new Set(initialData.map((r) => r.manzana))].filter(Boolean).sort(), [initialData])
  const uniqueLoteVals      = useMemo(() => [...new Set(initialData.map((r) => r.lote))].filter(Boolean).sort(), [initialData])
  const uniqueClienteNames  = useMemo(() => [...new Set(initialData.map((r) => clienteMap.get(`${r.empresa}-${r.proyecto}-${r.cliente}`) ?? ''))].filter(Boolean).sort(), [initialData, clienteMap])
  const uniqueVendedorNames = useMemo(() => [...new Set(initialData.map((r) => vendedorMap.get(`${r.empresa}-${r.proyecto}-${r.vendedor}`) ?? ''))].filter(Boolean).sort(), [initialData, vendedorMap])

  // -- Filtered rows ---------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return initialData.filter((r) => {
      if (q &&
          !String(r.numero).includes(q) &&
          !r.referencia.toLowerCase().includes(q) &&
          !(empresaMap.get(r.empresa) ?? '').toLowerCase().includes(q) &&
          !(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '').toLowerCase().includes(q) &&
          !(clienteMap.get(`${r.empresa}-${r.proyecto}-${r.cliente}`) ?? '').toLowerCase().includes(q)) {
        return false
      }
      return Object.entries(colFilters).every(([col, vals]) => {
        if (col === 'empresa')  return vals.has(empresaMap.get(r.empresa)   ?? '')
        if (col === 'proyecto') return vals.has(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '')
        if (col === 'fecha')    return vals.has(r.fecha)
        if (col === 'fase')     return vals.has(faseMap.get(`${r.empresa}-${r.proyecto}-${r.fase}`) ?? '')
        if (col === 'manzana')  return vals.has(r.manzana)
        if (col === 'lote')     return vals.has(r.lote)
        if (col === 'cliente')  return vals.has(clienteMap.get(`${r.empresa}-${r.proyecto}-${r.cliente}`) ?? '')
        if (col === 'vendedor') return vals.has(vendedorMap.get(`${r.empresa}-${r.proyecto}-${r.vendedor}`) ?? '')
        return vals.has(String((r as Record<string, unknown>)[col] ?? ''))
      })
    })
  }, [initialData, search, colFilters, empresaMap, proyectoMap, faseMap, clienteMap, vendedorMap])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // -- Pagination ------------------------------------------------------------
  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedRows = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])

  // -- Keyboard navigation ---------------------------------------------------
  const tableRef = useRef<HTMLDivElement>(null)
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursorIdx((prev) => {
        const next = prev === null ? page * PAGE_SIZE : Math.min(prev + 1, filtered.length - 1)
        if (next >= (page + 1) * PAGE_SIZE) setPage((p) => p + 1)
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursorIdx((prev) => {
        const next = prev === null ? page * PAGE_SIZE : Math.max(prev - 1, 0)
        if (next < page * PAGE_SIZE) setPage((p) => Math.max(p - 1, 0))
        return next
      })
    } else if (e.key === 'Enter' && cursorIdx !== null) {
      e.preventDefault()
      openView(filtered[cursorIdx])
    } else if (e.key === 'Escape') {
      setCursorIdx(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, cursorIdx, page])

  useEffect(() => { setCursorIdx(null); setPage(0) }, [search, colFilters])

  // -- Column filter helper --------------------------------------------------
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  // -- form helper (cascade) ------------------------------------------------
  const f = useCallback((key: string, value: unknown) => {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const empCod = v as number
        const firstPro = proyectos.find((p) => p.empresa === empCod)
        const pCod = firstPro?.codigo ?? 0
        const firstFa = fases.find((fa) => fa.empresa === empCod && fa.proyecto === pCod)
        const fCod = firstFa?.codigo ?? 0
        const firstMz = manzanas.find((m) => m.empresa === empCod && m.proyecto === pCod && m.fase === fCod)
        const mzCod = firstMz?.codigo ?? ''
        const firstLote = lotes.find((l) => l.empresa === empCod && l.proyecto === pCod && l.fase === fCod && l.manzana === mzCod)
        const firstVen = vendedores.find((ven) => ven.empresa === empCod && ven.proyecto === pCod)
        next.proyecto  = pCod
        next.fase      = fCod
        next.manzana   = mzCod
        next.lote      = firstLote?.codigo ?? ''
        next.moneda    = firstLote?.moneda ?? ''
        next.valor_lote = firstLote?.valor ?? 0
        next.cliente   = 0
        next.vendedor  = firstVen?.codigo ?? 0
        next.forma_mora   = firstPro?.forma_mora   ?? 0
        next.interes_mora = firstPro?.interes_mora ?? 0
        next.fijo_mora    = firstPro?.fijo_mora    ?? 0
        next.dias_gracia  = firstPro?.dias_gracia  ?? 0
        next.dias_afectos  = firstPro?.dias_afectos ?? 0
      }
      if (key === 'proyecto') {
        const pCod = v as number
        const proObj = proyectos.find((p) => p.empresa === prev.empresa && p.codigo === pCod)
        const firstFa = fases.find((fa) => fa.empresa === prev.empresa && fa.proyecto === pCod)
        const fCod = firstFa?.codigo ?? 0
        const firstMz = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === pCod && m.fase === fCod)
        const mzCod = firstMz?.codigo ?? ''
        const firstLote = lotes.find((l) => l.empresa === prev.empresa && l.proyecto === pCod && l.fase === fCod && l.manzana === mzCod)
        const firstVen = vendedores.find((ven) => ven.empresa === prev.empresa && ven.proyecto === pCod)
        next.fase       = fCod
        next.manzana    = mzCod
        next.lote       = firstLote?.codigo ?? ''
        next.moneda     = firstLote?.moneda ?? ''
        next.valor_lote = firstLote?.valor ?? 0
        next.cliente    = 0
        next.vendedor   = firstVen?.codigo ?? 0
        next.forma_mora   = proObj?.forma_mora   ?? 0
        next.interes_mora = proObj?.interes_mora ?? 0
        next.fijo_mora    = proObj?.fijo_mora    ?? 0
        next.dias_gracia  = proObj?.dias_gracia  ?? 0
        next.dias_afectos  = proObj?.dias_afectos ?? 0
      }
      if (key === 'fase') {
        const fCod = v as number
        const firstMz = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === prev.proyecto && m.fase === fCod)
        const mzCod = firstMz?.codigo ?? ''
        const firstLote = lotes.find((l) => l.empresa === prev.empresa && l.proyecto === prev.proyecto && l.fase === fCod && l.manzana === mzCod)
        next.manzana    = mzCod
        next.lote       = firstLote?.codigo ?? ''
        next.moneda     = firstLote?.moneda ?? ''
        next.valor_lote = firstLote?.valor ?? 0
      }
      if (key === 'manzana') {
        const mzCod = v as string
        const firstLote = lotes.find((l) => l.empresa === prev.empresa && l.proyecto === prev.proyecto && l.fase === prev.fase && l.manzana === mzCod)
        next.lote       = firstLote?.codigo ?? ''
        next.moneda     = firstLote?.moneda ?? ''
        next.valor_lote = firstLote?.valor ?? 0
      }
      if (key === 'lote') {
        const loteData = lotes.find((l) => l.empresa === prev.empresa && l.proyecto === prev.proyecto && l.fase === prev.fase && l.manzana === prev.manzana && l.codigo === (v as string))
        next.moneda     = loteData?.moneda ?? prev.moneda
        next.valor_lote = loteData?.valor ?? prev.valor_lote
      }
      return next
    })
    if (key === 'empresa') {
      const empCod = value as number
      const firstPro = proyectos.find((p) => p.empresa === empCod)
      setTipoCalculo((firstPro?.fijo_mora ?? 0) > 0 ? 1 : 0)
    } else if (key === 'proyecto') {
      const pCod = value as number
      const proObj = proyectos.find((p) => p.empresa === form.empresa && p.codigo === pCod)
      setTipoCalculo((proObj?.fijo_mora ?? 0) > 0 ? 1 : 0)
    }
  }, [proyectos, fases, manzanas, lotes, vendedores, form.empresa])

  // -- Dialog open/close helpers --------------------------------------------

  function openView(promesa: Promesa) {
    setViewTarget(promesa)
    setTipoCalculo((promesa.fijo_mora ?? 0) > 0 ? 1 : 0)
    setIsEditing(false)
    setDialogOpen(true)
  }

  function openCreate() {
    const empCod  = empresas[0]?.codigo ?? 0
    const firstPro = proyectos.find((p) => p.empresa === empCod)
    const proCod  = firstPro?.codigo ?? 0
    const faCod   = fases.find((fa) => fa.empresa === empCod && fa.proyecto === proCod)?.codigo ?? 0
    const firstMz = manzanas.find((m) => m.empresa === empCod && m.proyecto === proCod && m.fase === faCod)
    const mzCod   = firstMz?.codigo ?? ''
    const firstLote = lotes.find((l) => l.empresa === empCod && l.proyecto === proCod && l.fase === faCod && l.manzana === mzCod)
    const firstVen  = vendedores.find((ven) => ven.empresa === empCod && ven.proyecto === proCod)

    setForm({
      ...EMPTY_FORM,
      empresa:      empCod,
      proyecto:     proCod,
      fase:         faCod,
      manzana:      mzCod,
      lote:         firstLote?.codigo  ?? '',
      moneda:       firstLote?.moneda  ?? '',
      valor_lote:   firstLote?.valor   ?? 0,
      vendedor:     firstVen?.codigo   ?? 0,
      forma_mora:   firstPro?.forma_mora   ?? 0,
      interes_mora: firstPro?.interes_mora ?? 0,
      fijo_mora:    firstPro?.fijo_mora    ?? 0,
      dias_gracia:  firstPro?.dias_gracia  ?? 0,
      dias_afectos:  firstPro?.dias_afectos ?? 0,
    })
    setTipoCalculo((firstPro?.fijo_mora ?? 0) > 0 ? 1 : 0)
    setViewTarget(null)
    setIsEditing(true)
    setDialogOpen(true)
  }

  function startEdit() {
    if (!viewTarget) return
    setForm({
      empresa:              viewTarget.empresa,
      proyecto:             viewTarget.proyecto,
      numero:               viewTarget.numero,
      referencia:           viewTarget.referencia ?? '',
      fecha:                viewTarget.fecha,
      cliente:              viewTarget.cliente,
      vendedor:             viewTarget.vendedor,
      fase:                 viewTarget.fase,
      manzana:              viewTarget.manzana,
      lote:                 viewTarget.lote,
      moneda:               viewTarget.moneda,
      valor_lote:           viewTarget.valor_lote,
      subsidio:             viewTarget.subsidio,
      arras:                viewTarget.arras,
      monto_enganche:       viewTarget.monto_enganche,
      primer_enganche:      viewTarget.primer_enganche,
      plazo_enganche:       viewTarget.plazo_enganche,
      interes_anual:        viewTarget.interes_anual,
      forma_mora:           viewTarget.forma_mora,
      interes_mora:         viewTarget.interes_mora,
      fijo_mora:            viewTarget.fijo_mora,
      mora_enganche:        viewTarget.mora_enganche,
      dias_gracia:          viewTarget.dias_gracia,
      dias_afectos:          viewTarget.dias_afectos,
      forma_financiamiento: viewTarget.forma_financiamiento,
      fecha_financiamiento: viewTarget.fecha_financiamiento,
      monto_financiamiento: viewTarget.monto_financiamiento,
      plazo_financiamiento: viewTarget.plazo_financiamiento,
      fecha_cancelacion:    viewTarget.fecha_cancelacion,
      venta:                viewTarget.venta,
      observacion:          viewTarget.observacion ?? '',
      estado:               viewTarget.estado,
    })
    setTipoCalculo((viewTarget.fijo_mora ?? 0) > 0 ? 1 : 0)
    setIsEditing(true)
  }

  function cancelEdit() {
    if (viewTarget) setIsEditing(false)
    else setDialogOpen(false)
  }

  // -- Save / Delete --------------------------------------------------------

  function handleSave() {
    if (viewTarget) {
      const noChanges =
        form.referencia  === (viewTarget.referencia  ?? '') &&
        form.observacion === (viewTarget.observacion ?? '') &&
        form.estado      === viewTarget.estado
      if (noChanges) { setIsEditing(false); return }
    }

    startTransition(async () => {
      if (viewTarget) {
        const res = await updatePromesa(
          viewTarget.empresa,
          viewTarget.proyecto,
          viewTarget.numero,
          { referencia: form.referencia, observacion: form.observacion, estado: form.estado },
          viewTarget.modifico_fecha,
        )
        if (res.error) {
          if (res.error.includes('modificado por otro usuario')) setHadConflict(true)
          toast.error(res.error)
          return
        }
        toast.success('Promesa actualizada.')
        setIsEditing(false)
        router.refresh()
      } else {
        const res = await createPromesa({ ...form, monto_financiamiento: montoFinancCalc })
        if (res.error) { toast.error(res.error); return }
        toast.success('Promesa creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await deletePromesa(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.numero)
      if (res.error) { toast.error(res.error); return }
      toast.success('Promesa eliminada.')
      setDeleteTarget(null)
      router.refresh()
    })
  }

  // -- Export CSV -----------------------------------------------------------

  function exportCsv() {
    const keys = ['numero', ...colPrefs.filter((p) => p.visible && !NEVER_EXPORT.has(p.key)).map((p) => p.key)]
    const headers = keys.map((k) => COL_LABELS[k] ?? k)
    const rows = filtered.map((r) =>
      keys.map((k) => {
        if (k === 'empresa')  return empresaMap.get(r.empresa)   ?? r.empresa
        if (k === 'proyecto') return proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? r.proyecto
        if (k === 'fecha')    return fmtDate(r.fecha)
        if (k === 'fase')     return faseMap.get(`${r.empresa}-${r.proyecto}-${r.fase}`) ?? r.fase
        if (k === 'cliente')  return clienteMap.get(`${r.empresa}-${r.proyecto}-${r.cliente}`) ?? r.cliente
        if (k === 'vendedor') return vendedorMap.get(`${r.empresa}-${r.proyecto}-${r.vendedor}`) ?? r.vendedor
        return (r as Record<string, unknown>)[k] ?? ''
      })
    )
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `promesas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // -- Column manager helpers -----------------------------------------------

  function toggleCol(key: string) {
    setColPrefs((prev) => prev.map((p) => p.key === key ? { ...p, visible: !p.visible } : p))
  }
  function moveCol(key: string, dir: -1 | 1) {
    setColPrefs((prev) => {
      const idx = prev.findIndex((p) => p.key === key)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }
  function resetCols() { setColPrefs(DEFAULT_PREFS) }

  // -- Icon badge for modal header ------------------------------------------
  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100'   : 'bg-fuchsia-100'
  const iconColor   = isEditing && viewTarget ? 'text-amber-600' : 'text-fuchsia-600'
  const modalIcon   = isEditing && !viewTarget
    ? <Plus        className={`h-4 w-4 ${iconColor}`} />
    : isEditing
    ? <Pencil      className={`h-4 w-4 ${iconColor}`} />
    : <FileSignature className={`h-4 w-4 ${iconColor}`} />

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-fuchsia-100 p-2.5">
            <FileSignature className="h-5 w-5 text-fuchsia-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Promesas</h1>
            <p className="text-sm text-muted-foreground">Promesas de Compra-Venta</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
            <Plus className="h-4 w-4" />
            Nueva Promesa
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input variant="l-border"
              placeholder="Buscar promesas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={resetCols} />
        </div>
      </div>

      {/* Tabla */}
      <div
        ref={tableRef}
        className="rounded-xl border border-border/60 bg-card shadow-sm outline-none overflow-x-auto"
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
        onFocus={() => { if (cursorIdx === null && filtered.length > 0) setCursorIdx(page * PAGE_SIZE) }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Numero</span>
              </TableHead>
              {colPrefs.filter((p) => p.visible).map((pref) => {
                const col = ALL_COLUMNS.find((c) => c.key === pref.key)!
                const filterValues =
                  pref.key === 'empresa'  ? uniqueEmpresaNames  :
                  pref.key === 'proyecto' ? uniqueProyectoNames :
                  pref.key === 'fecha'    ? uniqueFechaVals     :
                  pref.key === 'fase'     ? uniqueFaseNames     :
                  pref.key === 'manzana'  ? uniqueManzanaVals   :
                  pref.key === 'lote'     ? uniqueLoteVals      :
                  pref.key === 'cliente'  ? uniqueClienteNames  :
                  pref.key === 'vendedor' ? uniqueVendedorNames : null
                return (
                  <TableHead key={pref.key} className="whitespace-nowrap">
                    {filterValues ? (
                      <ColumnFilter
                        label={col.label}
                        values={filterValues}
                        active={colFilters[pref.key] ?? new Set()}
                        onChange={(next) => setColFilter(pref.key, next)}
                      />
                    ) : <span className="text-xs font-medium text-muted-foreground">{col.label}</span>}
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-20 w-12 bg-muted/30" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colPrefs.filter((p) => p.visible).length + 2} className="py-16 text-center text-muted-foreground">
                  {search || hasActiveFilters
                    ? 'No se encontraron promesas con ese criterio.'
                    : 'Todavia no hay promesas. Haz clic en "Nueva Promesa" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row, rowIdx) => {
                const globalIdx = page * PAGE_SIZE + rowIdx
                const isActive = cursorIdx === globalIdx
                return (
                  <TableRow
                    key={`${row.empresa}-${row.proyecto}-${row.numero}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-fuchsia-50 dark:bg-fuchsia-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(globalIdx)}
                    onDoubleClick={() => openView(row)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-fuchsia-50 dark:bg-fuchsia-950/30 border-l-[3px] border-l-fuchsia-600 text-fuchsia-700 dark:text-fuchsia-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {row.numero}
                    </TableCell>
                    {colPrefs.filter((p) => p.visible).map((pref) => {
                      switch (pref.key) {
                        case 'empresa':
                          return <TableCell key="empresa"  className="whitespace-nowrap">{empresaMap.get(row.empresa)   ?? row.empresa}</TableCell>
                        case 'proyecto':
                          return <TableCell key="proyecto" className="whitespace-nowrap">{proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? row.proyecto}</TableCell>
                        case 'fecha':
                          return <TableCell key="fecha"    className="whitespace-nowrap tabular-nums">{fmtDate(row.fecha)}</TableCell>
                        case 'fase':
                          return <TableCell key="fase"     className="whitespace-nowrap">{faseMap.get(`${row.empresa}-${row.proyecto}-${row.fase}`) ?? row.fase}</TableCell>
                        case 'manzana':
                          return <TableCell key="manzana">{row.manzana}</TableCell>
                        case 'lote':
                          return <TableCell key="lote" className="font-mono text-xs">{row.lote}</TableCell>
                        case 'cliente':
                          return <TableCell key="cliente"  className="whitespace-nowrap">{clienteMap.get(`${row.empresa}-${row.proyecto}-${row.cliente}`) ?? row.cliente}</TableCell>
                        case 'vendedor':
                          return <TableCell key="vendedor" className="whitespace-nowrap">{vendedorMap.get(`${row.empresa}-${row.proyecto}-${row.vendedor}`) ?? row.vendedor}</TableCell>
                        default: {
                          const cellVal = (row as Record<string, unknown>)[pref.key]
                          return <TableCell key={pref.key}>{cellVal != null ? String(cellVal) : '\u2014'}</TableCell>
                        }
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-fuchsia-50 dark:bg-fuchsia-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(row)}>
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(row)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row)}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length > 0
            ? `${page * PAGE_SIZE + 1}\u2013${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} promesa${filtered.length !== 1 ? 's' : ''}`
            : '0 promesas'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="PÃ¡gina anterior" disabled={page === 0}
              onClick={() => { setPage((p) => p - 1); setCursorIdx(null) }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">{page + 1} / {totalPages}</span>
            <button type="button" aria-label="PÃ¡gina siguiente" disabled={page >= totalPages - 1}
              onClick={() => { setPage((p) => p + 1); setCursorIdx(null) }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Dialog crear / ver / editar */}
      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[64rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-fuchsia-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{modalIcon}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nueva Promesa' : isEditing ? 'Editar Promesa' : `Promesa ${viewTarget?.numero}`}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[empresaMap.get(viewTarget.empresa), proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`)].filter(Boolean).join(' Â· ')}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-0.5 flex flex-col flex-1 min-h-0">
            <div className="shrink-0 w-full"><TabsList variant="line" className="">
              <TabsTrigger value="general" className="gap-1.5 px-3 rounded-none bg-transparent border-b-2 border-b-transparent after:hidden data-active:border-b-primary data-active:text-primary">
                <FileSignature className="h-3.5 w-3.5" /> General
              </TabsTrigger>
            </TabsList></div>

            {/* Tab General */}
            <TabsContent value="general" className="mt-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">

              {/* View mode */}
              {!isEditing && viewTarget ? (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2"><ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)   ?? ''} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''} /></div>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <ViewField label="Numero" value={String(viewTarget.numero)} />
                  </div>
                  <SectionDivider label="GENERAL" />
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <ViewField label="Referencia" value={viewTarget.referencia} />
                    <div />
                    <ViewField label="Fecha"      value={fmtDate(viewTarget.fecha)} />
                  </div>
                  <div className="col-span-2"><ViewField label="Cliente"  value={clienteMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.cliente}`)  ?? ''} /></div>
                  <div className="col-span-2"><ViewField label="Vendedor" value={vendedorMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.vendedor}`) ?? ''} /></div>
                  <ViewField label="Es Venta" value={viewTarget.venta === 1 ? 'SÃ­' : 'No'} />
                  <SectionDivider label="LOTE" />
                  <div className="col-span-2 grid grid-cols-4 gap-2">
                    <div className="col-span-2"><ViewField label="Fase"    value={faseMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.fase}`) ?? ''} /></div>
                    <ViewField label="Manzana" value={viewTarget.manzana} />
                    <ViewField label="Lote"    value={viewTarget.lote} />
                  </div>
                  <ViewField label="Extension"       value={loteActivoVista ? `${loteActivoVista.extension} ${medidaVista}`.trim() : ''} />
                  <ViewField label="Precio de venta" value={viewTarget.moneda ? `${viewTarget.moneda} ${fmtNum(viewTarget.valor_lote)}` : ''} />
                  </div>
                  <div className="w-px self-stretch bg-primary/30" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SectionDivider label="ENGANCHE" />
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <ViewField label="Monto"  value={viewTarget.monto_enganche  ? `${viewTarget.moneda} ${fmtNum(viewTarget.monto_enganche)}`  : ''} />
                      <ViewField label="Plazo"  value={viewTarget.plazo_enganche  ? String(viewTarget.plazo_enganche)  : ''} />
                    </div>
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <ViewField label="1er Pago"    value={viewTarget.primer_enganche ? `${viewTarget.moneda} ${fmtNum(viewTarget.primer_enganche)}` : ''} />
                      <ViewField label="Cuotas"      value={engancheCalcVista.cuotas      ? String(engancheCalcVista.cuotas)     : ''} />
                      <ViewField label="Monto Cuota" value={engancheCalcVista.montoCuota  ? fmtNum(engancheCalcVista.montoCuota)  : ''} />
                      <ViewField label="Ultima Cuota" value={engancheCalcVista.ultimaCuota ? fmtNum(engancheCalcVista.ultimaCuota) : ''} />
                    </div>
                    <div className="col-span-2">
                      <ViewField label="Mora" value={viewTarget.mora_enganche === 1 ? 'SÃ­' : 'No'} />
                    </div>
                    <SectionDivider label="FINANCIAMIENTO" />
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <ViewField label="Forma Calculo" value={FORMAS_CALCULO[viewTarget.forma_financiamiento] ?? `#${viewTarget.forma_financiamiento}`} />
                      </div>
                      <ViewField label="Interes Anual (%)"    value={viewTarget.interes_anual    ? fmtNum(viewTarget.interes_anual)              : ''} />
                      <ViewField label="1era Cuota" value={fmtDate(viewTarget.fecha_financiamiento)} />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <ViewField label="Monto Financiamiento" value={viewTarget.monto_financiamiento ? `${viewTarget.moneda} ${fmtNum(viewTarget.monto_financiamiento)}` : ''} />
                      <ViewField label="Plazo"                value={viewTarget.plazo_financiamiento ? String(viewTarget.plazo_financiamiento) : ''} />
                    </div>
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <ViewField label="Cuotas"       value={financiamientoCalcVista.cuotas      ? String(financiamientoCalcVista.cuotas)     : ''} />
                      <ViewField label="Monto Cuota"  value={financiamientoCalcVista.montoCuota  ? fmtNum(financiamientoCalcVista.montoCuota)  : ''} />
                      <ViewField label="Ultima Cuota" value={financiamientoCalcVista.ultimaCuota ? fmtNum(financiamientoCalcVista.ultimaCuota) : ''} />
                    </div>
                    <SectionDivider label="MORA" />
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <ViewField label="Forma Calculo" value={viewTarget.forma_mora === 1 ? 'Diario' : 'Mensual'} />
                    </div>
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <ViewField label="Tipo Calculo"  value={tipoCalculo === 1 ? 'Valor Fijo' : 'Tasa'} />
                      {tipoCalculo === 0
                        ? <ViewField label="Tasa (%)" value={viewTarget.interes_mora ? fmtNum(viewTarget.interes_mora) : ''} />
                        : <ViewField label="Monto"    value={viewTarget.fijo_mora    ? fmtNum(viewTarget.fijo_mora)    : ''} />
                      }
                      <ViewField label="Dias Gracia"  value={viewTarget.dias_gracia ? String(viewTarget.dias_gracia) : ''} />
                      <ViewField label="Dias Afectos" value={viewTarget.dias_afectos === 1 ? 'Un Mes' : 'Todos Los Dias'} />
                    </div>
                    <SectionDivider label="OTROS" />
                    <div className="col-span-2 grid gap-1.5">
                      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>Observacion</span>
                      <div className="min-h-[2.5rem] flex items-start rounded-none bg-transparent border-0 border-b border-primary/50 px-3 py-2">
                        <span className="font-medium text-foreground whitespace-pre-wrap" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{viewTarget.observacion || ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

              /* Edit mode */
              ) : isEditing && viewTarget ? (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2 grid gap-1">
                    <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Empresa</Label>
                    <Select value={String(form.empresa)} disabled>
                      <SelectTrigger variant="l-border" className="w-full">
                        <SelectValue>
                          {(v: string) => v && v !== '0' ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Proyecto</Label>
                    <Select value={String(form.proyecto)} disabled>
                      <SelectTrigger variant="l-border" className="w-full">
                        <SelectValue>
                          {(v: string) => v && v !== '0' ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectos.filter((p) => p.empresa === form.empresa).map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <ViewField label="Numero" value={String(viewTarget.numero)} />
                  </div>
                  <SectionDivider label="GENERAL" />
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <ViewField label="Referencia" value={viewTarget.referencia} />
                    <div />
                    <ViewField label="Fecha"      value={fmtDate(viewTarget.fecha)} />
                  </div>
                  <div className="col-span-2"><ViewField label="Cliente"  value={clienteMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.cliente}`)  ?? ''} /></div>
                  <div className="col-span-2"><ViewField label="Vendedor" value={vendedorMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.vendedor}`) ?? ''} /></div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <Checkbox id="es-venta-edit" checked={viewTarget.venta === 1} disabled />
                    <Label htmlFor="es-venta-edit" className="font-semibold tracking-wider text-muted-foreground cursor-pointer" style={{ fontSize: 'var(--ui-form-label)' }}>Es Venta</Label>
                  </div>
                  <SectionDivider label="LOTE" />
                  <div className="col-span-2 grid grid-cols-4 gap-2">
                    <div className="col-span-2"><ViewField label="Fase"    value={faseMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}-${viewTarget.fase}`) ?? ''} /></div>
                    <ViewField label="Manzana" value={viewTarget.manzana} />
                    <ViewField label="Lote"    value={viewTarget.lote} />
                  </div>
                  <ViewField label="Extension"       value={loteActivoVista ? `${loteActivoVista.extension} ${medidaVista}`.trim() : ''} />
                  <ViewField label="Precio de venta" value={viewTarget.moneda ? `${viewTarget.moneda} ${fmtNum(viewTarget.valor_lote)}` : ''} />
                  </div>
                  <div className="w-px self-stretch bg-primary/30" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SectionDivider label="ENGANCHE" />
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <ViewField label="Monto"  value={viewTarget.monto_enganche  ? `${viewTarget.moneda} ${fmtNum(viewTarget.monto_enganche)}`  : ''} />
                      <ViewField label="Plazo"  value={viewTarget.plazo_enganche  ? String(viewTarget.plazo_enganche)  : ''} />
                    </div>
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <ViewField label="1er Pago"    value={viewTarget.primer_enganche ? `${viewTarget.moneda} ${fmtNum(viewTarget.primer_enganche)}` : ''} />
                      <ViewField label="Cuotas"      value={engancheCalcVista.cuotas      ? String(engancheCalcVista.cuotas)     : ''} />
                      <ViewField label="Monto Cuota" value={engancheCalcVista.montoCuota  ? fmtNum(engancheCalcVista.montoCuota)  : ''} />
                      <ViewField label="Ultima Cuota" value={engancheCalcVista.ultimaCuota ? fmtNum(engancheCalcVista.ultimaCuota) : ''} />
                    </div>
                    <div className="col-span-2">
                      <ViewField label="Mora" value={viewTarget.mora_enganche === 1 ? 'SÃ­' : 'No'} />
                    </div>
                    <SectionDivider label="FINANCIAMIENTO" />
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <ViewField label="Forma Calculo" value={FORMAS_CALCULO[viewTarget.forma_financiamiento] ?? `#${viewTarget.forma_financiamiento}`} />
                      </div>
                      <ViewField label="Interes Anual (%)"    value={viewTarget.interes_anual    ? fmtNum(viewTarget.interes_anual)              : ''} />
                      <ViewField label="1era Cuota" value={fmtDate(viewTarget.fecha_financiamiento)} />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <ViewField label="Monto Financiamiento" value={viewTarget.monto_financiamiento ? `${viewTarget.moneda} ${fmtNum(viewTarget.monto_financiamiento)}` : ''} />
                      <ViewField label="Plazo"                value={viewTarget.plazo_financiamiento ? String(viewTarget.plazo_financiamiento) : ''} />
                    </div>
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <ViewField label="Cuotas"       value={financiamientoCalcVista.cuotas      ? String(financiamientoCalcVista.cuotas)     : ''} />
                      <ViewField label="Monto Cuota"  value={financiamientoCalcVista.montoCuota  ? fmtNum(financiamientoCalcVista.montoCuota)  : ''} />
                      <ViewField label="Ultima Cuota" value={financiamientoCalcVista.ultimaCuota ? fmtNum(financiamientoCalcVista.ultimaCuota) : ''} />
                    </div>
                    <SectionDivider label="MORA" />
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <ViewField label="Forma Calculo" value={viewTarget.forma_mora === 1 ? 'Diario' : 'Mensual'} />
                    </div>
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <ViewField label="Tipo Calculo"  value={tipoCalculo === 1 ? 'Valor Fijo' : 'Tasa'} />
                      {tipoCalculo === 0
                        ? <ViewField label="Tasa (%)" value={viewTarget.interes_mora ? fmtNum(viewTarget.interes_mora) : ''} />
                        : <ViewField label="Monto"    value={viewTarget.fijo_mora    ? fmtNum(viewTarget.fijo_mora)    : ''} />
                      }
                      <ViewField label="Dias Gracia"  value={viewTarget.dias_gracia ? String(viewTarget.dias_gracia) : ''} />
                      <ViewField label="Dias Afectos" value={viewTarget.dias_afectos === 1 ? 'Un Mes' : 'Todos Los Dias'} />
                    </div>
                    <SectionDivider label="OTROS" />
                    <div className="col-span-2 grid gap-1">
                      <Label htmlFor="observacion-edit" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Observacion</Label>
                      <textarea
                        id="observacion-edit"
                        value={form.observacion ?? ''}
                        onChange={(e) => f('observacion', e.target.value)}
                        placeholder="Observaciones"
                        rows={2}
                        style={{ fontSize: 'var(--ui-input)' }}
                        className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      />
                    </div>
                  </div>
                </div>

              /* Create mode */
              ) : (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2 grid gap-1">
                    <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Empresa</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                      <SelectTrigger variant="l-border" className="w-full">
                        <SelectValue placeholder="Selecciona empresa">
                          {(v: string) => v && v !== '0' ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Proyecto</Label>
                    <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                      <SelectTrigger variant="l-border" className="w-full">
                        <SelectValue placeholder="Selecciona proyecto">
                          {(v: string) => v && v !== '0' ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Numero</Label>
                      <Input variant="l-border"
                        type="number"
                        min={1}
                        step={1}
                        value={form.numero === 0 ? '' : form.numero}
                        onChange={(e) => setForm((prev) => ({ ...prev, numero: Number(e.target.value) || 0 }))}
                        placeholder={proyectoActivo?.promesa_correlativo === 1 ? 'Asignado automáticamente' : 'Ej: 1001'}
                        disabled={proyectoActivo?.promesa_correlativo === 1}
                      />
                      {proyectoActivo?.promesa_correlativo === 1 && (
                        <p className="text-[11px] text-muted-foreground">El sistema asigna el número automáticamente.</p>
                      )}
                    </div>
                  </div>
                  <SectionDivider label="GENERAL" />
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Referencia</Label>
                      <Input variant="l-border"
                        value={form.referencia}
                        onChange={(e) => f('referencia', e.target.value)}
                        placeholder="No. de contrato o referencia"
                      />
                    </div>
                    <div />
                    <div className="grid gap-1">
                      <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Fecha</Label>
                      <Input variant="l-border"
                        type="date"
                        value={form.fecha}
                        onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Cliente</Label>
                    <ClienteCombobox
                      clientes={clientesFiltrados}
                      value={form.cliente}
                      onChange={(v) => setForm((prev) => ({ ...prev, cliente: v }))}
                      placeholder="Selecciona cliente..."
                    />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Vendedor</Label>
                    <Select value={String(form.vendedor)} onValueChange={(v) => setForm((prev) => ({ ...prev, vendedor: Number(v) }))}>
                      <SelectTrigger variant="l-border" className="w-full">
                        <SelectValue placeholder="Selecciona vendedor">
                          {(v: string) => v && v !== '0' ? (vendedorMap.get(`${form.empresa}-${form.proyecto}-${Number(v)}`) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {vendedoresFiltrados.map((ven) => <SelectItem key={ven.codigo} value={String(ven.codigo)}>{ven.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <Checkbox
                      id="es-venta"
                      checked={form.venta === 1}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, venta: checked === true ? 1 : 0 }))}
                    />
                    <Label htmlFor="es-venta" className="font-semibold tracking-wider text-muted-foreground cursor-pointer" style={{ fontSize: 'var(--ui-form-label)' }}>Es Venta</Label>
                  </div>
                  <SectionDivider label="LOTE" />
                  <div className="col-span-2 grid grid-cols-4 gap-2">
                    <div className="col-span-2 grid gap-1">
                      <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Fase</Label>
                      <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))}>
                        <SelectTrigger variant="l-border" className="w-full">
                          <SelectValue placeholder="Selecciona fase">
                            {(v: string) => v && v !== '0' ? (faseMap.get(`${form.empresa}-${form.proyecto}-${Number(v)}`) ?? v) : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {fasesFiltradas.map((fa) => <SelectItem key={fa.codigo} value={String(fa.codigo)}>{fa.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1"> {/* Manzana â€” 1/4 */}
                      <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Manzana</Label>
                      <Select value={form.manzana} onValueChange={(v) => f('manzana', v)}>
                        <SelectTrigger variant="l-border" className="w-full">
                          <SelectValue placeholder="Selecciona manzana">
                            {(v: string) => v || null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {manzanasFiltradas.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Lote</Label>
                      <Select value={form.lote} onValueChange={(v) => f('lote', v)}>
                        <SelectTrigger variant="l-border" className="w-full">
                          <SelectValue placeholder="Selecciona lote">
                            {(v: string) => v || null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {lotesFiltrados.map((l) => <SelectItem key={l.codigo} value={l.codigo}>{l.codigo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <ViewField label="Extension"       value={loteActivoForm ? `${loteActivoForm.extension} ${medidaForm}`.trim() : ''} />
                  <ViewField label="Precio de venta" value={form.moneda ? `${form.moneda} ${fmtNum(form.valor_lote)}` : ''} />
                  </div>
                  <div className="w-px self-stretch bg-primary/30" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SectionDivider label="ENGANCHE" />
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Monto</Label>
                        <Input variant="l-border"
                          type="number" min={0} step={0.01}
                          value={form.monto_enganche || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, monto_enganche: Number(e.target.value) || 0 }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Plazo</Label>
                        <Input variant="l-border"
                          type="number" min={0} step={1}
                          value={form.plazo_enganche || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, plazo_enganche: Number(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <div className="grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>1er Pago</Label>
                        <Input variant="l-border"
                          type="number" min={0} step={0.01}
                          value={form.primer_enganche || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, primer_enganche: Number(e.target.value) || 0 }))}
                          placeholder="0.00"
                        />
                      </div>
                      <ViewField label="Cuotas"      value={engancheCalcForm.cuotas      ? String(engancheCalcForm.cuotas)     : ''} />
                      <ViewField label="Monto Cuota" value={engancheCalcForm.montoCuota  ? fmtNum(engancheCalcForm.montoCuota)  : ''} />
                      <ViewField label="Ultima Cuota" value={engancheCalcForm.ultimaCuota ? fmtNum(engancheCalcForm.ultimaCuota) : ''} />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        id="mora-enganche"
                        checked={form.mora_enganche === 1}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, mora_enganche: checked === true ? 1 : 0 }))}
                      />
                      <Label htmlFor="mora-enganche" className="font-semibold tracking-wider text-muted-foreground cursor-pointer" style={{ fontSize: 'var(--ui-form-label)' }}>Mora</Label>
                    </div>
                    <SectionDivider label="FINANCIAMIENTO" />
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <div className="col-span-2 grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Forma Calculo</Label>
                        <Select value={String(form.forma_financiamiento)} onValueChange={(v) => setForm((prev) => ({ ...prev, forma_financiamiento: Number(v) }))}>
                          <SelectTrigger variant="l-border" className="w-full">
                            <SelectValue placeholder="Selecciona forma de calculo">
                              {(v: string) => v ? (FORMAS_CALCULO[Number(v)] ?? v) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(FORMAS_CALCULO).map(([k, label]) => (
                              <SelectItem key={k} value={k}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Interes Anual (%)</Label>
                        <Input variant="l-border"
                          type="number" min={0} step={0.01}
                          value={form.interes_anual || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, interes_anual: Number(e.target.value) || 0 }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>1era Cuota</Label>
                        <Input variant="l-border"
                          type="date"
                          value={form.fecha_financiamiento ?? ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, fecha_financiamiento: e.target.value || null }))}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <ViewField label="Monto Financiamiento" value={montoFinancCalc ? `${form.moneda} ${fmtNum(montoFinancCalc)}` : ''} />
                      <div className="grid gap-1">
                        <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Plazo</Label>
                        <Input variant="l-border"
                          type="number" min={0} step={1}
                          value={form.plazo_financiamiento || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, plazo_financiamiento: Number(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <ViewField label="Cuotas"       value={financiamientoCalcForm.cuotas      ? String(financiamientoCalcForm.cuotas)     : ''} />
                      <ViewField label="Monto Cuota"  value={financiamientoCalcForm.montoCuota  ? fmtNum(financiamientoCalcForm.montoCuota)  : ''} />
                      <ViewField label="Ultima Cuota" value={financiamientoCalcForm.ultimaCuota ? fmtNum(financiamientoCalcForm.ultimaCuota) : ''} />
                    </div>
                    <SectionDivider label="MORA" />
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <div className="grid gap-1">
                        <Label className={`font-semibold tracking-wider whitespace-nowrap${!moraEditable ? ' text-muted-foreground' : ''}`} style={{ fontSize: 'var(--ui-form-label)' }}>Forma Calculo</Label>
                        <Select value={String(form.forma_mora)} onValueChange={(v) => setForm((prev) => ({ ...prev, forma_mora: Number(v) }))} disabled={!moraEditable}>
                          <SelectTrigger variant="l-border" className="w-full">
                            <SelectValue>{(v: string) => v === '1' ? 'Diario' : 'Mensual'}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Mensual</SelectItem>
                            <SelectItem value="1">Diario</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-4 gap-2">
                      <div className="grid gap-1">
                        <Label className={`font-semibold tracking-wider whitespace-nowrap${!moraEditable ? ' text-muted-foreground' : ''}`} style={{ fontSize: 'var(--ui-form-label)' }}>Tipo Calculo</Label>
                        <Select
                          value={String(tipoCalculo)}
                          onValueChange={(v) => {
                            const next = Number(v)
                            setTipoCalculo(next)
                            if (next === 0) setForm((prev) => ({ ...prev, fijo_mora: 0 }))
                            else setForm((prev) => ({ ...prev, interes_mora: 0 }))
                          }}
                          disabled={!moraEditable}
                        >
                          <SelectTrigger variant="l-border" className="w-full">
                            <SelectValue>{(v: string) => v === '1' ? 'Valor Fijo' : 'Tasa'}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Tasa</SelectItem>
                            <SelectItem value="1">Valor Fijo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {tipoCalculo === 0 ? (
                        <div className="grid gap-1">
                          <Label className={`font-semibold tracking-wider whitespace-nowrap${!moraEditable ? ' text-muted-foreground' : ''}`} style={{ fontSize: 'var(--ui-form-label)' }}>Tasa (%)</Label>
                          <Input variant="l-border" type="number" step="0.01" value={form.interes_mora || ''} onChange={(e) => setForm((prev) => ({ ...prev, interes_mora: Number(e.target.value) || 0 }))} disabled={!moraEditable} placeholder="0.00" />
                        </div>
                      ) : (
                        <div className="grid gap-1">
                          <Label className={`font-semibold tracking-wider whitespace-nowrap${!moraEditable ? ' text-muted-foreground' : ''}`} style={{ fontSize: 'var(--ui-form-label)' }}>Monto</Label>
                          <Input variant="l-border" type="number" step="0.01" value={form.fijo_mora || ''} onChange={(e) => setForm((prev) => ({ ...prev, fijo_mora: Number(e.target.value) || 0 }))} disabled={!moraEditable} placeholder="0.00" />
                        </div>
                      )}
                      <div className="grid gap-1">
                        <Label className={`font-semibold tracking-wider whitespace-nowrap${!moraEditable ? ' text-muted-foreground' : ''}`} style={{ fontSize: 'var(--ui-form-label)' }}>Dias Gracia</Label>
                        <Input variant="l-border" type="number" value={form.dias_gracia || ''} onChange={(e) => setForm((prev) => ({ ...prev, dias_gracia: Number(e.target.value) || 0 }))} disabled={!moraEditable} placeholder="0" />
                      </div>
                      <div className="grid gap-1">
                        <Label className={`font-semibold tracking-wider whitespace-nowrap${!moraEditable ? ' text-muted-foreground' : ''}`} style={{ fontSize: 'var(--ui-form-label)' }}>Dias Afectos</Label>
                        <Select value={String(form.dias_afectos ?? 0)} onValueChange={(v) => setForm((prev) => ({ ...prev, dias_afectos: Number(v) }))} disabled={!moraEditable}>
                          <SelectTrigger variant="l-border" className="w-full">
                            <SelectValue>{(v: string) => v === '1' ? 'Un Mes' : 'Todos Los Dias'}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Todos Los Dias</SelectItem>
                            <SelectItem value="1">Un Mes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <SectionDivider label="OTROS" />
                    <div className="col-span-2 grid gap-1">
                      <Label htmlFor="observacion-create" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Observacion</Label>
                      <textarea
                        id="observacion-create"
                        value={form.observacion ?? ''}
                        onChange={(e) => f('observacion', e.target.value)}
                        placeholder="Observaciones"
                        rows={2}
                        style={{ fontSize: 'var(--ui-input)' }}
                        className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="-mx-4 -mb-4 px-5 py-3 bg-muted/30 border-t border-border/50 shrink-0">
            {!isEditing ? (
              <div className="flex w-full items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setAuditTarget(viewTarget)}>
                  <History className="mr-1.5 h-3.5 w-3.5" /> Historial
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                  {puedeModificar && (
                    <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white" onClick={startEdit}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex w-full justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit} disabled={isPending}>Cancelar</Button>
                <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white" onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Â¿Eliminar promesa?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Se eliminarÃ¡ la promesa <strong>{deleteTarget?.numero}</strong> del proyecto{' '}
              <strong>{proyectoMap.get(`${deleteTarget?.empresa}-${deleteTarget?.proyecto}`) ?? ''}</strong>.
              Esta acciÃ³n no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit log */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_promesa"
          cuenta={auditTarget.cuenta}
          registroId={{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, numero: auditTarget.numero }}
          titulo={String(auditTarget.numero)}
        />
      )}
    </div>
  )
}
