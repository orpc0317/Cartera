'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Eye, Plus, IdCard, Search,
  History, ChevronDown, ChevronUp, X, Settings2, MapPin, Trash2, Download,
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
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { createTipoDocumento, updateTipoDocumento, deleteTipoDocumento } from '@/app/actions/tipos-documento'
import type { Empresa, Proyecto } from '@/lib/types/proyectos'
import type { TipoDocumento, TipoDocumentoForm } from '@/lib/types/tipos-documento'
import { jaroWinkler, toDbString } from '@/lib/utils'

// --- Column types -----------------------------------------------------------

type ColFilters = Record<string, Set<string>>
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

// --- Column definitions -----------------------------------------------------

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',     label: 'Empresa',     defaultVisible: false },
  { key: 'proyecto',    label: 'Proyecto',    defaultVisible: true  },
  { key: 'descripcion', label: 'Descripcion', defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// --- Empty form --------------------------------------------------------------

const EMPTY_FORM: TipoDocumentoForm = {
  empresa: 0,
  proyecto: 0,
  descripcion: '',
}

// --- CSV Export --------------------------------------------------------------

const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])
const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: 'codigo', label: 'Codigo' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function exportCsv(rows: TipoDocumento[], colPrefs: ColPref[]) {
  const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof TipoDocumento])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tipos-documento-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// --- Subcomponents -----------------------------------------------------------

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

// --- Props -------------------------------------------------------------------

interface Props {
  initialData: TipoDocumento[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

// --- Main component ----------------------------------------------------------

export function TiposDocumentoClient({
  initialData, empresas, proyectos,
  puedeAgregar, puedeModificar, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // -- Search & filters ---------------------------------------------------
  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})

  // -- Dialog state -------------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<TipoDocumento | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TipoDocumento | null>(null)
  const [auditTarget, setAuditTarget] = useState<TipoDocumento | null>(null)

  // -- Form ---------------------------------------------------------------
  const [form, setForm] = useState<TipoDocumentoForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<TipoDocumento[] | null>(null)

  // -- FK Maps ------------------------------------------------------------
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])

  // -- Proyectos por empresa (cascade) -----------------------------------
  const proyectosPorEmpresa = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  // -- Unique filter values -----------------------------------------------
  const uniqueEmpresaNames    = useMemo(() => [...new Set(initialData.map((t) => empresaMap.get(t.empresa) ?? String(t.empresa)))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames   = useMemo(() => [...new Set(initialData.map((t) => proyectoMap.get(`${t.empresa}-${t.proyecto}`) ?? String(t.proyecto)))].sort(), [initialData, proyectoMap])
  const uniqueDescripcionVals = useMemo(() => [...new Set(initialData.map((t) => t.descripcion).filter(Boolean))].sort(), [initialData])

  // -- Filter helpers -----------------------------------------------------
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const afterSearch = useMemo(() => initialData.filter((tipo) => {
    const q = search.toLowerCase()
    return !q ||
      tipo.descripcion?.toLowerCase().includes(q) ||
      String(tipo.codigo).includes(q)
  }), [initialData, search])

  const filtered = useMemo(() => afterSearch.filter((tipo) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa') return vals.has(String(tipo.empresa))
      if (col === 'proyecto') return vals.has(`${tipo.empresa}-${tipo.proyecto}`)
      return vals.has(String(tipo[col as keyof TipoDocumento] ?? ''))
    })
  ), [afterSearch, colFilters])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // -- Column preferences -------------------------------------------------
  const STORAGE_KEY = `tipos_documento_cols_v1_${userId}`
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

  function saveColPrefs(next: ColPref[]) { setColPrefs(next) }
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

  // -- Keyboard cursor ----------------------------------------------------
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

  // -- Form helper --------------------------------------------------------
  function f(key: keyof TipoDocumentoForm, value: string | number) {
    const v = typeof value === 'string'
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const fp = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = fp?.codigo ?? 0
      }
      return next
    })
  }

  function buildFormFromTipoDocumento(tipo: TipoDocumento): TipoDocumentoForm {
    return {
      empresa: tipo.empresa,
      proyecto: tipo.proyecto,
      descripcion: tipo.descripcion,
    }
  }

  // -- Dialog actions -----------------------------------------------------
  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setDialogOpen(true)
  }

  function openView(tipo: TipoDocumento) {
    setViewTarget(tipo)
    setForm(buildFormFromTipoDocumento(tipo))
    setIsEditing(false)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      setForm(buildFormFromTipoDocumento(viewTarget))
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  // -- Delete -------------------------------------------------------------
  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteTipoDocumento(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Tipo de documento eliminado.')
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  // -- Save ---------------------------------------------------------------
  function handleSave() {
    if (!form.descripcion.trim()) { toast.error('La descripcion es requerida.'); return }
    if (!form.empresa)            { toast.error('La empresa es requerida.'); return }
    if (!form.proyecto)           { toast.error('El proyecto es requerido.'); return }

    // Sin cambios: no ir a la base de datos
    if (viewTarget && JSON.stringify(form) === JSON.stringify(buildFormFromTipoDocumento(viewTarget))) {
      setDialogOpen(false); return
    }

    // Frontend similarity check (jaroWinkler >= 0.85)
    const normalizedInput = toDbString(form.descripcion)
    const candidates = initialData.filter((tipo) =>
      tipo.empresa === form.empresa && tipo.proyecto === form.proyecto &&
      (viewTarget ? tipo.codigo !== viewTarget.codigo : true)
    )
    const similar = candidates.filter(
      (tipo) => tipo.descripcion && jaroWinkler(normalizedInput, toDbString(tipo.descripcion)) >= 0.85
    )
    if (similar.length > 0) { setSimilarWarning(similar); return }

    doSave()
  }

  function doSave() {
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateTipoDocumento(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form.descripcion, lastModified)
        : await createTipoDocumento(form)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Tipo de documento actualizado.' : 'Tipo de documento creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // -- Dialog header derived state ----------------------------------------
  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100' : 'bg-slate-100'
  const iconEl = isEditing && viewTarget
    ? <Pencil className="h-4 w-4 text-amber-600" />
    : isEditing
      ? <Plus className="h-4 w-4 text-slate-600" />
      : <IdCard className="h-4 w-4 text-slate-600" />

  const dialogTitle = isEditing && !viewTarget
    ? 'Nuevo Tipo Documento'
    : isEditing
      ? 'Editar Tipo Documento'
      : (viewTarget?.descripcion ?? '')

  const dialogSubtitle = viewTarget
    ? `${empresaMap.get(viewTarget.empresa) ?? ''} / ${proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''}`
    : undefined

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* -- Header -- */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2.5">
            <IdCard className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Tipos Documento</h1>
            <p className="text-sm text-muted-foreground">Administra el catalogo de tipos de documento por proyecto</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          disabled={!puedeAgregar || proyectos.length === 0}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo Tipo Documento
        </Button>
      </div>

      {/* -- Warning: no projects -- */}
      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay proyectos disponibles. Crea un proyecto antes de agregar tipos de documento.
        </div>
      )}

      {/* -- Search + toolbar -- */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input variant="l-border"
            placeholder="Buscar tipos de documento..."
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

      {/* -- Table -- */}
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
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'     ? uniqueEmpresaNames    :
                      col.key === 'proyecto'    ? uniqueProyectoNames   :
                      col.key === 'descripcion' ? uniqueDescripcionVals : []
                    }
                    active={
                      col.key === 'empresa'  ? new Set([...(colFilters['empresa']  ?? new Set())].map((k) => empresaMap.get(Number(k)) ?? k)) :
                      col.key === 'proyecto' ? new Set([...(colFilters['proyecto'] ?? new Set())].map((k) => proyectoMap.get(k) ?? k)) :
                      colFilters[col.key] ?? new Set()
                    }
                    onChange={(vals) => {
                      if (col.key === 'empresa') {
                        const byLabel = new Map(empresas.map((e) => [e.nombre, String(e.codigo)]))
                        setColFilter('empresa', new Set([...vals].map((l) => byLabel.get(l) ?? l)))
                      } else if (col.key === 'proyecto') {
                        const byLabel = new Map(proyectos.map((p) => [p.nombre, `${p.empresa}-${p.codigo}`]))
                        setColFilter('proyecto', new Set([...vals].map((l) => byLabel.get(l) ?? l)))
                      } else {
                        setColFilter(col.key, vals)
                      }
                    }}
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
                    ? 'No se encontraron tipos de documento con ese criterio.'
                    : 'Todavia no hay tipos de documento. Haz clic en "Nuevo Tipo Documento" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tipo, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${tipo.empresa}-${tipo.proyecto}-${tipo.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-slate-50 dark:bg-slate-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(tipo)}
                  >
                    <TableCell className={`sticky left-0 z-10 w-20 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-slate-50 dark:bg-slate-950/30 border-l-[3px] border-l-slate-600 text-slate-700 dark:text-slate-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {tipo.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':
                          return (
                            <TableCell key="empresa" className="text-muted-foreground">
                              {empresaMap.get(tipo.empresa) ?? tipo.empresa}
                            </TableCell>
                          )
                        case 'proyecto':
                          return (
                            <TableCell key="proyecto" className="text-muted-foreground">
                              {proyectoMap.get(`${tipo.empresa}-${tipo.proyecto}`) ?? tipo.proyecto}
                            </TableCell>
                          )
                        case 'descripcion':
                          return <TableCell key="descripcion" className="font-medium">{tipo.descripcion}</TableCell>
                        default:
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {String(tipo[col.key as keyof TipoDocumento] ?? '')}
                            </TableCell>
                          )
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 w-12 transition-colors ${isActive ? 'bg-slate-50 dark:bg-slate-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(tipo)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(tipo)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(tipo)}
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

      <p className="text-xs text-muted-foreground">{filtered.length} tipo{filtered.length !== 1 ? 's' : ''} de documento</p>

      {/* -- CRUD Dialog -- */}
      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && similarWarning) return
          setDialogOpen(open)
          if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
        }}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-slate-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{iconEl}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {dialogTitle}
                </DialogTitle>
                {viewTarget && dialogSubtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {dialogSubtitle}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-0.5 flex flex-col flex-1 min-h-0">
            <div className="shrink-0 w-full"><TabsList variant="line" className="">
              <TabsTrigger value="general" className="gap-1.5 px-3 rounded-none bg-transparent border-b-2 border-b-transparent after:hidden data-active:border-b-primary data-active:text-primary">
                <MapPin className="h-3.5 w-3.5" /> General
              </TabsTrigger>
            </TabsList></div>

            <TabsContent value="general" className="mt-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">

              {/* -- View mode -- */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-2">
                  <SectionDivider label="Identificacion" />
                  <div className="col-span-2">
                    <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? String(viewTarget.empresa)} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Proyecto" value={proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? String(viewTarget.proyecto)} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                  </div>
                  <SectionDivider label="General" />
                  <div className="col-span-2">
                    <ViewField label="Descripcion" value={viewTarget.descripcion} />
                  </div>
                </div>
              ) : (

              /* -- Edit / Create mode -- */
              <div className="grid grid-cols-2 gap-2">
                <SectionDivider label="Identificacion" />

                {/* Empresa */}
                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="empresa" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
                    Empresa *
                  </Label>
                  <Select
                    value={form.empresa ? String(form.empresa) : ''}
                    onValueChange={(v) => f('empresa', Number(v))}
                    disabled={!!viewTarget}
                  >
                    <SelectTrigger variant="l-border" id="empresa" className="w-full">
                      <SelectValue placeholder="Selecciona empresa">
                        {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
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
                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="proyecto" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
                    Proyecto *
                  </Label>
                  <Select
                    value={form.proyecto ? String(form.proyecto) : ''}
                    onValueChange={(v) => f('proyecto', Number(v))}
                    disabled={!!viewTarget}
                  >
                    <SelectTrigger variant="l-border" id="proyecto" className="w-full">
                      <SelectValue placeholder="Selecciona proyecto">
                        {(v: string) => v ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {proyectosPorEmpresa.map((p) => (
                        <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <SectionDivider label="General" />

                {/* Descripcion */}
                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="descripcion" className="font-semibold tracking-wider text-muted-foreground" style={{ fontSize: 'var(--ui-form-label)' }}>
                    Descripcion *
                  </Label>
                  <Input variant="l-border"
                    id="descripcion"
                    value={form.descripcion}
                    onChange={(e) => f('descripcion', e.target.value)}
                    placeholder="Descripcion del tipo de documento"
                  />
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

      {/* -- Similar name warning -- */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => { if (!o) setSimilarWarning(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descripciones similares encontradas</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <div className="mb-2">
                Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} tipo
                {similarWarning && similarWarning.length > 1 ? 's' : ''} de documento con una descripcion muy parecida:
              </div>
              <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                {similarWarning?.map((t) => (
                  <li key={t.codigo}>{t.descripcion}</li>
                ))}
              </ul>
              <div>¿Es realmente un tipo de documento diferente y desea continuar?</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSimilarWarning(null); doSave() }}>
              Si, es diferente — Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -- Delete confirmation -- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de documento?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Esta accion no se puede deshacer. Se eliminara permanentemente el tipo de documento{' '}
              <strong>{deleteTarget?.descripcion}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -- Audit log dialog -- */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => { if (!o) setAuditTarget(null) }}
          tabla="t_tipo_documento"
          cuenta={auditTarget.cuenta}
          registroId={{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, codigo: auditTarget.codigo }}
          titulo={auditTarget.descripcion}
        />
      )}
    </div>
  )
}
