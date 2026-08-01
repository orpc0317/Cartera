'use client'

import { useState, useMemo, useRef, useCallback, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ReceiptText, Search, X, Settings2, Download, Filter,
  ChevronDown, ChevronUp, MoreHorizontal, Eye, History,
  ChevronLeft, ChevronRight, Info, ListOrdered, Loader2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { getRecibosCaja, getReciboCajaExtra } from '@/app/actions/pagos'
import type { ReciboCaja, ReciboCajaDetalleExtra, PagosFiltros } from '@/lib/types/pagos'
import type {
  Empresa, Proyecto, Cliente, Cobrador, Banco, CuentaBancaria, SerieRecibo,
} from '@/lib/types/proyectos'

// ─── Catálogos hardcoded ────────────────────────────────────────────────────

const FORMAS_PAGO: Record<number, string> = {
  1: 'Efectivo',
  2: 'Cheque',
  3: 'Deposito',
  4: 'Transferencia',
}

const TIPOS_CUOTA: Record<number, string> = {
  1: 'Enganche',
  2: 'Financiamiento',
}

const TIPOS_TRANSACCION_BANCARIA: Record<number, string> = {
  1: 'Cheque',
  2: 'Deposito',
  3: 'Nota Debito',
  4: 'Nota Credito',
  5: 'Transferencia',
}

const ESTADOS_RECIBO: Record<number, { label: string; cls: string }> = {
  1:  { label: 'Activo',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  99: { label: 'Anulado', cls: 'bg-red-100    text-red-700    border-red-200'    },
}

// Catalogo de monedas (ISO -> pais para bandera) — mismo patron que Reservas/Lotes
const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(d: string): string {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function tipoTransaccion(r: ReciboCaja): 'Reserva' | 'Pago Cuotas' | 'Otros' {
  if (r.reserva > 0) return 'Reserva'
  if (r.promesa > 0) return 'Pago Cuotas'
  return 'Otros'
}

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

// ─── Subcomponentes ────────────────────────────────────────────────────────

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
                <button type="button" disabled={i === 0} onClick={() => onMove(pref.key, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Columnas ───────────────────────────────────────────────────────────────

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }
type ColFilters = Record<string, Set<string>>

const ALL_COLUMNS: ColDef[] = [
  { key: 'fecha',        label: 'Fecha',        defaultVisible: true  },
  { key: '__empresa',    label: 'Empresa',      defaultVisible: true  },
  { key: '__proyecto',   label: 'Proyecto',     defaultVisible: true  },
  { key: '__cliente',    label: 'Cliente',      defaultVisible: true  },
  { key: '__tipo',       label: 'Tipo',         defaultVisible: true  },
  { key: '__forma_pago', label: 'Forma Pago',   defaultVisible: true  },
  { key: 'moneda',       label: 'Moneda',       defaultVisible: true  },
  { key: 'monto',        label: 'Monto',        defaultVisible: true  },
  { key: '__estado',     label: 'Estado',       defaultVisible: true  },
  { key: 'promesa',      label: 'Promesa',      defaultVisible: true  },
  { key: '__cobrador',   label: 'Cobrador',     defaultVisible: false },
  { key: 'agrego_fecha', label: 'Fecha Agrego', defaultVisible: false },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  initialData:          ReciboCaja[]
  initialLimitReached:  boolean
  empresas:             Empresa[]
  proyectos:            Proyecto[]
  clientes:             Cliente[]
  cobradores:           Cobrador[]
  bancos:               Banco[]
  cuentasBancarias:     CuentaBancaria[]
  seriesRecibos:        SerieRecibo[]
  userId:               string
}

// ─── Componente ─────────────────────────────────────────────────────

export function PagosClient({
  initialData, initialLimitReached, empresas, proyectos, clientes, cobradores, bancos, cuentasBancarias, seriesRecibos, userId,
}: Props) {
  // ── Datos cargados (reemplazados al aplicar filtros) ──
  const [data, setData] = useState<ReciboCaja[]>(initialData)
  const [limitReached, setLimitReached] = useState(initialLimitReached)
  const [isPendingFiltros, startFiltrosTransition] = useTransition()

  // ── Búsqueda + filtros de columna (sobre lo ya cargado) ──
  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})

  // ── Panel de filtros server-side ──
  const [panelOpen, setPanelOpen] = useState(false)
  const [filtroEmpresa, setFiltroEmpresa]         = useState<number>(0)
  const [filtroProyectoKey, setFiltroProyectoKey] = useState('') // `${empresa}-${codigo}`
  const [filtroFechaDesde, setFiltroFechaDesde]   = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta]   = useState('')
  const [filtroAgregoDesde, setFiltroAgregoDesde] = useState('')
  const [filtroAgregoHasta, setFiltroAgregoHasta] = useState('')
  const [filtroPromesa, setFiltroPromesa]         = useState('')
  const [filtroCliente, setFiltroCliente]         = useState('')
  const [filtroCuentaDeposito, setFiltroCuentaDeposito] = useState<number | ''>('')
  const [filtroFormaPago, setFiltroFormaPago]           = useState<number | ''>('')
  const [filtroNumeroDocumento, setFiltroNumeroDocumento] = useState('')
  const [filtroSerie, setFiltroSerie]             = useState('')
  const [filtroNumeroDesde, setFiltroNumeroDesde] = useState('')
  const [filtroNumeroHasta, setFiltroNumeroHasta] = useState('')

  // Clave de persistencia de sesion (sessionStorage: se olvida al cerrar la pestaña/navegador,
  // a diferencia de colPrefs que usa localStorage porque debe sobrevivir entre sesiones).
  const FILTROS_STORAGE_KEY = `pagos_filtros_v1_${userId}`

  // ── Inicializacion en mount: restaura los filtros de la ultima busqueda de la
  // sesion activa (sessionStorage) o, si no hay ninguna, aplica el default: primera
  // empresa/proyecto + agrego_fecha = hoy. El default queda representado como un
  // valor real del filtro (visible/editable en el panel) en vez de una regla oculta
  // en el servidor. ──
  useEffect(() => {
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
    const hoy = new Date().toISOString().slice(0, 10)

    try {
      const raw = sessionStorage.getItem(FILTROS_STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Record<string, unknown>
        setFiltroEmpresa(typeof p.filtroEmpresa === 'number' ? p.filtroEmpresa : firstEmpresa)
        setFiltroProyectoKey(typeof p.filtroProyectoKey === 'string' ? p.filtroProyectoKey : (firstProyecto ? `${firstEmpresa}-${firstProyecto}` : ''))
        setFiltroFechaDesde(typeof p.filtroFechaDesde === 'string' ? p.filtroFechaDesde : '')
        setFiltroFechaHasta(typeof p.filtroFechaHasta === 'string' ? p.filtroFechaHasta : '')
        setFiltroAgregoDesde(typeof p.filtroAgregoDesde === 'string' ? p.filtroAgregoDesde : hoy)
        setFiltroAgregoHasta(typeof p.filtroAgregoHasta === 'string' ? p.filtroAgregoHasta : '')
        setFiltroPromesa(typeof p.filtroPromesa === 'string' ? p.filtroPromesa : '')
        setFiltroCliente(typeof p.filtroCliente === 'string' ? p.filtroCliente : '')
        setFiltroCuentaDeposito(typeof p.filtroCuentaDeposito === 'number' ? p.filtroCuentaDeposito : '')
        setFiltroFormaPago(typeof p.filtroFormaPago === 'number' ? p.filtroFormaPago : '')
        setFiltroNumeroDocumento(typeof p.filtroNumeroDocumento === 'string' ? p.filtroNumeroDocumento : '')
        setFiltroSerie(typeof p.filtroSerie === 'string' ? p.filtroSerie : '')
        setFiltroNumeroDesde(typeof p.filtroNumeroDesde === 'string' ? p.filtroNumeroDesde : '')
        setFiltroNumeroHasta(typeof p.filtroNumeroHasta === 'string' ? p.filtroNumeroHasta : '')
        return
      }
    } catch { /* ignore */ }

    setFiltroEmpresa(firstEmpresa)
    setFiltroProyectoKey(firstProyecto ? `${firstEmpresa}-${firstProyecto}` : '')
    setFiltroAgregoDesde(hoy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function guardarFiltrosSesion() {
    try {
      sessionStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify({
        filtroEmpresa, filtroProyectoKey, filtroFechaDesde, filtroFechaHasta,
        filtroAgregoDesde, filtroAgregoHasta, filtroPromesa, filtroCliente,
        filtroCuentaDeposito, filtroFormaPago, filtroNumeroDocumento, filtroSerie,
        filtroNumeroDesde, filtroNumeroHasta,
      }))
    } catch { /* quota */ }
  }

  function onFiltroEmpresaChange(val: string | null) {
    const emp       = Number(val ?? 0)
    const firstProy = proyectos.filter((p) => p.empresa === emp)[0]?.codigo ?? 0
    setFiltroEmpresa(emp)
    setFiltroProyectoKey(firstProy ? `${emp}-${firstProy}` : '')
    setFiltroCuentaDeposito('')
    setFiltroSerie('')
  }

  function onFiltroProyectoChange(val: string | null) {
    setFiltroProyectoKey(val ?? '')
    setFiltroCuentaDeposito('')
    setFiltroSerie('')
  }

  // Cierto solo mientras el usuario no haya tocado nada mas alla del default
  // precargado (agrego_fecha = hoy) — controla el aviso informativo del panel.
  const usandoFiltroPorDefecto =
    filtroAgregoDesde === new Date().toISOString().slice(0, 10) && !filtroAgregoHasta &&
    !filtroFechaDesde && !filtroFechaHasta &&
    !filtroPromesa && !filtroCliente &&
    !filtroNumeroDesde && !filtroNumeroHasta

  // ── Modal Ver ──
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [viewTarget, setViewTarget]   = useState<ReciboCaja | null>(null)
  const [extra, setExtra]             = useState<ReciboCajaDetalleExtra | null>(null)
  const [isPendingExtra, startExtraTransition] = useTransition()
  const [auditTarget, setAuditTarget] = useState<ReciboCaja | null>(null)

  // ── Lookup maps ──
  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const clienteMap  = useMemo(() => new Map(clientes.map((c) => [`${c.empresa}-${c.proyecto}-${c.codigo}`, c.nombre])), [clientes])
  const cobradorMap = useMemo(() => new Map(cobradores.map((c) => [`${c.empresa}-${c.proyecto}-${c.codigo}`, c.nombre])), [cobradores])
  const bancoMap    = useMemo(() => new Map(bancos.map((b) => [`${b.empresa}-${b.proyecto}-${b.codigo}`, b.nombre])), [bancos])
  const cuentaBancariaObjMap = useMemo(() => new Map(cuentasBancarias.map((c) => [c.codigo, c])), [cuentasBancarias])

  function empresaNombre(r: ReciboCaja)  { return empresaMap.get(r.empresa) ?? `#${r.empresa}` }
  function proyectoNombre(r: ReciboCaja) { return proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? `#${r.proyecto}` }
  function clienteNombre(r: ReciboCaja)  { return clienteMap.get(`${r.empresa}-${r.proyecto}-${r.cliente}`) ?? `#${r.cliente}` }
  function cobradorNombre(r: ReciboCaja) { return r.cobrador ? (cobradorMap.get(`${r.empresa}-${r.proyecto}-${r.cobrador}`) ?? `#${r.cobrador}`) : '' }
  function bancoNombre(r: ReciboCaja)    { return r.banco ? (bancoMap.get(`${r.empresa}-${r.proyecto}-${r.banco}`) ?? `#${r.banco}`) : '' }
  function cuentaDepositoDisplay(r: ReciboCaja): string {
    if (!r.cuenta_deposito) return ''
    const cb = cuentaBancariaObjMap.get(r.cuenta_deposito)
    if (!cb) return `#${r.cuenta_deposito}`
    const banco = bancoMap.get(`${cb.empresa}-${cb.proyecto}-${cb.banco}`) ?? `#${cb.banco}`
    return `${banco} · ${cb.numero}`
  }
  function loteDisplay(r: ReciboCaja): string {
    if (!r.manzana && !r.lote) return ''
    return [r.manzana ? `Manzana ${r.manzana}` : null, r.lote ? `Lote ${r.lote}` : null].filter(Boolean).join(' · ')
  }

  // ── Proyectos filtrados por empresa elegida en el panel ──
  const proyectosDelFiltro = useMemo(
    () => proyectos.filter((p) => p.empresa === filtroEmpresa),
    [proyectos, filtroEmpresa],
  )

  // ── Codigo de proyecto elegido (para acotar Cuenta Bancaria / Serie Recibo) ──
  const filtroProyectoCodigo = useMemo(
    () => (filtroProyectoKey ? Number(filtroProyectoKey.split('-')[1]) : 0),
    [filtroProyectoKey],
  )

  // ── Cuentas bancarias / series de recibo del proyecto elegido (no cascada, admiten "Todas") ──
  const cuentasBancariasDelFiltro = useMemo(
    () => cuentasBancarias.filter((c) => c.empresa === filtroEmpresa && c.proyecto === filtroProyectoCodigo),
    [cuentasBancarias, filtroEmpresa, filtroProyectoCodigo],
  )
  const seriesRecibosDelFiltro = useMemo(
    () => seriesRecibos.filter((s) => s.empresa === filtroEmpresa && s.proyecto === filtroProyectoCodigo),
    [seriesRecibos, filtroEmpresa, filtroProyectoCodigo],
  )

  function cuentaBancariaLabel(cb: CuentaBancaria): string {
    const banco = bancoMap.get(`${cb.empresa}-${cb.proyecto}-${cb.banco}`) ?? `#${cb.banco}`
    return `${banco} · ${cb.numero}`
  }

  // ── Aplicar / limpiar filtros (server-side) ──
  function construirFiltros(): PagosFiltros {
    const filtros: PagosFiltros = {}
    if (filtroProyectoKey) {
      const [emp, cod] = filtroProyectoKey.split('-').map(Number)
      filtros.empresa = emp
      filtros.proyecto = cod
    } else if (filtroEmpresa) {
      filtros.empresa = filtroEmpresa
    }
    if (filtroFechaDesde)   filtros.fechaDesde = filtroFechaDesde
    if (filtroFechaHasta)   filtros.fechaHasta = filtroFechaHasta
    if (filtroAgregoDesde)  filtros.agregoDesde = filtroAgregoDesde
    if (filtroAgregoHasta)  filtros.agregoHasta = filtroAgregoHasta
    if (filtroPromesa.trim() && !isNaN(Number(filtroPromesa))) filtros.promesa = Number(filtroPromesa)
    if (filtroCliente.trim()) filtros.cliente = filtroCliente.trim()
    if (filtroCuentaDeposito !== '') filtros.cuentaDeposito = filtroCuentaDeposito
    if (filtroFormaPago !== '') filtros.formaPago = filtroFormaPago
    if (filtroNumeroDocumento.trim()) filtros.numeroDocumento = filtroNumeroDocumento.trim()
    if (filtroSerie) filtros.serie = filtroSerie
    if (filtroNumeroDesde.trim() && !isNaN(Number(filtroNumeroDesde))) filtros.numeroDesde = Number(filtroNumeroDesde)
    if (filtroNumeroHasta.trim() && !isNaN(Number(filtroNumeroHasta))) filtros.numeroHasta = Number(filtroNumeroHasta)
    return filtros
  }

  // Reglas obligatorias antes de permitir "Aplicar Filtros": (a) empresa+proyecto
  // seleccionados, (b) al menos un criterio adicional entre cliente, promesa,
  // fecha de pago, fecha de registro o rango de recibos. cuentaDeposito/formaPago/
  // numeroDocumento/serie NO cuentan para esta regla (son refinamientos, no un
  // criterio de busqueda por si solos).
  function validarFiltros(): string | null {
    if (!filtroProyectoKey) return 'Selecciona una empresa y un proyecto antes de aplicar los filtros.'
    const tieneCriterioAdicional =
      filtroCliente.trim() || filtroPromesa.trim() ||
      filtroFechaDesde || filtroFechaHasta ||
      filtroAgregoDesde || filtroAgregoHasta ||
      filtroNumeroDesde.trim() || filtroNumeroHasta.trim()
    if (!tieneCriterioAdicional) {
      return 'Ingresa al menos un criterio de busqueda: cliente, promesa, fecha de pago, fecha de registro o rango de recibos.'
    }
    return null
  }

  function aplicarFiltros() {
    const errorValidacion = validarFiltros()
    if (errorValidacion) { toast.error(errorValidacion); return }
    guardarFiltrosSesion()
    startFiltrosTransition(async () => {
      const result = await getRecibosCaja(construirFiltros())
      if (result.error) {
        toast.error(result.error)
        return
      }
      setData(result.data)
      setLimitReached(result.limitReached)
      setSearch('')
      setColFilters({})
    })
  }

  function limpiarFiltros() {
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
    const hoy = new Date().toISOString().slice(0, 10)
    setFiltroEmpresa(firstEmpresa)
    setFiltroProyectoKey(firstProyecto ? `${firstEmpresa}-${firstProyecto}` : '')
    setFiltroFechaDesde(''); setFiltroFechaHasta('')
    setFiltroAgregoDesde(hoy); setFiltroAgregoHasta('')
    setFiltroPromesa(''); setFiltroCliente('')
    setFiltroCuentaDeposito(''); setFiltroFormaPago('')
    setFiltroNumeroDocumento(''); setFiltroSerie('')
    setFiltroNumeroDesde(''); setFiltroNumeroHasta('')
    try { sessionStorage.removeItem(FILTROS_STORAGE_KEY) } catch { /* ignore */ }

    const filtrosReset: PagosFiltros = firstProyecto
      ? { empresa: firstEmpresa, proyecto: firstProyecto, agregoDesde: hoy }
      : { agregoDesde: hoy }

    startFiltrosTransition(async () => {
      const result = await getRecibosCaja(filtrosReset)
      if (result.error) { toast.error(result.error); return }
      setData(result.data)
      setLimitReached(result.limitReached)
      setSearch('')
      setColFilters({})
    })
  }

  // ── Búsqueda + filtros de columna sobre los datos ya cargados ──
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return data
    return data.filter((r) =>
      `${r.serie}-${r.numero}`.toLowerCase().includes(q) ||
      clienteNombre(r).toLowerCase().includes(q) ||
      empresaNombre(r).toLowerCase().includes(q) ||
      proyectoNombre(r).toLowerCase().includes(q)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, clienteMap, empresaMap, proyectoMap])

  const filtered = useMemo(() => afterSearch.filter((r) => Object.entries(colFilters).every(([col, vals]) => {
    if (col === '__empresa')    return vals.has(empresaNombre(r))
    if (col === '__proyecto')   return vals.has(proyectoNombre(r))
    if (col === '__cliente')    return vals.has(clienteNombre(r))
    if (col === '__tipo')       return vals.has(tipoTransaccion(r))
    if (col === '__forma_pago') return vals.has(FORMAS_PAGO[r.forma_pago] ?? String(r.forma_pago))
    if (col === '__cobrador')   return vals.has(cobradorNombre(r))
    if (col === '__estado')     return vals.has(ESTADOS_RECIBO[r.estado]?.label ?? String(r.estado))
    return vals.has(String(r[col as keyof ReciboCaja] ?? ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [afterSearch, colFilters])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ── Valores únicos para ColumnFilter ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniqueEmpresas   = useMemo(() => [...new Set(data.map((r) => empresaNombre(r)))].sort(), [data, empresaMap])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniqueProyectosU = useMemo(() => [...new Set(data.map((r) => proyectoNombre(r)))].sort(), [data, proyectoMap])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniqueClientes   = useMemo(() => [...new Set(data.map((r) => clienteNombre(r)))].sort(), [data, clienteMap])
  const uniqueTipos      = useMemo(() => [...new Set(data.map((r) => tipoTransaccion(r)))].sort(), [data])
  const uniqueFormasPago = useMemo(() => [...new Set(data.map((r) => FORMAS_PAGO[r.forma_pago] ?? String(r.forma_pago)))].sort(), [data])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniqueCobradores = useMemo(() => [...new Set(data.map((r) => cobradorNombre(r)).filter(Boolean))].sort(), [data, cobradorMap])
  const uniqueEstados    = useMemo(() => [...new Set(data.map((r) => ESTADOS_RECIBO[r.estado]?.label ?? String(r.estado)))].sort(), [data])
  const uniqueMonedas    = useMemo(() => [...new Set(data.map((r) => r.moneda))].sort(), [data])
  // ── Preferencias de columnas (localStorage) ──
  const STORAGE_KEY = `pagos_cols_v1_${userId}`
  const [colPrefs, setColPrefs] = useState<ColPref[]>(DEFAULT_PREFS)

  // Cargar preferencias guardadas al montar (solo client-side, evita hydration mismatch:
  // el server siempre renderiza DEFAULT_PREFS; localStorage se lee despues del mount)
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
    } catch { /* ignore */ }
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
    const next = [...colPrefs]; const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    saveColPrefs(next)
  }
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ── Paginación ──
  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedRows = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])

  // ── Cursor de teclado ──
  const tableRef = useRef<HTMLDivElement>(null)
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)

  function openView(row: ReciboCaja) {
    setViewTarget(row)
    setExtra(null)
    setDialogOpen(true)
    startExtraTransition(async () => {
      const result = await getReciboCajaExtra(row.empresa, row.proyecto, row.serie, row.numero)
      if (result.error) toast.error(result.error)
      else if (result.data) setExtra(result.data)
    })
  }

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
  }, [filtered, cursorIdx, page])

  useEffect(() => { setCursorIdx(null); setPage(0) }, [search, colFilters, data])

  // ── Exportar CSV ──
  function exportCsv() {
    const COL_LABELS: Record<string, string> = Object.fromEntries(
      [{ key: 'recibo', label: 'Recibo' }, ...ALL_COLUMNS].map((c) => [c.key, c.label]),
    )
    const keys = ['recibo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    const headers = keys.map((k) => COL_LABELS[k] ?? k)
    const valueFor = (r: ReciboCaja, key: string): unknown => {
      switch (key) {
        case 'recibo':        return `${r.serie}-${r.numero}`
        case '__empresa':     return empresaNombre(r)
        case '__proyecto':    return proyectoNombre(r)
        case '__cliente':     return clienteNombre(r)
        case '__tipo':        return tipoTransaccion(r)
        case '__forma_pago':  return FORMAS_PAGO[r.forma_pago] ?? r.forma_pago
        case '__cobrador':    return cobradorNombre(r)
        case '__estado':      return ESTADOS_RECIBO[r.estado]?.label ?? r.estado
        default:              return r[key as keyof ReciboCaja]
      }
    }
    const lines = [
      headers.join(','),
      ...filtered.map((r) => keys.map((k) => formatCsvCell(valueFor(r, k))).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filas del detalle combinando t_detalle_recibo_caja + desglose dinamico de Otros Ingresos
  // (t_detalle_recibo_otros, pivotado por tipo_ingreso — mismo patron y mismo orden de columnas
  // que Plan de Pagos: Capital, Intereses, [Otros Ingresos...], Mora). La columna plana "Otros"
  // de t_detalle_recibo_caja es conceptualmente distinta — pagos unicos no ligados al Plan de
  // Pagos (Escrituracion, Impuestos), transaccion "Pago Otros" aun no desarrollada — se mantiene
  // como columna propia despues de Mora. ──
  const detalleRows = useMemo(() => {
    if (!extra) return []
    return extra.detalle.map((d) => {
      const otrosPorColumna = extra.otrosColumnas.map((col) =>
        extra.otros
          .filter((o) => o.tipo_cuota === d.tipo_cuota && o.cuota === d.cuota && o.tipo_otros === col.codigo)
          .reduce((s, o) => s + o.monto, 0)
      )
      const total = d.capital + d.intereses + otrosPorColumna.reduce((s, v) => s + v, 0) + d.mora + d.otros
      return { ...d, otrosPorColumna, total }
    })
  }, [extra])

  // ── Totales del detalle (para el pie de la tabla de la pestaña Detalle) ──
  const detalleTotales = useMemo(() => {
    if (!extra || detalleRows.length === 0) return null
    const otrosTotales = extra.otrosColumnas.map((_, i) => detalleRows.reduce((s, r) => s + r.otrosPorColumna[i], 0))
    const capital   = detalleRows.reduce((s, r) => s + r.capital, 0)
    const intereses = detalleRows.reduce((s, r) => s + r.intereses, 0)
    const mora      = detalleRows.reduce((s, r) => s + r.mora, 0)
    const otros     = detalleRows.reduce((s, r) => s + r.otros, 0)
    const total     = capital + intereses + otrosTotales.reduce((s, v) => s + v, 0) + mora + otros
    return { capital, intereses, mora, otros, otrosTotales, total }
  }, [extra, detalleRows])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-stone-100 p-2.5">
            <ReceiptText className="h-5 w-5 text-stone-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Mantenimiento Pagos</h1>
            <p className="text-sm text-muted-foreground">Consulta de pagos registrados a las Promesas</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            variant="l-border"
            placeholder="Buscar en lo cargado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant={panelOpen ? 'secondary' : 'outline'} size="sm" onClick={() => setPanelOpen((o) => !o)} className="gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros de columna
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => saveColPrefs(DEFAULT_PREFS)} />
        </div>
      </div>

      {/* ── Panel de filtros ── */}
      {panelOpen && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Empresa</Label>
              <Select value={String(filtroEmpresa)} onValueChange={onFiltroEmpresaChange}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Selecciona empresa">
                    {(v: string) => v && Number(v) ? (empresaMap.get(Number(v)) ?? v) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Proyecto</Label>
              <Select value={filtroProyectoKey} onValueChange={onFiltroProyectoChange} disabled={filtroEmpresa === 0}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Selecciona proyecto">
                    {(v: string) => {
                      if (!v) return null
                      const p = proyectosDelFiltro.find((pr) => `${pr.empresa}-${pr.codigo}` === v)
                      return p?.nombre ?? v.split('-')[1]
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {proyectosDelFiltro.map((p) => <SelectItem key={`${p.empresa}-${p.codigo}`} value={`${p.empresa}-${p.codigo}`}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Promesa</Label>
              <Input variant="l-border" type="number" value={filtroPromesa} onChange={(e) => setFiltroPromesa(e.target.value)} placeholder="Numero de promesa" />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Cliente</Label>
              <Input variant="l-border" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder="Nombre del cliente" />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Fecha Recibo desde</Label>
              <Input variant="l-border" type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Fecha Recibo hasta</Label>
              <Input variant="l-border" type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Fecha Agrego desde</Label>
              <Input variant="l-border" type="date" value={filtroAgregoDesde} onChange={(e) => setFiltroAgregoDesde(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Fecha Agrego hasta</Label>
              <Input variant="l-border" type="date" value={filtroAgregoHasta} onChange={(e) => setFiltroAgregoHasta(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Cuenta Bancaria</Label>
              <Select value={filtroCuentaDeposito === '' ? '__all' : String(filtroCuentaDeposito)} onValueChange={(v) => setFiltroCuentaDeposito(v === '__all' ? '' : Number(v))}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Todas">
                    {(v: string) => {
                      if (!v || v === '__all') return 'Todas'
                      const cb = cuentaBancariaObjMap.get(Number(v))
                      return cb ? cuentaBancariaLabel(cb) : v
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas</SelectItem>
                  {cuentasBancariasDelFiltro.map((cb) => <SelectItem key={cb.codigo} value={String(cb.codigo)}>{cuentaBancariaLabel(cb)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Forma Pago</Label>
              <Select value={filtroFormaPago === '' ? '__all' : String(filtroFormaPago)} onValueChange={(v) => setFiltroFormaPago(v === '__all' ? '' : Number(v))}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Todas">
                    {(v: string) => v && v !== '__all' ? (FORMAS_PAGO[Number(v)] ?? v) : 'Todas'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas</SelectItem>
                  {Object.entries(FORMAS_PAGO).map(([cod, label]) => <SelectItem key={cod} value={cod}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Numero Documento</Label>
              <Input variant="l-border" value={filtroNumeroDocumento} onChange={(e) => setFiltroNumeroDocumento(e.target.value)} placeholder="Numero de documento de pago" />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Serie Recibo</Label>
              <Select value={filtroSerie || '__all'} onValueChange={(v) => setFiltroSerie(v === '__all' ? '' : (v ?? ''))}>
                <SelectTrigger variant="l-border" className="w-full">
                  <SelectValue placeholder="Todas">
                    {(v: string) => v && v !== '__all' ? v : 'Todas'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas</SelectItem>
                  {seriesRecibosDelFiltro.map((s) => <SelectItem key={s.serie} value={s.serie}>{s.serie}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Numero Recibo desde</Label>
              <Input variant="l-border" type="number" value={filtroNumeroDesde} onChange={(e) => setFiltroNumeroDesde(e.target.value)} placeholder="Desde" />
            </div>
            <div className="grid gap-1">
              <Label className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Numero Recibo hasta</Label>
              <Input variant="l-border" type="number" value={filtroNumeroHasta} onChange={(e) => setFiltroNumeroHasta(e.target.value)} placeholder="Hasta" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={aplicarFiltros} disabled={isPendingFiltros} className="gap-1.5">
              {isPendingFiltros && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Aplicar Filtros
            </Button>
            <Button size="sm" variant="outline" onClick={limpiarFiltros} disabled={isPendingFiltros}>Limpiar</Button>
            {usandoFiltroPorDefecto && (
              <span className="text-xs text-muted-foreground">Mostrando los pagos grabados hoy (por fecha de registro). Usa los filtros para ampliar el rango.</span>
            )}
          </div>
        </div>
      )}

      {limitReached && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Se alcanzo el limite de 500 registros mostrados. Refina los filtros para ver resultados mas especificos.
        </div>
      )}

      {/* ── Tabla ── */}
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
              <TableHead className="sticky left-0 z-20 w-24 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Recibo</span>
              </TableHead>
              {visibleCols.map((col) => {
                if (col.key === 'monto') {
                  return (
                    <TableHead key="monto" className="text-right">
                      <span className="text-xs font-medium text-muted-foreground">Monto</span>
                    </TableHead>
                  )
                }
                const values =
                  col.key === '__empresa'    ? uniqueEmpresas    :
                  col.key === '__proyecto'   ? uniqueProyectosU  :
                  col.key === '__cliente'    ? uniqueClientes    :
                  col.key === '__tipo'       ? uniqueTipos       :
                  col.key === '__forma_pago' ? uniqueFormasPago  :
                  col.key === 'moneda'       ? uniqueMonedas     :
                  col.key === '__cobrador'   ? uniqueCobradores  :
                  col.key === '__estado'     ? uniqueEstados     : []
                return (
                  <TableHead key={col.key}>
                    <ColumnFilter
                      label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                      values={values}
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
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length + 2} className="py-16 text-center text-muted-foreground">
                  {search || hasActiveFilters
                    ? 'No se encontraron pagos con ese criterio.'
                    : 'No hay pagos que coincidan con los filtros aplicados.'}
                </TableCell>
              </TableRow>
            ) : pagedRows.map((row, rowIdx) => {
              const globalIdx = page * PAGE_SIZE + rowIdx
              const isActive = cursorIdx === globalIdx
              const estado = ESTADOS_RECIBO[row.estado]
              return (
                <TableRow
                  key={`${row.empresa}-${row.proyecto}-${row.serie}-${row.numero}`}
                  className={`group cursor-pointer transition-colors ${isActive ? 'bg-stone-50 dark:bg-stone-950/30' : 'hover:bg-muted/40'}`}
                  onClick={() => setCursorIdx(globalIdx)}
                  onDoubleClick={() => openView(row)}
                >
                  <TableCell className={`sticky left-0 z-10 font-mono text-xs ${isActive ? 'bg-stone-50 dark:bg-stone-950/30 border-l-[3px] border-l-stone-600 text-stone-700 dark:text-stone-400 font-semibold' : 'bg-card text-muted-foreground group-hover:bg-muted/40'}`}>
                    {row.serie}-{row.numero}
                  </TableCell>
                  {visibleCols.map((col) => {
                    switch (col.key) {
                      case 'fecha':
                        return <TableCell key={col.key} className="text-muted-foreground">{fmtDate(row.fecha)}</TableCell>
                      case '__empresa':
                        return <TableCell key={col.key} className="text-muted-foreground">{empresaNombre(row)}</TableCell>
                      case '__proyecto':
                        return <TableCell key={col.key} className="text-muted-foreground">{proyectoNombre(row)}</TableCell>
                      case '__cliente':
                        return <TableCell key={col.key} className="font-medium">{clienteNombre(row)}</TableCell>
                      case '__tipo':
                        return <TableCell key={col.key}><Badge variant="secondary" className="font-normal">{tipoTransaccion(row)}</Badge></TableCell>
                      case '__forma_pago':
                        return <TableCell key={col.key} className="text-muted-foreground">{FORMAS_PAGO[row.forma_pago] ?? row.forma_pago}</TableCell>
                      case 'moneda': {
                        const flag = CURRENCY_FLAG_MAP.get(row.moneda)
                        return (
                          <TableCell key={col.key} className="text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} alt={row.moneda} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                              {row.moneda}
                            </span>
                          </TableCell>
                        )
                      }
                      case 'monto':
                        return <TableCell key={col.key} className="text-right tabular-nums">{fmt(row.monto)}</TableCell>
                      case 'promesa':
                        return <TableCell key={col.key} className="text-muted-foreground">{row.promesa || '—'}</TableCell>
                      case '__cobrador':
                        return <TableCell key={col.key} className="text-muted-foreground">{cobradorNombre(row) || '—'}</TableCell>
                      case '__estado':
                        return (
                          <TableCell key={col.key}>
                            <Badge variant="outline" className={`font-normal ${estado?.cls ?? ''}`}>{estado?.label ?? row.estado}</Badge>
                          </TableCell>
                        )
                      case 'agrego_fecha':
                        return <TableCell key={col.key} className="text-muted-foreground">{fmtDate(row.agrego_fecha?.slice(0, 10))}</TableCell>
                      default:
                        return <TableCell key={col.key} className="text-muted-foreground">{String(row[col.key as keyof ReciboCaja] ?? '')}</TableCell>
                    }
                  })}
                  <TableCell className={`sticky right-0 z-10 ${isActive ? 'bg-stone-50 dark:bg-stone-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium
                                   transition-opacity hover:bg-accent hover:text-accent-foreground
                                   focus-visible:outline-none opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(row)}>
                          <Eye className="mr-2 h-4 w-4" /> Ver
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAuditTarget(row)}>
                          <History className="mr-2 h-4 w-4" /> Historial
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Contador + paginación ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length > 0
            ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} pagos`
            : '0 pagos'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Pagina anterior"
              disabled={page === 0}
              onClick={() => { setPage((p) => p - 1); setCursorIdx(null) }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">{page + 1} / {totalPages}</span>
            <button type="button" aria-label="Pagina siguiente"
              disabled={page >= totalPages - 1}
              onClick={() => { setPage((p) => p + 1); setCursorIdx(null) }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Modal Ver ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setViewTarget(null); setExtra(null) } }}>
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[64rem] h-[700px] max-h-[90vh] overflow-hidden">
          {viewTarget && (
            <>
              <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-stone-50/70 to-transparent border-b border-border/50 shrink-0">
                <div className="flex items-center gap-3 pr-8">
                  <div className="shrink-0 rounded-xl p-2 bg-stone-100">
                    <ReceiptText className="h-4 w-4 text-stone-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-semibold leading-tight truncate">
                      Recibo {viewTarget.serie}-{viewTarget.numero}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {[empresaNombre(viewTarget), proyectoNombre(viewTarget)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-0.5 flex flex-col flex-1 min-h-0">
                <div className="shrink-0 w-full">
                  <TabsList variant="line" className="">
                    <TabsTrigger value="info" className="gap-1.5 rounded-t-sm rounded-b-none border border-b-0 border-primary/50 bg-background px-3 after:hidden data-active:border-primary data-active:bg-background">
                      <Info className="h-3.5 w-3.5" /> Informacion
                    </TabsTrigger>
                    <TabsTrigger value="detalle" className="gap-1.5 rounded-t-sm rounded-b-none border border-b-0 border-primary/50 bg-background px-3 after:hidden data-active:border-primary data-active:bg-background">
                      <ListOrdered className="h-3.5 w-3.5" /> Detalle
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="info" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                  <div className="flex gap-6 items-start">

                    {/* Columna izquierda: IDENTIFICACION + GENERAL */}
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <SectionDivider label="IDENTIFICACION" />
                      <ViewField label="Serie"   value={viewTarget.serie} />
                      <ViewField label="Numero"  value={String(viewTarget.numero)} />
                      <ViewField label="Empresa"  value={empresaNombre(viewTarget)} />
                      <ViewField label="Proyecto" value={proyectoNombre(viewTarget)} />

                      <SectionDivider label="GENERAL" />
                      <ViewField label="Fecha" value={fmtDate(viewTarget.fecha)} />
                      <ViewField label="Tipo Transaccion" value={tipoTransaccion(viewTarget)} />
                      <div className="grid gap-1">
                        <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Moneda</span>
                        <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2 gap-1.5" style={{ height: 'var(--ui-field-height)' }}>
                          {(() => {
                            const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda)
                            return (
                              <>
                                {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt={viewTarget.moneda} className="rounded-[2px] shrink-0" />}
                                <span className="font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{viewTarget.moneda}</span>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      <ViewField label="Monto" value={fmt(viewTarget.monto)} />
                      <ViewField label="Tasa de Cambio" value={viewTarget.tasa_cambio && viewTarget.tasa_cambio !== 1 ? fmt(viewTarget.tasa_cambio) : ''} />
                      <div className="col-span-2"><ViewField label="Cliente" value={clienteNombre(viewTarget)} /></div>
                      <ViewField label="Lote" value={loteDisplay(viewTarget)} />
                      <ViewField label="Promesa" value={viewTarget.promesa ? String(viewTarget.promesa) : ''} />
                    </div>

                    <div className="w-px self-stretch bg-primary/30" />

                    {/* Columna derecha: FORMA PAGO + DEPOSITO + FACTURA */}
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <SectionDivider label="FORMA PAGO" />
                      <ViewField label="Forma de Pago" value={FORMAS_PAGO[viewTarget.forma_pago] ?? String(viewTarget.forma_pago)} />
                      <ViewField label="Banco" value={bancoNombre(viewTarget)} />
                      <ViewField label="Numero de Cuenta" value={viewTarget.numero_cuenta} />
                      <ViewField label="Numero Documento" value={viewTarget.numero_documento} />
                      <div className="col-span-2"><ViewField label="Cobrador" value={cobradorNombre(viewTarget)} /></div>

                      <SectionDivider label="DEPOSITO" />
                      {isPendingExtra ? (
                        <div className="col-span-2 py-2 text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando informacion del deposito...
                        </div>
                      ) : extra?.deposito ? (
                        <>
                          <ViewField label="Cuenta Bancaria" value={cuentaDepositoDisplay(viewTarget)} />
                          <ViewField label="Tipo" value={TIPOS_TRANSACCION_BANCARIA[extra.deposito.tipo_transaccion] ?? String(extra.deposito.tipo_transaccion)} />
                          <ViewField label="Fecha" value={fmtDate(extra.deposito.fecha)} />
                          <ViewField label="Numero Documento" value={extra.deposito.numero_documento} />
                          <ViewField label="Valor" value={fmt(extra.deposito.valor)} />
                          <ViewField label="No. Transaccion" value={extra.deposito.numero_transaccion} />
                        </>
                      ) : (
                        <div className="col-span-2 py-2 text-xs text-muted-foreground">
                          Pendiente de deposito.
                        </div>
                      )}

                      <SectionDivider label="FACTURA" />
                      <ViewField label="Serie Factura" value={viewTarget.factura_serie} />
                      <ViewField label="Numero Factura" value={viewTarget.factura_numero ? String(viewTarget.factura_numero) : ''} />
                      <p className="col-span-2 text-xs text-muted-foreground italic">
                        Funcionalidad de facturacion pendiente de implementar.
                      </p>
                    </div>

                  </div>
                </TabsContent>

                <TabsContent value="detalle" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                  {isPendingExtra ? (
                    <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando detalle...
                    </div>
                  ) : !extra || extra.detalle.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      Este recibo no tiene detalle registrado.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead><span className="text-xs font-medium text-muted-foreground">Fecha Cuota</span></TableHead>
                          <TableHead><span className="text-xs font-medium text-muted-foreground">Tipo Cuota</span></TableHead>
                          <TableHead><span className="text-xs font-medium text-muted-foreground">Cuota</span></TableHead>
                          <TableHead className="text-right"><span className="text-xs font-medium text-muted-foreground">Capital</span></TableHead>
                          <TableHead className="text-right"><span className="text-xs font-medium text-muted-foreground">Intereses</span></TableHead>
                          {extra.otrosColumnas.map((col) => (
                            <TableHead key={col.codigo} className="text-right">
                              <span className="text-xs font-medium text-muted-foreground">{col.etiqueta}</span>
                            </TableHead>
                          ))}
                          <TableHead className="text-right"><span className="text-xs font-medium text-muted-foreground">Mora</span></TableHead>
                          <TableHead className="text-right"><span className="text-xs font-medium text-muted-foreground">Otros</span></TableHead>
                          <TableHead className="text-right"><span className="text-xs font-medium text-muted-foreground">Total</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalleRows.map((d, i) => (
                          <TableRow key={`${d.tipo_cuota}-${d.cuota}-${i}`}>
                            <TableCell className="text-muted-foreground">{fmtDate(d.fecha_cuota)}</TableCell>
                            <TableCell className="text-muted-foreground">{TIPOS_CUOTA[d.tipo_cuota] ?? d.tipo_cuota}</TableCell>
                            <TableCell className="text-muted-foreground">{d.cuota}</TableCell>
                            <TableCell className="text-right">{fmt(d.capital)}</TableCell>
                            <TableCell className="text-right">{fmt(d.intereses)}</TableCell>
                            {d.otrosPorColumna.map((monto, ci) => (
                              <TableCell key={extra.otrosColumnas[ci].codigo} className="text-right">{fmt(monto)}</TableCell>
                            ))}
                            <TableCell className="text-right">{fmt(d.mora)}</TableCell>
                            <TableCell className="text-right">{fmt(d.otros)}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(d.total)}</TableCell>
                          </TableRow>
                        ))}
                        {detalleTotales && (
                          <TableRow className="bg-muted/20 font-semibold">
                            <TableCell colSpan={3} className="text-right">Totales</TableCell>
                            <TableCell className="text-right">{fmt(detalleTotales.capital)}</TableCell>
                            <TableCell className="text-right">{fmt(detalleTotales.intereses)}</TableCell>
                            {detalleTotales.otrosTotales.map((monto, ci) => (
                              <TableCell key={extra.otrosColumnas[ci].codigo} className="text-right">{fmt(monto)}</TableCell>
                            ))}
                            <TableCell className="text-right">{fmt(detalleTotales.mora)}</TableCell>
                            <TableCell className="text-right">{fmt(detalleTotales.otros)}</TableCell>
                            <TableCell className="text-right">{fmt(detalleTotales.total)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4 shrink-0">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Historial (auditoria) ── */}
      <AuditLogDialog
        open={auditTarget !== null}
        onOpenChange={(open) => { if (!open) setAuditTarget(null) }}
        tabla="t_recibo_caja"
        cuenta={auditTarget?.cuenta ?? ''}
        registroId={auditTarget ? { empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, serie: auditTarget.serie, numero: auditTarget.numero } : {}}
        titulo={auditTarget ? `Recibo ${auditTarget.serie}-${auditTarget.numero}` : ''}
      />

    </div>
  )
}
