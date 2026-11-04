'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil, Trash2, Plus, Search,
  History, Eye, Settings2, ChevronDown, ChevronUp, X, FileSpreadsheet, Download, Check, MapPin,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createSerieFactura, updateSerieFactura, deleteSerieFactura } from '@/app/actions/series-facturas'
import type { SerieFactura, SerieFacturaForm } from '@/lib/types/series-facturas'
import type { Empresa, Proyecto } from '@/lib/types/proyectos'
import type { Gface } from '@/lib/types/gface'
import { useCampoInvalido } from '@/lib/campo-invalido'

const SKIP_KEYS = new Set<keyof SerieFacturaForm>(['carpeta_dtes'])

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
              <Checkbox checked={active.has(v)} onCheckedChange={(checked: boolean) => { const next = new Set(active); if (checked) next.add(v); else next.delete(v); onChange(next) }} />
              <span className="truncate">{v || '(vacio)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

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

type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',          label: 'Empresa',         defaultVisible: false },
  { key: 'proyecto',         label: 'Proyecto',        defaultVisible: true  },
  { key: 'gface',            label: 'Gface',           defaultVisible: true  },
  { key: 'id_docto_gface',   label: 'Id Documento',    defaultVisible: false },
  { key: 'establecimiento',  label: 'Establecimiento', defaultVisible: true  },
  { key: 'dispositivo',      label: 'Dispositivo',     defaultVisible: true  },
  { key: 'carpeta_dtes',     label: 'Carpeta DTE',     defaultVisible: false },
  { key: 'formato',          label: 'Formato',         defaultVisible: true  },
  { key: 'predeterminado',   label: 'Predeterminado',  defaultVisible: true  },
  { key: 'activo',           label: 'Activo',          defaultVisible: true  },
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

function exportCsv(rows: SerieFactura[], colPrefs: ColPref[], cell: (row: SerieFactura, key: string) => string) {
  const keys = ['serie', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(cell(r, k))).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `series-facturas-${new Date().toISOString().slice(0, 10)}.csv`
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

const EMPTY_FORM: SerieFacturaForm = {
  empresa: 0,
  proyecto: 0,
  serie: '',
  gface: 0,
  id_docto_gface: null,
  establecimiento: 0,
  dispositivo: 0,
  carpeta_dtes: null,
  formato: 0,
  predeterminado: 0,
  activo: 1,
}

function enteroNoNegativo(raw: string): number {
  return Math.min(32767, Math.max(0, Number(raw) || 0))
}

function formDesde(row: SerieFactura): SerieFacturaForm {
  return {
    empresa: row.empresa,
    proyecto: row.proyecto,
    serie: row.serie,
    gface: row.gface,
    id_docto_gface: row.id_docto_gface,
    establecimiento: row.establecimiento,
    dispositivo: row.dispositivo,
    carpeta_dtes: row.carpeta_dtes,
    formato: row.formato,
    predeterminado: row.predeterminado,
    activo: row.activo,
  }
}

function mismoTexto(a: string | null, b: string | null) {
  return (a ?? '').trim() === (b ?? '').trim()
}

function nombreDeGface(map: Map<string, string>, empresa: number, proyecto: number, codigo: number) {
  if (!codigo) return ''
  return map.get(`${empresa}-${proyecto}-${codigo}`) ?? String(codigo)
}

export function SeriesFacturasClient({
  initialData,
  empresas,
  proyectos,
  gfaces,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: SerieFactura[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  gfaces: Gface[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { activeTab, setActiveTab, campoInvalido, rechazar, limpiarCampoInvalido } = useCampoInvalido()

  const [search, setSearch]             = useState('')
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [isEditing, setIsEditing]       = useState(false)
  const [hadConflict, setHadConflict]   = useState(false)
  const [viewTarget, setViewTarget]     = useState<SerieFactura | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerieFactura | null>(null)
  const [auditTarget, setAuditTarget]   = useState<SerieFactura | null>(null)
  const [form, setForm]                 = useState<SerieFacturaForm>(EMPTY_FORM)
  const [colFilters, setColFilters]     = useState<ColFilters>({})

  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const gfaceMap = useMemo(
    () => new Map(gfaces.map((g) => [`${g.empresa}-${g.proyecto}-${g.codigo}`, g.nombre])),
    [gfaces],
  )
  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )
  const gfacesFiltrados = useMemo(
    () => gfaces.filter((g) => g.empresa === form.empresa && g.proyecto === form.proyecto && g.codigo !== 0),
    [gfaces, form.empresa, form.proyecto],
  )

  function nombreGface(empresa: number, proyecto: number, codigo: number) {
    return nombreDeGface(gfaceMap, empresa, proyecto, codigo)
  }

  function primerGface(empresa: number, proyecto: number) {
    return gfaces.find((g) => g.empresa === empresa && g.proyecto === proyecto && g.codigo !== 0)?.codigo ?? 0
  }

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => { const u = { ...prev }; if (next.size === 0) delete u[col]; else u[col] = next; return u })
  }

  const uniqueEmpresaNames  = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa) ?? ''))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? ''))].sort(), [initialData, proyectoMap])
  const uniqueGfaceNames    = useMemo(() => [...new Set(initialData.map((r) => nombreDeGface(gfaceMap, r.empresa, r.proyecto, r.gface)))].sort(), [initialData, gfaceMap])
  const uniqueFormato       = useMemo(() => [...new Set(initialData.map((r) => String(r.formato)))].sort(), [initialData])
  const uniqueEstablecimiento = useMemo(() => [...new Set(initialData.map((r) => String(r.establecimiento)))].sort(), [initialData])
  const uniqueDispositivo   = useMemo(() => [...new Set(initialData.map((r) => String(r.dispositivo)))].sort(), [initialData])

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? initialData : initialData.filter((r) =>
      r.serie.toLowerCase().includes(q) ||
      (r.id_docto_gface ?? '').toLowerCase().includes(q) ||
      (r.carpeta_dtes ?? '').toLowerCase().includes(q) ||
      nombreDeGface(gfaceMap, r.empresa, r.proyecto, r.gface).toLowerCase().includes(q) ||
      (empresaMap.get(r.empresa) ?? '').toLowerCase().includes(q) ||
      (proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '').toLowerCase().includes(q)
    )
  }, [initialData, search, empresaMap, proyectoMap, gfaceMap])

  const filtered = useMemo(() =>
    afterSearch.filter((r) =>
      Object.entries(colFilters).every(([col, vals]) => {
        if (col === 'empresa')        return vals.has(empresaMap.get(r.empresa) ?? '')
        if (col === 'proyecto')       return vals.has(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '')
        if (col === 'gface')          return vals.has(nombreDeGface(gfaceMap, r.empresa, r.proyecto, r.gface))
        if (col === 'formato')        return vals.has(String(r.formato))
        if (col === 'establecimiento') return vals.has(String(r.establecimiento))
        if (col === 'dispositivo')    return vals.has(String(r.dispositivo))
        if (col === 'predeterminado') return vals.has(r.predeterminado === 1 ? 'Si' : 'No')
        if (col === 'activo')         return vals.has(r.activo === 1 ? 'Si' : 'No')
        return vals.has(String(r[col as keyof SerieFactura] ?? ''))
      })
    ),
    [afterSearch, colFilters, empresaMap, proyectoMap, gfaceMap]
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  const STORAGE_KEY = `series_facturas_cols_v1_${userId}`
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

  function f(key: keyof SerieFacturaForm, value: string | number | null) {
    limpiarCampoInvalido()
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const proyecto = proyectos.find((p) => p.empresa === Number(value))?.codigo ?? 0
        next.proyecto = proyecto
        next.gface = primerGface(Number(value), proyecto)
      }
      if (key === 'proyecto') {
        next.gface = primerGface(prev.empresa, Number(value))
      }
      return next
    })
  }

  function openCreate() {
    limpiarCampoInvalido()
    setActiveTab('general')
    setViewTarget(null)
    setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({
      ...EMPTY_FORM,
      empresa: firstEmpresa,
      proyecto: firstProyecto,
      gface: primerGface(firstEmpresa, firstProyecto),
    })
    setDialogOpen(true)
  }

  function openView(row: SerieFactura) {
    limpiarCampoInvalido()
    setActiveTab('general')
    setViewTarget(row)
    setIsEditing(false)
    setForm(formDesde(row))
    setDialogOpen(true)
  }

  function startEdit() {
    limpiarCampoInvalido()
    setActiveTab('general')
    if (viewTarget) setForm(formDesde(viewTarget))
    setIsEditing(true)
  }

  function cancelEdit() {
    limpiarCampoInvalido()
    setActiveTab('general')
    if (!viewTarget) { setDialogOpen(false); return }
    setIsEditing(false)
    setForm(formDesde(viewTarget))
  }

  function handleSave() {
    if (!form.serie.trim()) { rechazar('serie', 'La serie es requerida.'); return }
    if (!form.empresa) { rechazar('empresa', 'Selecciona la empresa.'); return }
    if (!form.proyecto) { rechazar('proyecto', 'Selecciona el proyecto.'); return }

    if (viewTarget) {
      const sinCambios =
        form.empresa === viewTarget.empresa &&
        form.proyecto === viewTarget.proyecto &&
        form.serie === viewTarget.serie &&
        form.gface === viewTarget.gface &&
        mismoTexto(form.id_docto_gface, viewTarget.id_docto_gface) &&
        form.establecimiento === viewTarget.establecimiento &&
        form.dispositivo === viewTarget.dispositivo &&
        mismoTexto(form.carpeta_dtes, viewTarget.carpeta_dtes) &&
        form.formato === viewTarget.formato &&
        form.predeterminado === viewTarget.predeterminado &&
        form.activo === viewTarget.activo
      if (sinCambios) { setDialogOpen(false); return }
    }

    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateSerieFactura(viewTarget.empresa, viewTarget.proyecto, viewTarget.serie, form, lastModified)
        : await createSerieFactura(form)
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
      const result = await deleteSerieFactura(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.serie)
      if (result.error) toast.error(result.error)
      else { toast.success('Serie eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  function csvCell(row: SerieFactura, key: string): string {
    if (key === 'empresa') return empresaMap.get(row.empresa) ?? ''
    if (key === 'proyecto') return proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? ''
    if (key === 'gface') return nombreGface(row.empresa, row.proyecto, row.gface)
    if (key === 'predeterminado' || key === 'activo') return row[key] === 1 ? 'Si' : 'No'
    const value = row[key as keyof SerieFactura]
    return value == null ? '' : String(value)
  }

  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100' : 'bg-neutral-100'
  const iconBadgeClr = isEditing && viewTarget ? 'text-amber-600' : 'text-neutral-600'
  const icon = !isEditing
    ? <FileSpreadsheet className={`h-4 w-4 ${iconBadgeClr}`} />
    : !viewTarget
      ? <Plus className={`h-4 w-4 ${iconBadgeClr}`} />
      : <Pencil className={`h-4 w-4 ${iconBadgeClr}`} />

  const subtitle = viewTarget
    ? [empresaMap.get(viewTarget.empresa), proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`)].filter(Boolean).join(' · ')
    : ''

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-neutral-100 p-2.5">
            <FileSpreadsheet className="h-5 w-5 text-neutral-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Series de Facturas</h1>
            <p className="text-sm text-muted-foreground">Catalogo de series de facturas por proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2 bg-neutral-600 text-white hover:bg-neutral-700" disabled={proyectos.length === 0}>
            <Plus className="h-4 w-4" />
            Nueva Serie
          </Button>
        )}
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea proyectos antes de agregar series de facturas.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            variant="l-border"
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
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, colPrefs, csvCell)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => saveColPrefs(DEFAULT_PREFS)} />
        </div>
      </div>

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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Serie</span>
              </TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa' ? uniqueEmpresaNames :
                      col.key === 'proyecto' ? uniqueProyectoNames :
                      col.key === 'gface' ? uniqueGfaceNames :
                      col.key === 'formato' ? uniqueFormato :
                      col.key === 'establecimiento' ? uniqueEstablecimiento :
                      col.key === 'dispositivo' ? uniqueDispositivo :
                      col.key === 'predeterminado' ? ['Si', 'No'] :
                      col.key === 'activo' ? ['Si', 'No'] :
                      [...new Set(initialData.map((r) => String(r[col.key as keyof SerieFactura] ?? '')))].sort()
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
                    : 'Todavia no hay series de facturas. Haz clic en "Nueva Serie" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${row.empresa}-${row.proyecto}-${row.serie}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-neutral-50 dark:bg-neutral-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(row)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-neutral-50 dark:bg-neutral-950/30 border-l-[3px] border-l-neutral-600 text-neutral-700 dark:text-neutral-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {row.serie}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':
                          return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(row.empresa) ?? ''}</TableCell>
                        case 'proyecto':
                          return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? ''}</TableCell>
                        case 'gface':
                          return <TableCell key="gface" className="text-muted-foreground">{nombreGface(row.empresa, row.proyecto, row.gface) || '—'}</TableCell>
                        case 'id_docto_gface':
                          return <TableCell key="id_docto_gface" className="font-mono text-xs text-muted-foreground">{row.id_docto_gface || '—'}</TableCell>
                        case 'establecimiento':
                          return <TableCell key="establecimiento" className="text-muted-foreground">{row.establecimiento}</TableCell>
                        case 'dispositivo':
                          return <TableCell key="dispositivo" className="text-muted-foreground">{row.dispositivo}</TableCell>
                        case 'carpeta_dtes':
                          return <TableCell key="carpeta_dtes" className="text-muted-foreground">{row.carpeta_dtes || '—'}</TableCell>
                        case 'formato':
                          return <TableCell key="formato" className="text-muted-foreground">{String(row.formato)}</TableCell>
                        case 'predeterminado':
                          return <TableCell key="predeterminado" className="text-muted-foreground">{row.predeterminado === 1 ? 'Si' : 'No'}</TableCell>
                        case 'activo':
                          return (
                            <TableCell key="activo">
                              <Badge variant="secondary" className={row.activo === 1 ? 'font-normal bg-emerald-100 text-emerald-700' : 'font-normal bg-muted text-muted-foreground'}>
                                {row.activo === 1 ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          )
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{String((row as Record<string, unknown>)[col.key] ?? '') || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-neutral-50 dark:bg-neutral-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <button
                        type="button"
                        onClick={() => openView(row)}
                        title={puedeModificar ? 'Ver / Editar' : 'Ver'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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

      <p className="text-xs text-muted-foreground">{filtered.length} serie{filtered.length !== 1 ? 's' : ''} de facturas</p>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && (deleteTarget !== null || auditTarget !== null)) return
          setDialogOpen(open)
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
        modal={false}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[64rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-neutral-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{icon}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nueva Serie de Facturas' : isEditing ? 'Editar Serie de Facturas' : viewTarget?.serie}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {subtitle}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.serie}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-0.5 flex flex-col flex-1 min-h-0">
            <div className="shrink-0 w-full">
              <TabsList variant="line" className="">
                <TabsTrigger value="general" className="gap-1.5 px-3 rounded-none bg-transparent border-b-2 border-b-transparent after:hidden data-active:border-b-primary data-active:text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                  General
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="IDENTIFICACION">
                      <div className="col-span-2"><ViewField locked label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? ''} /></div>
                      <div className="col-span-2"><ViewField locked label="Proyecto" value={proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''} /></div>
                      <div className="col-span-2"><ViewField locked label="Serie" value={viewTarget.serie} /></div>
                    </SegmentCard>
                    <SegmentCard label="CONFIGURACION">
                      <ViewField label="Formato" value={String(viewTarget.formato)} />
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox checked={viewTarget.predeterminado === 1} disabled />
                        <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Predeterminado</span>
                      </div>
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox checked={viewTarget.activo === 1} disabled />
                        <span className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Activo</span>
                      </div>
                    </SegmentCard>
                  </div>
                  <div className="w-px self-stretch bg-primary/30" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="DOCUMENTOS ELECTRONICOS">
                      <div className="col-span-2"><ViewField label="Gface" value={nombreGface(viewTarget.empresa, viewTarget.proyecto, viewTarget.gface) || 'Sin certificador'} /></div>
                      <div className="col-span-2"><ViewField label="Id Documento" value={viewTarget.id_docto_gface ?? ''} /></div>
                      <ViewField label="Establecimiento" value={String(viewTarget.establecimiento)} />
                      <ViewField label="Dispositivo" value={String(viewTarget.dispositivo)} />
                      <div className="col-span-2"><ViewField label="Carpeta DTE" value={viewTarget.carpeta_dtes ?? ''} /></div>
                    </SegmentCard>
                  </div>
                </div>
              ) : (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="IDENTIFICACION">
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="empresa" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Empresa *</Label>
                        <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                          <SelectTrigger variant="l-border" id="empresa" aria-invalid={campoInvalido?.id === 'empresa' || undefined} className="w-full">
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
                        <Label htmlFor="proyecto" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Proyecto *</Label>
                        <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))} disabled={!!viewTarget}>
                          <SelectTrigger variant="l-border" id="proyecto" aria-invalid={campoInvalido?.id === 'proyecto' || undefined} className="w-full">
                            <SelectValue placeholder="Selecciona proyecto">
                              {(v: string) => v && v !== '0' ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="serie" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Serie *</Label>
                        <Input
                          variant="l-border"
                          id="serie"
                          aria-invalid={campoInvalido?.id === 'serie' || undefined}
                          value={form.serie}
                          onChange={(e) => f('serie', e.target.value)}
                          placeholder="Ej: A, B, FAC1..."
                          disabled={!!viewTarget}
                          autoComplete="off"
                        />
                      </div>
                    </SegmentCard>
                    <SegmentCard label="CONFIGURACION">
                      <div className="col-span-2 grid grid-cols-2 gap-2 items-end">
                        <div className="grid gap-1">
                          <Label htmlFor="formato" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Formato</Label>
                          <Input
                            variant="l-border"
                            id="formato"
                            type="number"
                            min={0}
                            value={form.formato}
                            onChange={(e) => f('formato', enteroNoNegativo(e.target.value))}
                          />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                          <Checkbox
                            id="predeterminado"
                            checked={form.predeterminado === 1}
                            onCheckedChange={(checked) => f('predeterminado', checked ? 1 : 0)}
                          />
                          <Label htmlFor="predeterminado" className="font-semibold tracking-wider text-muted-foreground cursor-pointer" style={{ fontSize: 'var(--ui-form-label)' }}>Predeterminado</Label>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox
                          id="activo"
                          checked={form.activo === 1}
                          onCheckedChange={(checked) => f('activo', checked ? 1 : 0)}
                        />
                        <Label htmlFor="activo" className="font-semibold tracking-wider text-muted-foreground cursor-pointer" style={{ fontSize: 'var(--ui-form-label)' }}>Activo</Label>
                      </div>
                    </SegmentCard>
                  </div>
                  <div className="w-px self-stretch bg-primary/30" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="DOCUMENTOS ELECTRONICOS">
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="gface" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Gface</Label>
                        <Select value={String(form.gface)} onValueChange={(v) => f('gface', Number(v))}>
                          <SelectTrigger variant="l-border" id="gface" aria-invalid={campoInvalido?.id === 'gface' || undefined} className="w-full">
                            <SelectValue placeholder="Sin certificador">
                              {(v: string) => !v || v === '0' ? 'Sin certificador' : (gfaceMap.get(`${form.empresa}-${form.proyecto}-${Number(v)}`) ?? v)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sin certificador</SelectItem>
                            {gfacesFiltrados.map((g) => (
                              <SelectItem key={g.codigo} value={String(g.codigo)}>{g.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="id_docto_gface" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Id Documento</Label>
                        <Input
                          variant="l-border"
                          id="id_docto_gface"
                          value={form.id_docto_gface ?? ''}
                          onChange={(e) => f('id_docto_gface', e.target.value)}
                          placeholder="Identificador del documento"
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="establecimiento" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Establecimiento</Label>
                        <Input
                          variant="l-border"
                          id="establecimiento"
                          type="number"
                          min={0}
                          value={form.establecimiento}
                          onChange={(e) => f('establecimiento', enteroNoNegativo(e.target.value))}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="dispositivo" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Dispositivo</Label>
                        <Input
                          variant="l-border"
                          id="dispositivo"
                          type="number"
                          min={0}
                          value={form.dispositivo}
                          onChange={(e) => f('dispositivo', enteroNoNegativo(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="carpeta_dtes" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>Carpeta DTE</Label>
                        <Input
                          variant="l-border"
                          id="carpeta_dtes"
                          value={form.carpeta_dtes ?? ''}
                          onChange={(e) => f('carpeta_dtes', e.target.value)}
                          placeholder="Ruta de la carpeta"
                          autoComplete="off"
                        />
                      </div>
                    </SegmentCard>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <div className="flex w-full items-center gap-1">
                <Button variant="ghost" size="sm" className="hover:bg-neutral-50 dark:hover:bg-neutral-950/30" onClick={() => setAuditTarget(viewTarget)}>
                  <History className="mr-1.5 h-3.5 w-3.5" /> Historial
                </Button>
                {puedeEliminar && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(viewTarget)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
                {puedeModificar && (
                  <Button variant="ghost" size="sm" className="hover:bg-neutral-50 dark:hover:bg-neutral-950/30" onClick={startEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                )}
              </div>
            ) : viewTarget ? (
              <div className="flex w-full justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit} disabled={isPending}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            ) : (
              <div className="flex w-full justify-end">
                <Button variant="ghost" size="sm" className="hover:bg-neutral-50 dark:hover:bg-neutral-950/30" onClick={handleSave} disabled={isPending}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> {isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar serie de facturas?</AlertDialogTitle>
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

      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_serie_factura"
          cuenta={auditTarget.cuenta}
          registroId={{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, serie: auditTarget.serie }}
          titulo={`Serie ${auditTarget.serie}`}
        />
      )}
    </div>
  )
}
