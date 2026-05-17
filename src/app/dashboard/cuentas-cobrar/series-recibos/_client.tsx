'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Trash2, Plus, Search,
  History, Eye, Settings2, ChevronDown, ChevronUp, X, Receipt, Download,
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createSerieRecibo, updateSerieRecibo, deleteSerieRecibo } from '@/app/actions/series-recibos'
import type { SerieRecibo, SerieReciboForm, Empresa, Proyecto, SerieFactura } from '@/lib/types/proyectos'

// ─── Constants ────────────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['serie_factura'])

// ─── Helpers ──────────────────────────────────────────────────────────────

type ColFilters = Record<string, Set<string>>

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
          {isFiltered && <button type="button" onClick={() => onChange(new Set())} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /> Limpiar</button>}
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
              <Checkbox checked={active.has(v)} onCheckedChange={(checked: boolean) => { const next = new Set(active); checked ? next.add(v) : next.delete(v); onChange(next) }} />
              <span className="truncate">{v || '(vacio)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">{label}</span>
      <div className="h-8 flex items-center rounded-lg bg-muted/50 border border-border/40 px-3">
        <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
      </div>
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

// ─── Column manager ────────────────────────────────────────────────────────

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',          label: 'Empresa',        defaultVisible: false },
  { key: 'proyecto',         label: 'Proyecto',       defaultVisible: true  },
  { key: 'recibo_automatico',label: 'Automatico',     defaultVisible: true  },
  { key: 'correlativo',      label: 'Correlativo',    defaultVisible: false },
  { key: 'predeterminado',   label: 'Predeterminado', defaultVisible: true  },
  { key: 'formato',          label: 'Formato',        defaultVisible: true  },
  { key: 'serie_factura',    label: 'Serie Factura',  defaultVisible: true  },
  { key: 'dias_fecha',       label: 'Dias Fecha',     defaultVisible: false },
  { key: 'activo',           label: 'Activo',         defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])

const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: 'serie', label: 'Serie' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function exportCsv(rows: SerieRecibo[], colPrefs: ColPref[]) {
  const keys = ['serie', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof SerieRecibo])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `series-recibos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
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

// ─── Form default ──────────────────────────────────────────────────────────

const EMPTY_FORM: SerieReciboForm = {
  empresa: 0,
  proyecto: 0,
  serie: '',
  serie_factura: null,
  dias_fecha: 0,
  correlativo: 0,
  formato: 0,
  predeterminado: 0,
  recibo_automatico: 0,
  activo: 1,
}

// ─── Client component ──────────────────────────────────────────────────────

export function SeriesRecibosClient({
  initialData,
  empresas,
  proyectos,
  seriesFactura,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: SerieRecibo[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  seriesFactura: SerieFactura[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch]             = useState('')
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [isEditing, setIsEditing]       = useState(false)
  const [hadConflict, setHadConflict]   = useState(false)
  const [viewTarget, setViewTarget]     = useState<SerieRecibo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerieRecibo | null>(null)
  const [auditTarget, setAuditTarget]   = useState<SerieRecibo | null>(null)
  const [form, setForm]                 = useState<SerieReciboForm>(EMPTY_FORM)
  const [colFilters, setColFilters]     = useState<ColFilters>({})

  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa]
  )
  const seriesFacturaFiltradas = useMemo(
    () => seriesFactura.filter((sf) => sf.empresa === form.empresa && sf.proyecto === form.proyecto),
    [seriesFactura, form.empresa, form.proyecto]
  )

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => { const u = { ...prev }; if (next.size === 0) delete u[col]; else u[col] = next; return u })
  }

  const uniqueEmpresaNames   = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa) ?? ''))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames  = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? ''))].sort(), [initialData, proyectoMap])
  const uniqueFormatoNames   = useMemo(() => [...new Set(initialData.map((r) => String(r.formato)))].sort(), [initialData])

  // ─── Filtering pipeline ──────────────────────────────────────────────────

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? initialData : initialData.filter((r) =>
      r.serie.toLowerCase().includes(q) ||
      (r.serie_factura ?? '').toLowerCase().includes(q) ||
      (empresaMap.get(r.empresa) ?? '').toLowerCase().includes(q) ||
      (proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '').toLowerCase().includes(q)
    )
  }, [initialData, search, empresaMap, proyectoMap])

  const filtered = useMemo(() =>
    afterSearch.filter((r) =>
      Object.entries(colFilters).every(([col, vals]) => {
        if (col === 'empresa')        return vals.has(empresaMap.get(r.empresa) ?? '')
        if (col === 'proyecto')       return vals.has(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '')
        if (col === 'formato')        return vals.has(String(r.formato))
        if (col === 'predeterminado')    return vals.has(r.predeterminado === 1 ? 'Si' : 'No')
        if (col === 'recibo_automatico') return vals.has(r.recibo_automatico === 1 ? 'Si' : 'No')
        if (col === 'activo')         return vals.has(r.activo === 1 ? 'Si' : 'No')
        return vals.has(String(r[col as keyof SerieRecibo] ?? ''))
      })
    ),
    [afterSearch, colFilters, empresaMap, proyectoMap]
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ─── Column prefs ────────────────────────────────────────────────────────

  const STORAGE_KEY = `series_recibos_cols_v2_${userId}`
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
    if (idx < 0) return
    const next = [...colPrefs]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    saveColPrefs(next)
  }
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ─── Keyboard navigation ─────────────────────────────────────────────────

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

  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  // ─── Form helpers ────────────────────────────────────────────────────────

  function f(key: keyof SerieReciboForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const fp = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = fp?.codigo ?? 0
        next.serie_factura = null
      }
      if (key === 'proyecto') {
        next.serie_factura = null
      }
      return next
    })
  }

  function openCreate() {
    setViewTarget(null); setIsEditing(true)
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setDialogOpen(true)
  }

  function openView(row: SerieRecibo) {
    setViewTarget(row); setIsEditing(false)
    setForm({
      empresa: row.empresa,
      proyecto: row.proyecto,
      serie: row.serie,
      serie_factura: row.serie_factura ?? null,
      dias_fecha: row.dias_fecha,
      correlativo: row.correlativo,
      formato: row.formato,
      predeterminado: row.predeterminado,
      recibo_automatico: row.recibo_automatico,
      activo: row.activo,
    })
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (!viewTarget) { setDialogOpen(false); return }
    setIsEditing(false)
    setForm({
      empresa: viewTarget.empresa,
      proyecto: viewTarget.proyecto,
      serie: viewTarget.serie,
      serie_factura: viewTarget.serie_factura ?? null,
      dias_fecha: viewTarget.dias_fecha,
      correlativo: viewTarget.correlativo,
      formato: viewTarget.formato,
      predeterminado: viewTarget.predeterminado,
      recibo_automatico: viewTarget.recibo_automatico,
      activo: viewTarget.activo,
    })
  }

  function handleSave() {
    if (!form.serie.trim()) { toast.error('La serie es requerida.'); return }
    if (!form.empresa)  { toast.error('Selecciona la empresa.'); return }
    if (!form.proyecto) { toast.error('Selecciona el proyecto.'); return }

    // Sin cambios: no ir a la base de datos
    if (viewTarget) {
      const sinCambios =
        form.empresa          === viewTarget.empresa          &&
        form.proyecto         === viewTarget.proyecto         &&
        form.serie            === viewTarget.serie            &&
        form.serie_factura    === (viewTarget.serie_factura ?? null) &&
        form.dias_fecha       === viewTarget.dias_fecha       &&
        form.correlativo      === viewTarget.correlativo      &&
        form.formato          === viewTarget.formato          &&
        form.predeterminado   === viewTarget.predeterminado   &&
        form.recibo_automatico === viewTarget.recibo_automatico &&
        form.activo           === viewTarget.activo
      if (sinCambios) { setDialogOpen(false); return }
    }

    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateSerieRecibo(viewTarget.empresa, viewTarget.proyecto, viewTarget.serie, form, lastModified)
        : await createSerieRecibo(form)
      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Serie actualizada.' : 'Serie creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteSerieRecibo(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.serie)
      if (result.error) toast.error(result.error)
      else { toast.success('Serie eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-green-100 p-2.5">
            <Receipt className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Series de Recibos</h1>
            <p className="text-sm text-muted-foreground">Catalogo de series de recibos por proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2" disabled={proyectos.length === 0}>
            <Plus className="h-4 w-4" />
            Nueva Serie
          </Button>
        )}
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea proyectos antes de agregar series de recibos.
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar series..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, colPrefs)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => saveColPrefs(DEFAULT_PREFS)} />
        </div>
      </div>

      {/* Table */}
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30"><span className="text-xs font-medium text-muted-foreground">Serie</span></TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'        ? uniqueEmpresaNames :
                      col.key === 'proyecto'       ? uniqueProyectoNames :
                      col.key === 'formato'        ? uniqueFormatoNames :
                      col.key === 'predeterminado'    ? ['Si', 'No'] :
                      col.key === 'recibo_automatico' ? ['Si', 'No'] :
                      col.key === 'activo'         ? ['Si', 'No'] :
                      [...new Set(initialData.map((r) => String(r[col.key as keyof SerieRecibo] ?? '')))].sort()
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
                <TableCell colSpan={visibleCols.length + 2} className="py-16 text-center text-muted-foreground">
                  {search || hasActiveFilters
                    ? 'No se encontraron series con ese criterio.'
                    : 'Todavia no hay series de recibos. Haz clic en "Nueva Serie" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${row.empresa}-${row.proyecto}-${row.serie}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(row)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-green-50 dark:bg-green-950/30 border-l-[3px] border-l-green-600 text-green-700 dark:text-green-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {row.serie}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':        return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(row.empresa) ?? `#${row.empresa}`}</TableCell>
                        case 'proyecto':       return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? `#${row.proyecto}`}</TableCell>
                        case 'serie_factura':  return <TableCell key="serie_factura" className="font-mono text-xs text-muted-foreground">{row.serie_factura || '—'}</TableCell>
                        case 'dias_fecha':     return <TableCell key="dias_fecha" className="text-muted-foreground">{row.dias_fecha}</TableCell>
                        case 'correlativo':    return <TableCell key="correlativo" className="text-muted-foreground">{row.correlativo || ''}</TableCell>
                        case 'formato':        return <TableCell key="formato" className="text-muted-foreground">{String(row.formato)}</TableCell>
                        case 'predeterminado':    return <TableCell key="predeterminado" className="text-muted-foreground">{row.predeterminado === 1 ? 'Si' : 'No'}</TableCell>
                        case 'recibo_automatico': return <TableCell key="recibo_automatico" className="text-muted-foreground">{row.recibo_automatico === 1 ? 'Si' : 'No'}</TableCell>
                        case 'activo':         return <TableCell key="activo"><Badge variant="secondary" className={row.activo === 1 ? 'font-normal bg-emerald-100 text-emerald-700' : 'font-normal bg-muted text-muted-foreground'}>{row.activo === 1 ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                        default:               return <TableCell key={col.key} className="text-muted-foreground">{String((row as Record<string, unknown>)[col.key] ?? '') || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-green-50 dark:bg-green-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(row)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(row)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(row)}>
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

      {/* Ver / Crear / Editar Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
        modal={false}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-green-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${isEditing && !viewTarget ? 'bg-green-100' : isEditing ? 'bg-amber-100' : 'bg-green-100'}`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-5 w-5 text-green-600" />
                  : isEditing
                  ? <Pencil className="h-5 w-5 text-amber-600" />
                  : <Receipt className="h-5 w-5 text-green-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nueva Serie de Recibos' : isEditing ? 'Editar Serie de Recibos' : viewTarget?.serie}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.serie}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                /* ── View mode ── */
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2"><ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? `#${viewTarget.proyecto}`} /></div>
                  <div className="col-span-2"><ViewField label="Serie"    value={viewTarget.serie} /></div>
                  <SectionDivider label="CONFIGURACION" />
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={viewTarget.recibo_automatico === 1} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Recibo Automatico</span>
                    </div>
                    <ViewField label="Correlativo" value={viewTarget.correlativo ? String(viewTarget.correlativo) : ''} />
                    <ViewField label="Formato" value={String(viewTarget.formato)} />
                  </div>
                  <ViewField label="Dias Fecha" value={String(viewTarget.dias_fecha)} />
                  <ViewField label="Serie Factura" value={viewTarget.serie_factura || '—'} />
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox checked={viewTarget.predeterminado === 1} disabled />
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Predeterminado</span>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox checked={viewTarget.activo === 1} disabled />
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Activo</span>
                  </div>
                </div>
              ) : (
                /* ── Edit / Create mode ── */
                <div className="grid grid-cols-2 gap-4">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona empresa">
                          {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                    <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona proyecto">
                          {(v: string) => v ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="serie" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Serie *</Label>
                    <Input
                      id="serie"
                      value={form.serie}
                      onChange={(e) => f('serie', e.target.value)}
                      placeholder="Ej: A, B, REC1..."
                      disabled={!!viewTarget}
                      autoComplete="off"
                    />
                  </div>
                  <SectionDivider label="CONFIGURACION" />
                  <div className="col-span-2 grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/50 px-3 py-2.5">
                      <Checkbox
                        id="recibo_automatico"
                        checked={form.recibo_automatico === 1}
                        onCheckedChange={(checked) => f('recibo_automatico', checked ? 1 : 0)}
                      />
                      <Label htmlFor="recibo_automatico" className="text-[11px] font-semibold tracking-wider text-muted-foreground cursor-pointer">Recibo Automatico</Label>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="correlativo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Correlativo</Label>
                      <Input
                        id="correlativo"
                        type="number"
                        min={0}
                        value={form.recibo_automatico === 1 ? '' : (form.correlativo || '')}
                        onChange={(e) => f('correlativo', Math.max(0, Number(e.target.value) || 0))}
                        disabled={form.recibo_automatico === 1}
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="formato" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Formato</Label>
                      <Input
                        id="formato"
                        type="number"
                        min={0}
                        value={form.formato}
                        onChange={(e) => f('formato', Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="dias_fecha" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Dias Fecha</Label>
                    <Input
                      id="dias_fecha"
                      type="number"
                      min={0}
                      value={form.dias_fecha}
                      onChange={(e) => f('dias_fecha', Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Serie Factura</Label>
                    <Select
                      value={form.serie_factura ?? ''}
                      onValueChange={(v) => setForm((p) => ({ ...p, serie_factura: v || null }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=""> </SelectItem>
                        {seriesFacturaFiltradas.map((sf) => (
                          <SelectItem key={sf.serie} value={sf.serie}>{sf.serie}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      id="predeterminado"
                      checked={form.predeterminado === 1}
                      onCheckedChange={(checked) => f('predeterminado', checked ? 1 : 0)}
                    />
                    <Label htmlFor="predeterminado" className="text-[11px] font-semibold tracking-wider text-muted-foreground cursor-pointer">Predeterminado</Label>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      id="activo"
                      checked={form.activo === 1}
                      onCheckedChange={(checked) => f('activo', checked ? 1 : 0)}
                    />
                    <Label htmlFor="activo" className="text-[11px] font-semibold tracking-wider text-muted-foreground cursor-pointer">Activo</Label>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                {puedeModificar && (
                  <Button onClick={startEdit} className="gap-2">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                )}
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

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar serie de recibos?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Esta accion no se puede deshacer. Se eliminara permanentemente la serie <strong>{deleteTarget?.serie}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit Log */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_serie_recibo"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.serie}
          titulo={`Serie ${auditTarget.serie}`}
        />
      )}
    </div>
  )
}
