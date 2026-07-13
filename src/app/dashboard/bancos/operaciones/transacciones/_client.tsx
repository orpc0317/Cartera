'use client'

import { useState, useMemo, useRef, useCallback, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ScrollText, Search, X, Settings2, Download,
  ChevronDown, ChevronUp, MoreHorizontal, Eye, History,
  ChevronLeft, ChevronRight, Ban, Trash2, MapPin,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import type { TransaccionBancaria, Empresa, Proyecto, CuentaBancaria, Banco } from '@/lib/types/proyectos'
import {
  anularTransaccionBancaria,
  eliminarTransaccionBancaria,
} from '@/app/actions/transacciones-bancarias'

// ─── Mapas de catálogos ───────────────────────────────────────────────────

const TIPOS_TRANSACCION: Record<number, string> = {
  1: 'Cheque',
  2: 'Deposito',
  3: 'Nota Debito',
  4: 'Nota Credito',
  5: 'Transferencia',
}

const ESTADOS_TRANSACCION: Record<number, { label: string; cls: string }> = {
  1: { label: 'Operada', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  2: { label: 'Anulada', cls: 'bg-red-100    text-red-700    border-red-200'    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type ColFilters = Record<string, Set<string>>
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

// ─── Columnas ─────────────────────────────────────────────────────────────

const ALL_COLUMNS: ColDef[] = [
  { key: '__proyecto',         label: 'Proyecto',         defaultVisible: true  },
  { key: '__cuenta_bancaria',  label: 'Cuenta Bancaria',  defaultVisible: true  },
  { key: 'fecha',              label: 'Fecha',            defaultVisible: true  },
  { key: '__tipo',             label: 'Tipo',             defaultVisible: true  },
  { key: 'a_nombre_de',        label: 'A Nombre De',      defaultVisible: true  },
  { key: '__monto',            label: 'Monto',            defaultVisible: true  },
  { key: '__estado',           label: 'Estado',           defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// ─── Export CSV ────────────────────────────────────────────────────────────

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
        <span className="block font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{value ?? ''}</span>
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

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  initialData:      TransaccionBancaria[]
  empresas:         Empresa[]
  proyectos:        Proyecto[]
  cuentasBancarias: CuentaBancaria[]
  bancos:           Banco[]
  puedeAnular:      boolean
  puedeEliminar:    boolean
  userId:           string
}

// ─── Componente principal ──────────────────────────────────────────────────

export function TransaccionesBancariasClient({
  initialData, empresas, proyectos, cuentasBancarias, bancos,
  puedeAnular, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Estado ────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('')
  const [colFilters, setColFilters]     = useState<ColFilters>({})
  const [fechaDesde, setFechaDesde]     = useState('')
  const [fechaHasta, setFechaHasta]     = useState('')
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [viewTarget, setViewTarget]     = useState<TransaccionBancaria | null>(null)
  const [anularTarget, setAnularTarget] = useState<TransaccionBancaria | null>(null)
  const [eliminarTarget, setEliminarTarget] = useState<TransaccionBancaria | null>(null)
  const [auditTarget, setAuditTarget]   = useState<TransaccionBancaria | null>(null)

  // ── Lookup maps ───────────────────────────────────────────────────────
  const empresaMap = useMemo(
    () => new Map(empresas.map((e) => [e.codigo, e.nombre])),
    [empresas],
  )

  const proyectoMap = useMemo(
    () => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])),
    [proyectos],
  )

  const bancoMap = useMemo(
    () => new Map(bancos.map((b) => [`${b.empresa}-${b.proyecto}-${b.codigo}`, b.nombre])),
    [bancos],
  )

  const cuentaBancariaObjMap = useMemo(
    () => new Map(cuentasBancarias.map((cb) => [cb.codigo, cb])),
    [cuentasBancarias],
  )

  const cuentaBancariaDisplayMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const cb of cuentasBancarias) {
      const banco = bancoMap.get(`${cb.empresa}-${cb.proyecto}-${cb.banco}`) ?? `#${cb.banco}`
      m.set(cb.codigo, `${banco} · ${cb.numero}`)
    }
    return m
  }, [cuentasBancarias, bancoMap])

  const cuentaBancariaMonedaMap = useMemo(
    () => new Map(cuentasBancarias.map((cb) => [cb.codigo, cb.moneda])),
    [cuentasBancarias],
  )

  // Proyecto display for a transaction (via cuenta_bancaria → proyecto)
  function getProyectoNombre(r: TransaccionBancaria): string {
    const cb = cuentaBancariaObjMap.get(r.cuenta_bancaria)
    if (!cb) return `#${r.cuenta_bancaria}`
    return proyectoMap.get(`${r.empresa}-${cb.proyecto}`) ?? `#${cb.proyecto}`
  }

  // ── Filtrado ──────────────────────────────────────────────────────────
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return initialData
    return initialData.filter((r) => {
      const proy = getProyectoNombre(r).toLowerCase()
      const cb   = cuentaBancariaDisplayMap.get(r.cuenta_bancaria)?.toLowerCase() ?? ''
      return (
        r.numero_transaccion.toLowerCase().includes(q) ||
        proy.includes(q) ||
        cb.includes(q) ||
        (r.a_nombre_de ?? '').toLowerCase().includes(q) ||
        (r.numero_documento ?? '').toLowerCase().includes(q)
      )
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, search, cuentaBancariaDisplayMap])

  const filtered = useMemo(() => afterSearch.filter((r) => {
    if (fechaDesde && r.fecha < fechaDesde) return false
    if (fechaHasta && r.fecha > fechaHasta) return false
    return Object.entries(colFilters).every(([col, vals]) => {
      if (col === '__proyecto')        return vals.has(getProyectoNombre(r))
      if (col === '__cuenta_bancaria') return vals.has(cuentaBancariaDisplayMap.get(r.cuenta_bancaria) ?? '')
      if (col === '__tipo')            return vals.has(TIPOS_TRANSACCION[r.tipo_transaccion] ?? String(r.tipo_transaccion))
      if (col === '__estado')          return vals.has(ESTADOS_TRANSACCION[r.estado]?.label ?? String(r.estado))
      return vals.has(String(r[col as keyof TransaccionBancaria] ?? ''))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [afterSearch, colFilters, fechaDesde, fechaHasta, cuentaBancariaDisplayMap])

  const hasActiveFilters = Object.keys(colFilters).length > 0 || !!fechaDesde || !!fechaHasta

  // ── Unique values para filtros ─────────────────────────────────────────
  const uniqueProyectos   = useMemo(() => [...new Set(initialData.map((r) => getProyectoNombre(r)))].sort(), [initialData, proyectoMap, cuentaBancariaObjMap]) // eslint-disable-line react-hooks/exhaustive-deps
  const uniqueCuentas     = useMemo(() => [...new Set(initialData.map((r) => cuentaBancariaDisplayMap.get(r.cuenta_bancaria) ?? ''))].sort(), [initialData, cuentaBancariaDisplayMap])
  const uniqueTipos       = useMemo(() => [...new Set(initialData.map((r) => TIPOS_TRANSACCION[r.tipo_transaccion] ?? String(r.tipo_transaccion)))].sort(), [initialData])
  const uniqueEstados     = useMemo(() => [...new Set(initialData.map((r) => ESTADOS_TRANSACCION[r.estado]?.label ?? String(r.estado)))].sort(), [initialData])

  // ── Preferencias de columnas ──────────────────────────────────────────
  const STORAGE_KEY = `trx_ban_cols_v1_${userId}`
  const [colPrefs, setColPrefs] = useState<ColPref[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return DEFAULT_PREFS
      const parsed: ColPref[] = JSON.parse(saved)
      const knownKeys = new Set(parsed.map((p) => p.key))
      return [
        ...parsed.filter((p) => ALL_COLUMNS.some((c) => c.key === p.key)),
        ...DEFAULT_PREFS.filter((p) => !knownKeys.has(p.key)),
      ]
    } catch { return DEFAULT_PREFS }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colPrefs)) } catch { /* quota */ }
  }, [colPrefs, STORAGE_KEY])

  function toggleCol(key: string) { setColPrefs(colPrefs.map((p) => p.key === key ? { ...p, visible: !p.visible } : p)) }
  function moveCol(key: string, dir: -1 | 1) {
    const idx = colPrefs.findIndex((p) => p.key === key)
    if (idx < 0) return
    const next = [...colPrefs]; const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setColPrefs(next)
  }
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ── Paginación ────────────────────────────────────────────────────────
  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedRows = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  )

  // ── Cursor de teclado ─────────────────────────────────────────────────
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

  useEffect(() => { setCursorIdx(null); setPage(0) }, [search, colFilters, fechaDesde, fechaHasta])

  // ── Acciones ──────────────────────────────────────────────────────────

  function openView(r: TransaccionBancaria) {
    setViewTarget(r)
    setDialogOpen(true)
  }

  function handleAnular() {
    if (!anularTarget) return
    startTransition(async () => {
      const result = await anularTransaccionBancaria(
        anularTarget.empresa,
        anularTarget.cuenta_bancaria,
        anularTarget.numero_transaccion,
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Transacción ${anularTarget.numero_transaccion} anulada.`)
        router.refresh()
        if (viewTarget?.numero_transaccion === anularTarget.numero_transaccion) {
          setDialogOpen(false)
        }
      }
      setAnularTarget(null)
    })
  }

  function handleEliminar() {
    if (!eliminarTarget) return
    startTransition(async () => {
      const result = await eliminarTransaccionBancaria(
        eliminarTarget.empresa,
        eliminarTarget.cuenta_bancaria,
        eliminarTarget.numero_transaccion,
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Transacción ${eliminarTarget.numero_transaccion} eliminada.`)
        router.refresh()
        if (viewTarget?.numero_transaccion === eliminarTarget.numero_transaccion) {
          setDialogOpen(false)
        }
      }
      setEliminarTarget(null)
    })
  }

  // Export CSV
  function exportCsv() {
    const headers = ['Numero Transaccion', 'Proyecto', 'Cuenta Bancaria', 'Fecha', 'Tipo', 'A Nombre De', 'Monto', 'Moneda', 'Estado']
    const lines = [
      headers.join(','),
      ...filtered.map((r) => [
        r.numero_transaccion,
        getProyectoNombre(r),
        cuentaBancariaDisplayMap.get(r.cuenta_bancaria) ?? '',
        r.fecha,
        TIPOS_TRANSACCION[r.tipo_transaccion] ?? r.tipo_transaccion,
        r.a_nombre_de ?? '',
        r.valor,
        cuentaBancariaMonedaMap.get(r.cuenta_bancaria) ?? '',
        ESTADOS_TRANSACCION[r.estado]?.label ?? r.estado,
      ].map(formatCsvCell).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `transacciones-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-fuchsia-100 p-2.5">
            <ScrollText className="h-5 w-5 text-fuchsia-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Transacciones Bancarias</h1>
            <p className="text-sm text-muted-foreground">Mantenimiento de transacciones registradas</p>
          </div>
        </div>
      </div>

      {/* Búsqueda + Export + ColumnManager */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input variant="l-border"
            placeholder="Buscar transacciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setColFilters({}); setFechaDesde(''); setFechaHasta('') }} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => setColPrefs(DEFAULT_PREFS)} />
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">Desde</span>
          <Input variant="l-border"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">Hasta</span>
          <Input variant="l-border"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="h-8 w-36 text-xs"
          />
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
              <TableHead className="sticky left-0 z-20 w-32 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">N° Transaccion</span>
              </TableHead>
              {visibleCols.map((col) => {
                if (col.key === '__proyecto') {
                  return (
                    <TableHead key="__proyecto">
                      <ColumnFilter label="Proyecto" values={uniqueProyectos}
                        active={colFilters['__proyecto'] ?? new Set()}
                        onChange={(v) => setColFilter('__proyecto', v)} />
                    </TableHead>
                  )
                }
                if (col.key === '__cuenta_bancaria') {
                  return (
                    <TableHead key="__cuenta_bancaria">
                      <ColumnFilter label="Cuenta Bancaria" values={uniqueCuentas}
                        active={colFilters['__cuenta_bancaria'] ?? new Set()}
                        onChange={(v) => setColFilter('__cuenta_bancaria', v)} />
                    </TableHead>
                  )
                }
                if (col.key === '__tipo') {
                  return (
                    <TableHead key="__tipo">
                      <ColumnFilter label="Tipo" values={uniqueTipos}
                        active={colFilters['__tipo'] ?? new Set()}
                        onChange={(v) => setColFilter('__tipo', v)} />
                    </TableHead>
                  )
                }
                if (col.key === '__monto') {
                  return (
                    <TableHead key="__monto" className="text-right">
                      <span className="text-xs font-medium text-muted-foreground">Monto</span>
                    </TableHead>
                  )
                }
                if (col.key === '__estado') {
                  return (
                    <TableHead key="__estado">
                      <ColumnFilter label="Estado" values={uniqueEstados}
                        active={colFilters['__estado'] ?? new Set()}
                        onChange={(v) => setColFilter('__estado', v)} />
                    </TableHead>
                  )
                }
                const def = ALL_COLUMNS.find((c) => c.key === col.key)!
                return (
                  <TableHead key={col.key}>
                    <span className="text-xs font-medium text-muted-foreground">{def.label}</span>
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
                    ? 'No se encontraron transacciones con ese criterio.'
                    : 'No hay transacciones bancarias registradas.'}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r, rowIdx) => {
                const globalIdx = page * PAGE_SIZE + rowIdx
                const isActive = cursorIdx === globalIdx
                const estInfo = ESTADOS_TRANSACCION[r.estado]
                return (
                  <TableRow
                    key={r.numero_transaccion}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-fuchsia-50 dark:bg-fuchsia-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(globalIdx)}
                    onDoubleClick={() => openView(r)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-fuchsia-50 dark:bg-fuchsia-950/30 border-l-[3px] border-l-fuchsia-600 text-fuchsia-700 dark:text-fuchsia-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {r.numero_transaccion}
                    </TableCell>

                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case '__proyecto':
                          return <TableCell key="__proyecto" className="font-medium">{getProyectoNombre(r)}</TableCell>
                        case '__cuenta_bancaria':
                          return <TableCell key="__cuenta_bancaria" className="text-muted-foreground text-sm">{cuentaBancariaDisplayMap.get(r.cuenta_bancaria) ?? `#${r.cuenta_bancaria}`}</TableCell>
                        case 'fecha':
                          return <TableCell key="fecha" className="text-muted-foreground">{r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</TableCell>
                        case '__tipo':
                          return <TableCell key="__tipo" className="text-muted-foreground">{TIPOS_TRANSACCION[r.tipo_transaccion] ?? `#${r.tipo_transaccion}`}</TableCell>
                        case 'a_nombre_de':
                          return <TableCell key="a_nombre_de" className="text-muted-foreground">{r.a_nombre_de || '—'}</TableCell>
                        case '__monto': {
                          const moneda = cuentaBancariaMonedaMap.get(r.cuenta_bancaria) ?? ''
                          return (
                            <TableCell key="__monto" className="text-right tabular-nums text-sm">
                              <span className="text-muted-foreground mr-1">{moneda}</span>
                              {fmt(r.valor)}
                            </TableCell>
                          )
                        }
                        case '__estado':
                          return (
                            <TableCell key="__estado">
                              {estInfo
                                ? <Badge variant="outline" className={`font-normal ${estInfo.cls}`}>{estInfo.label}</Badge>
                                : <Badge variant="outline">{r.estado}</Badge>}
                            </TableCell>
                          )
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{String(r[col.key as keyof TransaccionBancaria] ?? '—')}</TableCell>
                      }
                    })}

                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-fuchsia-50 dark:bg-fuchsia-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger title="Acciones" className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(r)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(r)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          {puedeAnular && r.estado === 1 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-amber-600 focus:text-amber-700"
                                onClick={() => setAnularTarget(r)}
                              >
                                <Ban className="mr-2 h-3.5 w-3.5" /> Anular
                              </DropdownMenuItem>
                            </>
                          )}
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setEliminarTarget(r)}
                              >
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

      {/* Contador + Paginación */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length > 0
            ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length} transacción${filtered.length !== 1 ? 'es' : ''}`
            : '0 transacciones'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => { setPage((p) => p - 1); setCursorIdx(null) }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">{page + 1} / {totalPages}</span>
            <button type="button" aria-label="Página siguiente" disabled={page >= totalPages - 1} onClick={() => { setPage((p) => p + 1); setCursorIdx(null) }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Diálogo Ver */}
      <Dialog modal={false} open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open) }}>
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[64rem] h-[680px] max-h-[90vh] overflow-hidden">

          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-fuchsia-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className="shrink-0 rounded-xl bg-fuchsia-100 p-2">
                <ScrollText className="h-5 w-5 text-fuchsia-700" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  Transacción {viewTarget?.numero_transaccion ?? ''}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {getProyectoNombre(viewTarget)}
                    {' · '}
                    {cuentaBancariaDisplayMap.get(viewTarget.cuenta_bancaria) ?? ''}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-0.5 flex flex-col flex-1 min-h-0">
            <div className="shrink-0 w-full">
              <TabsList variant="line" className="">
                <TabsTrigger value="general" className="gap-1.5 px-3 rounded-none bg-transparent border-b-2 border-b-transparent after:hidden data-active:border-b-primary data-active:text-primary">
                  <MapPin className="h-3.5 w-3.5" /> General
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
              {viewTarget && (
                <div className="flex gap-6 items-start">

                  {/* Columna izquierda */}
                  <div className="flex-1 grid grid-cols-2 gap-2">

                    <SectionDivider label="Identificacion" />
                    <div className="col-span-2">
                      <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} />
                    </div>
                    <div className="col-span-2">
                      <ViewField label="Proyecto" value={getProyectoNombre(viewTarget)} />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <ViewField label="Cuenta Bancaria" value={cuentaBancariaDisplayMap.get(viewTarget.cuenta_bancaria) ?? `#${viewTarget.cuenta_bancaria}`} />
                      <ViewField label="Numero Transaccion" value={viewTarget.numero_transaccion} />
                    </div>

                    <SectionDivider label="General" />

                    {/* Línea 1: Tipo (1/3), espacio (1/3), Estado (1/3) */}
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <ViewField label="Tipo Transaccion" value={TIPOS_TRANSACCION[viewTarget.tipo_transaccion] ?? `#${viewTarget.tipo_transaccion}`} />
                      <div />
                      <div className="grid gap-1">
                        <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>Estado</span>
                        <div className="flex items-center" style={{ height: 'var(--ui-field-height)' }}>
                          {(() => {
                            const est = ESTADOS_TRANSACCION[viewTarget.estado]
                            return est
                              ? <Badge variant="outline" className={`font-normal ${est.cls}`}>{est.label}</Badge>
                              : <Badge variant="outline">{viewTarget.estado}</Badge>
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Línea 2: Fecha, Numero Documento, Monto */}
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <ViewField label="Fecha" value={viewTarget.fecha ? viewTarget.fecha.split('-').reverse().join('/') : ''} />
                      <ViewField label="Numero Documento" value={viewTarget.numero_documento ?? ''} />
                      <div className="grid gap-1">
                        <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>Monto</span>
                        <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
                          <span className="block font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>
                            <span className="text-muted-foreground mr-1">{cuentaBancariaMonedaMap.get(viewTarget.cuenta_bancaria) ?? ''}</span>
                            {fmt(viewTarget.valor)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Línea 3: A Nombre De */}
                    <div className="col-span-2">
                      <ViewField label="A Nombre De" value={viewTarget.a_nombre_de ?? ''} />
                    </div>

                  </div>

                  {/* Separador vertical */}
                  <div className="w-px self-stretch bg-primary/30" />

                  {/* Columna derecha */}
                  <div className="flex-1 grid grid-cols-2 gap-2">

                    <SectionDivider label="Otros" />
                    <div className="col-span-2 grid gap-1">
                      <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>Comentario</span>
                      <div className="rounded-none bg-transparent border-0 border-b border-primary/50 px-2 py-1 min-h-[56px]">
                        <span className="block font-medium text-foreground whitespace-pre-wrap" style={{ fontSize: 'var(--ui-viewfield-value)' }}>
                          {viewTarget.comentario ?? ''}
                        </span>
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0 flex flex-row items-center justify-between w-full">
            <div className="flex gap-2">
              {puedeAnular && viewTarget?.estado === 1 && (
                <Button
                  variant="outline"
                  className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                  onClick={() => { setAnularTarget(viewTarget); }}
                  disabled={isPending}
                >
                  <Ban className="h-3.5 w-3.5" /> Anular
                </Button>
              )}
              {puedeEliminar && viewTarget && (
                <Button
                  variant="outline"
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => { setEliminarTarget(viewTarget); }}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Confirmar Anular */}
      <AlertDialog open={!!anularTarget} onOpenChange={(o) => !o && setAnularTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular transacción?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              La transacción <strong>{anularTarget?.numero_transaccion}</strong> cambiará a estado <strong>Anulada</strong>. Esta acción puede revertirse según las reglas del negocio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnular}
              disabled={isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isPending ? 'Anulando…' : 'Anular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar Eliminar */}
      <AlertDialog open={!!eliminarTarget} onOpenChange={(o) => !o && setEliminarTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar transacción?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Esta acción no se puede deshacer. Se eliminará permanentemente la transacción <strong>{eliminarTarget?.numero_transaccion}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit Log */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_transaccion_bancaria"
          cuenta={cuentaBancariaObjMap.get(auditTarget.cuenta_bancaria)?.cuenta ?? ''}
          registroId={{ empresa: auditTarget.empresa, cuenta_bancaria: auditTarget.cuenta_bancaria, numero_transaccion: auditTarget.numero_transaccion }}
          titulo={auditTarget.numero_transaccion}
        />
      )}

    </div>
  )
}
