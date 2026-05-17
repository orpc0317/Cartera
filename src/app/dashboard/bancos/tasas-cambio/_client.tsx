'use client'

import { useState, useMemo, useTransition, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeftRight, Plus, Search, X, ChevronDown, ChevronUp,
  Settings2, Download, Trash2, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { createTasaCambio, deleteTasaCambio } from '@/app/actions/tasas-cambio'
import type { TasaCambio, TasaCambioForm, TasaCambioGrupo } from '@/lib/types/tasas-cambio'
import type { Empresa, Proyecto, ProyectoMoneda } from '@/lib/types/proyectos'

// ── Moneda flag map ─────────────────────────────────────────────────────────
const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

// ── Column definitions ──────────────────────────────────────────────────────
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',     label: 'Empresa',      defaultVisible: false },
  { key: 'moneda',      label: 'Moneda',        defaultVisible: true  },
  { key: 'ultima_fecha', label: 'Fecha',        defaultVisible: true  },
  { key: 'ultima_tasa', label: 'Tasa Cambio',   defaultVisible: true  },
]
const DEFAULT_PREFS = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])
const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: 'proyecto', label: 'Proyecto' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"` : str
}

function exportCsv(rows: TasaCambioGrupo[], colPrefs: ColPref[],
  empresaMap: Map<number, string>, proyectoMap: Map<string, string>) {
  const keys = ['proyecto', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => {
      if (k === 'proyecto') return formatCsvCell(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? r.proyecto)
      if (k === 'empresa')  return formatCsvCell(empresaMap.get(r.empresa) ?? r.empresa)
      return formatCsvCell(r[k as keyof TasaCambioGrupo] ?? '')
    }).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasas-cambio-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ── Form constants ───────────────────────────────────────────────────────────
const EMPTY_FORM: TasaCambioForm = {
  empresa: 0,
  proyecto: 0,
  moneda: '',
  fecha: '',
  tasa_cambio: '',
}

const SKIP_KEYS = new Set<keyof TasaCambioForm>(['moneda', 'fecha'])

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  tasas: TasaCambio[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  proyectoMonedas: ProyectoMoneda[]
  puedeAgregar: boolean
  puedeEliminar: boolean
  userId: string
}

// ── ColumnFilter ─────────────────────────────────────────────────────────────
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
              <span className="truncate">{v || '(vacío)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── ColumnManager ─────────────────────────────────────────────────────────────
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
                <button type="button" disabled={i === 0} onClick={() => onMove(pref.key, -1)} aria-label="Subir columna" className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)} aria-label="Bajar columna" className="text-muted-foreground hover:text-foreground disabled:opacity-25">
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function TasasCambioClient({
  tasas, empresas, proyectos, proyectoMonedas,
  puedeAgregar, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const tableRef = useRef<HTMLDivElement>(null)

  // ── Table state ─────────────────────────────────────────────────────────
  const STORAGE_KEY = `tasas_cambio_cols_v1_${userId}`
  const [colPrefs, setColPrefs] = useState<ColPref[]>(DEFAULT_PREFS)
  const [search, setSearch]     = useState('')
  type ColFilters = Record<string, Set<string>>
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [cursorIdx, setCursorIdx]   = useState<number | null>(null)

  // Load persisted column prefs
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
  function toggleCol(key: string) {
    saveColPrefs(colPrefs.map((p) => p.key === key ? { ...p, visible: !p.visible } : p))
  }
  function moveCol(key: string, dir: -1 | 1) {
    const idx = colPrefs.findIndex((p) => p.key === key)
    const swap = idx + dir
    if (swap < 0 || swap >= colPrefs.length) return
    const next = [...colPrefs];
    [next[idx], next[swap]] = [next[swap], next[idx]]
    saveColPrefs(next)
  }
  function resetColPrefs() { saveColPrefs(DEFAULT_PREFS) }

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  // ── Modal state ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [isEditing, setIsEditing]     = useState(false)   // true = Nuevo form
  const [viewTarget, setViewTarget]   = useState<TasaCambioGrupo | null>(null)
  const [form, setForm]               = useState<TasaCambioForm>(EMPTY_FORM)
  const [isPending, startTransition]  = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<TasaCambio | null>(null)

  // ── Lookups ──────────────────────────────────────────────────────────────
  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])

  // ── Aggregated grupos ─────────────────────────────────────────────────────
  const grupos = useMemo(() => {
    const map = new Map<string, TasaCambioGrupo>()
    for (const t of tasas) {
      const key = `${t.empresa}-${t.proyecto}-${t.moneda}`
      if (!map.has(key)) map.set(key, { empresa: t.empresa, proyecto: t.proyecto, moneda: t.moneda, ultima_fecha: t.fecha, ultima_tasa: t.tasa_cambio })
    }
    return Array.from(map.values())
  }, [tasas])

  // ── History for current group ─────────────────────────────────────────────
  const historialActual = useMemo(() =>
    viewTarget
      ? tasas
          .filter((t) => t.empresa === viewTarget.empresa && t.proyecto === viewTarget.proyecto && t.moneda === viewTarget.moneda)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))
      : [],
    [tasas, viewTarget])

  // ── Form derived state ────────────────────────────────────────────────────
  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa])

  const monedasDisponibles = useMemo(
    () => proyectoMonedas.filter((pm) => pm.empresa === form.empresa && pm.proyecto === form.proyecto && pm.activo === 1),
    [proyectoMonedas, form.empresa, form.proyecto])

  // ── f() helper ────────────────────────────────────────────────────────────
  function f(key: keyof TasaCambioForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((p) => ({ ...p, [key]: v }))
  }

  // ── Modal computed ────────────────────────────────────────────────────────
  const iconBadgeBg  = 'bg-teal-100'
  const iconBadgeClr = 'text-teal-600'
  const icon = isEditing
    ? <Plus className={`h-4 w-4 ${iconBadgeClr}`} />
    : <ArrowLeftRight className={`h-4 w-4 ${iconBadgeClr}`} />

  // ── Modal functions ───────────────────────────────────────────────────────
  function openView(grupo: TasaCambioGrupo) {
    setViewTarget(grupo)
    setIsEditing(false)
    setDialogOpen(true)
  }

  function openCreate(preload?: { empresa: number; proyecto: number; moneda: string }) {
    const firstEmpresa  = preload?.empresa  ?? empresas[0]?.codigo ?? 0
    const firstProyecto = preload?.proyecto ?? proyectos.filter((p) => p.empresa === firstEmpresa)[0]?.codigo ?? 0
    const firstMoneda   = preload?.moneda   ?? proyectoMonedas.find((pm) => pm.empresa === firstEmpresa && pm.proyecto === firstProyecto && pm.predeterminado === 1)?.moneda ?? proyectoMonedas.find((pm) => pm.empresa === firstEmpresa && pm.proyecto === firstProyecto && pm.activo === 1)?.moneda ?? ''
    setForm({
      ...EMPTY_FORM,
      empresa: firstEmpresa,
      proyecto: firstProyecto,
      moneda: firstMoneda,
      fecha: new Date().toISOString().slice(0, 10),
    })
    if (!preload) setViewTarget(null)
    setIsEditing(true)
    setDialogOpen(true)
  }

  function cancelCreate() {
    if (viewTarget) {
      setIsEditing(false) // go back to Ver mode
    } else {
      setDialogOpen(false) // close entirely
    }
  }

  function handleSave() {
    if (!form.tasa_cambio || Number(form.tasa_cambio) <= 0) {
      toast.error('La tasa de cambio debe ser mayor a cero.')
      return
    }
    const maxFecha = tasas
      .filter((t) => t.empresa === form.empresa && t.proyecto === form.proyecto && t.moneda === form.moneda)
      .map((t) => t.fecha)
      .sort()
      .at(-1)
    if (maxFecha && form.fecha <= maxFecha) {
      toast.error('La fecha debe ser posterior a la última tasa registrada para esta moneda.')
      return
    }
    startTransition(async () => {
      const result = await createTasaCambio(form)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Tasa de cambio registrada.')
        router.refresh()
        if (viewTarget) {
          setIsEditing(false) // go back to Ver mode
        } else {
          setDialogOpen(false)
        }
      }
    })
  }

  // ── Filter pipeline ───────────────────────────────────────────────────────
  const uniqueEmpresaNames  = useMemo(() => [...new Set(grupos.map((r) => empresaMap.get(r.empresa) ?? ''))].sort(), [grupos, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(grupos.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? ''))].sort(), [grupos, proyectoMap])
  const uniqueMonedaLabels  = useMemo(() => [...new Set(grupos.map((r) => r.moneda))].sort(), [grupos])

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? grupos : grupos.filter((r) =>
      (empresaMap.get(r.empresa) ?? '').toLowerCase().includes(q) ||
      (proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '').toLowerCase().includes(q) ||
      r.moneda.toLowerCase().includes(q)
    )
  }, [grupos, search, empresaMap, proyectoMap])

  const filtered = useMemo(() =>
    afterSearch.filter((r) =>
      Object.entries(colFilters).every(([col, vals]) => {
        if (col === 'empresa')      return vals.has(empresaMap.get(r.empresa) ?? '')
        if (col === 'proyecto')     return vals.has(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '')
        if (col === 'moneda')       return vals.has(r.moneda)
        if (col === 'ultima_fecha') return vals.has(formatDate(r.ultima_fecha))
        return vals.has(String(r[col as keyof TasaCambioGrupo] ?? ''))
      })
    ),
    [afterSearch, colFilters, empresaMap, proyectoMap])

  const hasActiveFilters = Object.keys(colFilters).length > 0
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ── Keyboard navigation ───────────────────────────────────────────────────
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

  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-100 p-2.5">
            <ArrowLeftRight className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Tasas de Cambio</h1>
            <p className="text-sm text-muted-foreground">Historial de tasas por proyecto y moneda</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button
            onClick={() => openCreate()}
            disabled={proyectos.length === 0}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Nueva Tasa
          </Button>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tasas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, colPrefs, empresaMap, proyectoMap)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={resetColPrefs} />
        </div>
      </div>

      {/* ── Table ── */}
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
              <TableHead className="sticky left-0 z-20 w-52 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Proyecto</span>
              </TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key} className={col.key === 'ultima_tasa' ? 'text-center' : ''}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'     ? uniqueEmpresaNames  :
                      col.key === 'moneda'      ? uniqueMonedaLabels  :
                      col.key === 'ultima_fecha' ? [...new Set(filtered.map((r) => formatDate(r.ultima_fecha)))].sort() : []
                    }
                    active={colFilters[col.key] ?? new Set()}
                    onChange={(v) => setColFilter(col.key, v)}
                  />
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-20 w-12 bg-muted/30" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + visibleCols.length} className="h-32 text-center text-muted-foreground">
                  {search || hasActiveFilters ? 'Sin resultados para los filtros actuales.' : 'No hay tasas de cambio registradas.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, idx) => {
                const isActive = cursorIdx === idx
                const proyectoNombre = proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? String(row.proyecto)
                return (
                  <TableRow
                    key={`${row.empresa}-${row.proyecto}-${row.moneda}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-teal-50 dark:bg-teal-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(idx)}
                    onDoubleClick={() => openView(row)}
                  >
                    {/* Sticky left — Proyecto */}
                    <TableCell className={`sticky left-0 z-10 w-52 font-medium ${isActive ? 'bg-teal-50 dark:bg-teal-950/30 border-l-[3px] border-l-teal-600 text-teal-700 dark:text-teal-400 font-semibold' : 'bg-card text-foreground group-hover:bg-muted/40'}`}>
                      {proyectoNombre}
                    </TableCell>

                    {/* Dynamic columns */}
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':
                          return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(row.empresa) ?? row.empresa}</TableCell>
                        case 'moneda': {
                          const flag = CURRENCY_FLAG_MAP.get(row.moneda)
                          return (
                            <TableCell key="moneda" className="text-muted-foreground">
                              {flag ? (
                                <span className="flex items-center gap-1.5">
                                  <img src={`https://flagcdn.com/w20/${flag}.png`} alt={row.moneda} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {row.moneda}
                                </span>
                              ) : row.moneda || '—'}
                            </TableCell>
                          )
                        }
                        case 'ultima_fecha':
                          return <TableCell key="ultima_fecha" className="text-muted-foreground font-mono text-xs">{formatDate(row.ultima_fecha)}</TableCell>
                        case 'ultima_tasa':
                          return <TableCell key="ultima_tasa" className="text-center text-muted-foreground font-mono text-xs">{Number(row.ultima_tasa).toFixed(8)}</TableCell>
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{String(row[col.key as keyof TasaCambioGrupo] ?? '')}</TableCell>
                      }
                    })}

                    {/* Sticky right — actions */}
                    <TableCell className={`sticky right-0 z-10 w-12 ${isActive ? 'bg-teal-50 dark:bg-teal-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openView(row) }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none opacity-0 group-hover:opacity-100"
                        title="Ver historial"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Modal (Ver + Nuevo) ── */}
      <Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
        if (!open && deleteTarget !== null) return
        setDialogOpen(open)
        if (!open) { setIsEditing(false); setViewTarget(null) }
      }}>
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-teal-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{icon}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing ? 'Nueva Tasa de Cambio' : 'Historial de Tasas'}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {empresaMap.get(viewTarget.empresa) ?? ''} · {proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''} · {viewTarget.moneda}
                    {(() => {
                      const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda)
                      return flag ? (
                        <img src={`https://flagcdn.com/w20/${flag}.png`} alt={viewTarget.moneda} width={16} height={11} className="inline ml-1 object-cover rounded-sm align-middle" />
                      ) : null
                    })()}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 px-1">

            {/* ── Ver mode — history list ── */}
            {!isEditing && viewTarget && (
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead><span className="text-xs font-medium text-muted-foreground">Fecha</span></TableHead>
                        <TableHead className="text-right"><span className="text-xs font-medium text-muted-foreground">Tasa</span></TableHead>
                        {puedeEliminar && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historialActual.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={puedeEliminar ? 3 : 2} className="h-20 text-center text-muted-foreground">
                            Sin historial.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historialActual.map((t) => (
                          <TableRow key={t.fecha} className="group">
                            <TableCell className="font-mono text-sm">{formatDate(t.fecha)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{Number(t.tasa_cambio).toFixed(8)}</TableCell>
                            {puedeEliminar && (
                              <TableCell className="w-10">
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(t)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-opacity"
                                  title="Eliminar tasa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── Nuevo mode — form ── */}
            {isEditing && (
              <div className="grid grid-cols-3 gap-4">

                {/* Empresa */}
                <div className="col-span-3 grid gap-1">
                  <Label htmlFor="empresa" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                  <Select
                    value={String(form.empresa)}
                    onValueChange={(v) => {
                      const emp = Number(v)
                      const firstProyecto = proyectos.filter((p) => p.empresa === emp)[0]?.codigo ?? 0
                      const firstMoneda   = proyectoMonedas.find((pm) => pm.empresa === emp && pm.proyecto === firstProyecto && pm.predeterminado === 1)?.moneda ?? proyectoMonedas.find((pm) => pm.empresa === emp && pm.proyecto === firstProyecto && pm.activo === 1)?.moneda ?? ''
                      setForm((p) => ({ ...p, empresa: emp, proyecto: firstProyecto, moneda: firstMoneda }))
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona empresa">
                        {(v: string) => v && v !== '0' ? (empresaMap.get(Number(v)) ?? v) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Proyecto */}
                <div className="col-span-3 grid gap-1">
                  <Label htmlFor="proyecto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                  <Select
                    value={String(form.proyecto)}
                    onValueChange={(v) => {
                      const proy = Number(v)
                      const firstMoneda = proyectoMonedas.find((pm) => pm.empresa === form.empresa && pm.proyecto === proy && pm.predeterminado === 1)?.moneda ?? proyectoMonedas.find((pm) => pm.empresa === form.empresa && pm.proyecto === proy && pm.activo === 1)?.moneda ?? ''
                      setForm((p) => ({ ...p, proyecto: proy, moneda: firstMoneda }))
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona proyecto">
                        {(v: string) => v && v !== '0' ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {proyectosFiltrados.map((p) => (
                        <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Moneda */}
                <div className="col-span-1 grid gap-1">
                  <Label htmlFor="moneda" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda *</Label>
                  <Select value={form.moneda} onValueChange={(v) => f('moneda', v)}>
                    <SelectTrigger className="w-full">
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
                      {monedasDisponibles.map((m) => {
                        const flag = CURRENCY_FLAG_MAP.get(m.moneda)
                        return (
                          <SelectItem key={m.moneda} value={m.moneda}>
                            <span className="flex items-center gap-2">
                              {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} alt={m.moneda} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                              {m.moneda}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Moneda / Fecha / Tasa — third width each */}
                <div className="col-span-1 grid gap-1">
                  <Label htmlFor="fecha" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Fecha *</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={form.fecha}
                    onChange={(e) => f('fecha', e.target.value)}
                  />
                </div>
                <div className="col-span-1 grid gap-1">
                  <Label htmlFor="tasa_cambio" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Tasa Cambio *</Label>
                  <Input
                    id="tasa_cambio"
                    type="number"
                    value={form.tasa_cambio}
                    onChange={(e) => setForm((p) => ({ ...p, tasa_cambio: e.target.value === '' ? '' : Number(e.target.value) }))}
                    placeholder="0.00000000"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

              </div>
            )}

          </div>

          {/* ── Footer ── */}
          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                {puedeAgregar && (
                  <Button
                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => openCreate({ empresa: viewTarget.empresa, proyecto: viewTarget.proyecto, moneda: viewTarget.moneda })}
                  >
                    <Plus className="h-3.5 w-3.5" /> Nueva Tasa
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cancelCreate}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
                <Button onClick={handleSave} disabled={isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                  {isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog — Delete tasa ── */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogTitle>¿Eliminar tasa?</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <div>
              Esta acción es permanente. ¿Eliminar la tasa del <strong>{deleteTarget ? formatDate(deleteTarget.fecha) : ''}</strong>{' '}
              ({deleteTarget?.moneda})?
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" />}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              render={<Button variant="destructive" />}
              onClick={async () => {
                if (!deleteTarget) return
                const result = await deleteTasaCambio(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.moneda, deleteTarget.fecha)
                if (result.error) toast.error(result.error)
                else { toast.success('Tasa eliminada.'); router.refresh() }
                setDeleteTarget(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
