'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Eye, Plus, Layers, Search,
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
import { createFase, updateFase, deleteFase } from '@/app/actions/fases'
import type { Empresa, Proyecto, Fase, FaseForm } from '@/lib/types/proyectos'
import { jaroWinkler, toDbString } from '@/lib/utils'

// ─── Column types ───────────────────────────────────────────────────────────

type ColFilters = Record<string, Set<string>>
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

// ─── Column definitions ─────────────────────────────────────────────────────

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',  label: 'Empresa',  defaultVisible: false },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: true  },
  { key: 'nombre',   label: 'Nombre',   defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// ─── Empty form ──────────────────────────────────────────────────────────────

const EMPTY_FORM: FaseForm = {
  empresa: 0,
  proyecto: 0,
  codigo: 0,
  nombre: '',
  medida: '',
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

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

function exportCsv(rows: Fase[], colPrefs: ColPref[]) {
  const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof Fase])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fases-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value ?? '—'}</span>
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

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  initialData: Fase[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

// ─── Main component ──────────────────────────────────────────────────────────

export function FasesClient({
  initialData, empresas, proyectos,
  puedeAgregar, puedeModificar, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Search & filters ───────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})

  // ── Dialog state ───────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<Fase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Fase | null>(null)
  const [auditTarget, setAuditTarget] = useState<Fase | null>(null)

  // ── Form ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FaseForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Fase[] | null>(null)

  // ── FK Maps ────────────────────────────────────────────────────────────
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])

  // ── Proyectos por empresa (cascade) ───────────────────────────────────
  const proyectosPorEmpresa = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  // ── Filter helpers ─────────────────────────────────────────────────────
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const afterSearch = useMemo(() => initialData.filter((fase) => {
    const q = search.toLowerCase()
    return !q ||
      fase.nombre?.toLowerCase().includes(q) ||
      String(fase.codigo).includes(q)
  }), [initialData, search])

  const filtered = useMemo(() => afterSearch.filter((fase) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa') return vals.has(String(fase.empresa))
      if (col === 'proyecto') return vals.has(String(fase.proyecto))
      return vals.has(String(fase[col as keyof Fase] ?? ''))
    })
  ), [afterSearch, colFilters])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ── Column preferences ─────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const STORAGE_KEY = `fases_cols_v1_${userId}`
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

  // ── Keyboard cursor ────────────────────────────────────────────────────
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

  // ── Form helper ────────────────────────────────────────────────────────
  function f(key: keyof FaseForm, value: string | number) {
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

  function buildFormFromFase(fase: Fase): FaseForm {
    return {
      empresa: fase.empresa,
      proyecto: fase.proyecto,
      codigo: fase.codigo,
      nombre: fase.nombre,
      medida: fase.medida ?? '',
    }
  }

  // ── Dialog actions ─────────────────────────────────────────────────────
  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setDialogOpen(true)
  }

  function openView(fase: Fase) {
    setViewTarget(fase)
    setForm(buildFormFromFase(fase))
    setIsEditing(false)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      setForm(buildFormFromFase(viewTarget))
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteFase(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Fase eliminada.')
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  // ── Save ───────────────────────────────────────────────────────────────
  function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return }
    if (!form.empresa)       { toast.error('La empresa es requerida.'); return }
    if (!form.proyecto)      { toast.error('El proyecto es requerido.'); return }

    // Frontend similarity check (jaroWinkler >= 0.85)
    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((fase) =>
      fase.empresa === form.empresa && fase.proyecto === form.proyecto &&
      (viewTarget ? fase.codigo !== viewTarget.codigo : true)
    )
    const similar = candidates.filter(
      (fase) => fase.nombre && jaroWinkler(normalizedInput, toDbString(fase.nombre)) >= 0.85
    )
    if (similar.length > 0) { setSimilarWarning(similar); return }

    doSave()
  }

  function doSave() {
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateFase(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form.nombre, lastModified)
        : await createFase(form)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Fase actualizada.' : 'Fase creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // ── Dialog header derived state ────────────────────────────────────────
  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100' : 'bg-violet-100'
  const iconEl = isEditing && viewTarget
    ? <Pencil className="h-4 w-4 text-amber-600" />
    : isEditing
      ? <Plus className="h-4 w-4 text-violet-600" />
      : <Layers className="h-4 w-4 text-violet-600" />

  const dialogTitle = isEditing && !viewTarget
    ? 'Nueva Fase'
    : isEditing
      ? 'Editar Fase'
      : (viewTarget?.nombre ?? '')

  const dialogSubtitle = viewTarget
    ? `${empresaMap.get(viewTarget.empresa) ?? ''} / ${proyectoMap.get(viewTarget.proyecto) ?? ''}`
    : undefined

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2.5">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Fases</h1>
            <p className="text-sm text-muted-foreground">Administra las fases por proyecto</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          disabled={!puedeAgregar || proyectos.length === 0}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva Fase
        </Button>
      </div>

      {/* ── Warning: no projects ── */}
      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay proyectos disponibles. Crea un proyecto antes de agregar fases.
        </div>
      )}

      {/* ── Search + toolbar ── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar fases..."
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Codigo</TableHead>
              {visibleCols.map((col) => {
                if (col.key === 'empresa') {
                  return (
                    <TableHead key="empresa">
                      <ColumnFilter
                        label="Empresa"
                        values={[...new Set(initialData.map((f) => empresaMap.get(f.empresa) ?? String(f.empresa)))].sort()}
                        active={new Set([...(colFilters['empresa'] ?? new Set())].map((k) => empresaMap.get(Number(k)) ?? k))}
                        onChange={(labels) => {
                          const byLabel = new Map(empresas.map((e) => [e.nombre, String(e.codigo)]))
                          setColFilter('empresa', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                if (col.key === 'proyecto') {
                  return (
                    <TableHead key="proyecto">
                      <ColumnFilter
                        label="Proyecto"
                        values={[...new Set(initialData.map((f) => proyectoMap.get(f.proyecto) ?? String(f.proyecto)))].sort()}
                        active={new Set([...(colFilters['proyecto'] ?? new Set())].map((k) => proyectoMap.get(Number(k)) ?? k))}
                        onChange={(labels) => {
                          const byLabel = new Map(proyectos.map((p) => [p.nombre, String(p.codigo)]))
                          setColFilter('proyecto', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                return <TableHead key={col.key}>{col.label}</TableHead>
              })}
              <TableHead className="sticky right-0 z-20 w-12 bg-muted/30" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length + 2} className="py-16 text-center text-muted-foreground">
                  {search || hasActiveFilters
                    ? 'No se encontraron fases con ese criterio.'
                    : 'Todavía no hay fases. Haz clic en "Nueva Fase" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((fase, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${fase.empresa}-${fase.proyecto}-${fase.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(fase)}
                  >
                    <TableCell className={`sticky left-0 z-10 w-20 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-violet-50 dark:bg-violet-950/30 border-l-[3px] border-l-violet-600 text-violet-700 dark:text-violet-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {fase.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':
                          return (
                            <TableCell key="empresa" className="text-muted-foreground">
                              {empresaMap.get(fase.empresa) ?? fase.empresa}
                            </TableCell>
                          )
                        case 'proyecto':
                          return (
                            <TableCell key="proyecto" className="text-muted-foreground">
                              {proyectoMap.get(fase.proyecto) ?? fase.proyecto}
                            </TableCell>
                          )
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{fase.nombre}</TableCell>
                        default:
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {String(fase[col.key as keyof Fase] ?? '')}
                            </TableCell>
                          )
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 w-12 transition-colors ${isActive ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(fase)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(fase)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(fase)}
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

      {/* ── CRUD Dialog ── */}
      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
        }}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">

          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-violet-50/70 to-transparent border-b border-border/50 shrink-0">
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

          <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">

              {/* ── View mode ── */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="Identificacion" />
                  <div className="col-span-2">
                    <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? String(viewTarget.empresa)} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? String(viewTarget.proyecto)} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                  </div>
                  <SectionDivider label="General" />
                  <div className="col-span-2">
                    <ViewField label="Nombre" value={viewTarget.nombre} />
                  </div>
                </div>
              ) : (

              /* ── Edit / Create mode ── */
              <div className="grid grid-cols-2 gap-4">
                <SectionDivider label="Identificacion" />

                {/* Empresa */}
                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="empresa" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                    Empresa *
                  </Label>
                  <Select
                    value={form.empresa ? String(form.empresa) : ''}
                    onValueChange={(v) => f('empresa', Number(v))}
                    disabled={!!viewTarget}
                  >
                    <SelectTrigger id="empresa">
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
                  <Label htmlFor="proyecto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                    Proyecto *
                  </Label>
                  <Select
                    value={form.proyecto ? String(form.proyecto) : ''}
                    onValueChange={(v) => f('proyecto', Number(v))}
                    disabled={!!viewTarget}
                  >
                    <SelectTrigger id="proyecto">
                      <SelectValue placeholder="Selecciona proyecto">
                        {(v: string) => v ? (proyectoMap.get(Number(v)) ?? v) : null}
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

                {/* Nombre */}
                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                    Nombre *
                  </Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => f('nombre', e.target.value)}
                    placeholder="Nombre de la fase"
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

      {/* ── Similar name warning ── */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => { if (!o) setSimilarWarning(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} fase
                  {similarWarning && similarWarning.length > 1 ? 's' : ''} con un nombre muy parecido:
                </p>
                <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                  {similarWarning?.map((f) => (
                    <li key={f.codigo}>{f.nombre}</li>
                  ))}
                </ul>
                <p>¿Es realmente una fase diferente y desea continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSimilarWarning(null); doSave() }}>
              Sí, es diferente — Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar fase?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la fase{' '}
              <strong>{deleteTarget?.nombre}</strong>.
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

      {/* ── Audit log dialog ── */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => { if (!o) setAuditTarget(null) }}
          tabla="t_fase"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
