'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Eye, Plus, Banknote, Search,
  History, ChevronDown, ChevronUp, X, Settings2, MapPin, Trash2, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import {
  createCobrador, updateCobrador, deleteCobrador,
} from '@/app/actions/cobradores'
import type { Cobrador, CobradorForm, Empresa, Proyecto } from '@/lib/types/proyectos'
import { jaroWinkler, toDbString } from '@/lib/utils'

// ─── Hardcoded maps ────────────────────────────────────────────────────────

const ACTIVO_LABELS: Record<number, string> = { 0: 'Inactivo', 1: 'Activo' }

// ─── Columnas ──────────────────────────────────────────────────────────────

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }
type ColFilters = Record<string, Set<string>>

const ALL_COLUMNS: ColDef[] = [
  { key: '__empresa',  label: 'Empresa',  defaultVisible: false },
  { key: '__proyecto', label: 'Proyecto', defaultVisible: true  },
  { key: 'nombre',     label: 'Nombre',   defaultVisible: true  },
  { key: '__activo',   label: 'Activo',   defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

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

function exportCsv(
  rows: Cobrador[], colPrefs: ColPref[],
  empresaMap: Map<number, string>, proyectoMap: Map<number, string>
) {
  const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => {
      if (k === '__empresa')  return formatCsvCell(empresaMap.get(r.empresa)  ?? r.empresa)
      if (k === '__proyecto') return formatCsvCell(proyectoMap.get(r.proyecto) ?? r.proyecto)
      if (k === '__activo')   return formatCsvCell(r.activo === 1 ? 'Activo' : 'Inactivo')
      return formatCsvCell(r[k as keyof Cobrador])
    }).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cobradores-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Formulario vacío ──────────────────────────────────────────────────────

const EMPTY_FORM: CobradorForm = {
  empresa: 0,
  proyecto: 0,
  codigo: 0,
  nombre: '',
  activo: 1,
}

// ─── Subcomponentes ────────────────────────────────────────────────────────

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || '—'}</span>
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
            if (!col) return null
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
  initialData: Cobrador[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

// ─── Componente principal ──────────────────────────────────────────────────

export function CobradoresClient({
  initialData, empresas, proyectos,
  puedeAgregar, puedeModificar, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Estado de tabla ───────────────────────────────────────────────────
  const [search, setSearch]             = useState('')
  const [colFilters, setColFilters]     = useState<ColFilters>({})
  const [deleteTarget, setDeleteTarget] = useState<Cobrador | null>(null)
  const [auditTarget, setAuditTarget]   = useState<Cobrador | null>(null)

  // ── Estado de modal ───────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [viewTarget, setViewTarget]     = useState<Cobrador | null>(null)
  const [isEditing, setIsEditing]       = useState(false)
  const [hadConflict, setHadConflict]   = useState(false)
  const [form, setForm]                 = useState<CobradorForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Cobrador[] | null>(null)

  // ── Mapas derivados ───────────────────────────────────────────────────
  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const proyectosPorEmpresa = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  // ── Filtrado ──────────────────────────────────────────────────────────
  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return initialData
    return initialData.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      (empresaMap.get(c.empresa) ?? '').toLowerCase().includes(q) ||
      (proyectoMap.get(c.proyecto) ?? '').toLowerCase().includes(q)
    )
  }, [initialData, search, empresaMap, proyectoMap])

  const filtered = useMemo(() => afterSearch.filter((c) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (vals.size === 0) return true
      if (col === '__activo')   return vals.has(String(c.activo))
      if (col === '__empresa')  return vals.has(empresaMap.get(c.empresa) ?? '')
      if (col === '__proyecto') return vals.has(proyectoMap.get(c.proyecto) ?? '')
      return vals.has(String(c[col as keyof Cobrador] ?? ''))
    })
  ), [afterSearch, colFilters, proyectoMap])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const copy = { ...prev }
      if (next.size === 0) delete copy[col]
      else copy[col] = next
      return copy
    })
  }

  // ── Preferencias de columnas ──────────────────────────────────────────
  const STORAGE_KEY = `cobradores_cols_v1_${userId}`
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
  const visibleCols = colPrefs.filter((p) => p.visible && ALL_COLUMNS.some((c) => c.key === p.key))

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

  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  // ── Helpers de formulario ─────────────────────────────────────────────
  function f(key: keyof CobradorForm, value: string | number) {
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

  function buildFormFromCobrador(c: Cobrador): CobradorForm {
    return {
      empresa: c.empresa,
      proyecto: c.proyecto,
      codigo: c.codigo,
      nombre: c.nombre,
      activo: c.activo,
    }
  }

  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto?.codigo ?? 0 })
    setDialogOpen(true)
  }

  function openView(cobrador: Cobrador) {
    setViewTarget(cobrador)
    setIsEditing(false)
    setHadConflict(false)
    setForm(buildFormFromCobrador(cobrador))
    setDialogOpen(true)
  }

  function cancelEdit() {
    if (viewTarget) {
      setIsEditing(false)
      setForm(buildFormFromCobrador(viewTarget))
    } else {
      setDialogOpen(false)
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────
  function handleSave() {
    if (!form.empresa)       { toast.error('La empresa es requerida.'); return }
    if (!form.proyecto)      { toast.error('El proyecto es requerido.'); return }
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return }

    // Verificar similitud de nombre (umbral 0.85) contra cobradores del mismo proyecto
    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((c) =>
      c.empresa === form.empresa && c.proyecto === form.proyecto &&
      (viewTarget ? c.codigo !== viewTarget.codigo : true)
    )
    const similar = candidates.filter(
      (c) => c.nombre && jaroWinkler(normalizedInput, toDbString(c.nombre)) >= 0.85
    )
    if (similar.length > 0) { setSimilarWarning(similar); return }

    doSave()
  }

  function doSave() {
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateCobrador(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form, lastModified)
        : await createCobrador(form)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Cobrador actualizado.' : 'Cobrador creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // ── Eliminar ──────────────────────────────────────────────────────────
  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteCobrador(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Cobrador eliminado.')
        setDeleteTarget(null)
        router.refresh()
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-100 p-2.5">
            <Banknote className="h-5 w-5 text-orange-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Cobradores</h1>
            <p className="text-sm text-muted-foreground">Administra los cobradores por proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2" disabled={proyectos.length === 0}>
            <Plus className="h-4 w-4" />
            Nuevo Cobrador
          </Button>
        )}
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea proyectos antes de agregar cobradores.
        </div>
      )}

      {/* ── Búsqueda + ColumnManager ── */
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cobrador…"
            className="pl-8"
          />
          {search && (
            <button type="button" title="Limpiar búsqueda" onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
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
          <ColumnManager
            prefs={colPrefs}
            onToggle={toggleCol}
            onMove={moveCol}
            onReset={() => saveColPrefs(DEFAULT_PREFS)}
          />
        </div>
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Codigo</TableHead>
              {visibleCols.map((col) => {
                if (col.key === '__empresa') {
                  return (
                    <TableHead key="__empresa">
                      <ColumnFilter
                        label="Empresa"
                        values={[...new Set(initialData.map((c) => empresaMap.get(c.empresa) ?? `#${c.empresa}`))].sort()}
                        active={new Set([...(colFilters['__empresa'] ?? new Set())].map((k) => empresaMap.get(Number(k)) ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = new Map(empresas.map((e) => [e.nombre, String(e.codigo)]))
                          setColFilter('__empresa', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                if (col.key === '__proyecto') {
                  return (
                    <TableHead key="__proyecto">
                      <ColumnFilter
                        label="Proyecto"
                        values={[...new Set(initialData.map((c) => proyectoMap.get(c.proyecto) ?? `#${c.proyecto}`))].sort()}
                        active={new Set([...(colFilters['__proyecto'] ?? new Set())].map((k) => proyectoMap.get(Number(k)) ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = new Map(proyectos.map((p) => [p.nombre, String(p.codigo)]))
                          setColFilter('__proyecto', new Set([...labels].map((l) => byLabel.get(l) ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                if (col.key === '__activo') {
                  return (
                    <TableHead key="__activo">
                      <ColumnFilter
                        label="Activo"
                        values={Object.values(ACTIVO_LABELS)}
                        active={new Set([...(colFilters['__activo'] ?? new Set())].map((k) => ACTIVO_LABELS[Number(k)] ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = Object.fromEntries(Object.entries(ACTIVO_LABELS).map(([k, v]) => [v, k]))
                          setColFilter('__activo', new Set([...labels].map((l) => byLabel[l] ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                return (
                  <TableHead key={col.key}>
                    <ColumnFilter
                      label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                      values={[...new Set(initialData.map((c) => String(c[col.key as keyof Cobrador] ?? '')))].sort()}
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
                    ? 'No se encontraron cobradores con ese criterio.'
                    : 'Todavía no hay cobradores. Haz clic en "Nuevo Cobrador" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cobrador, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${cobrador.empresa}-${cobrador.proyecto}-${cobrador.codigo}`}
                    className={`group cursor-pointer transition-colors ${
                      isActive ? 'bg-orange-50 dark:bg-orange-950/30' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(cobrador)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-l-[3px] border-l-orange-600 text-orange-700 dark:text-orange-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {cobrador.codigo}
                    </TableCell>

                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case '__empresa':
                          return (
                            <TableCell key="__empresa" className="text-muted-foreground">
                              {empresaMap.get(cobrador.empresa) ?? `#${cobrador.empresa}`}
                            </TableCell>
                          )

                        case '__proyecto':
                          return (
                            <TableCell key="__proyecto" className="text-muted-foreground">
                              {proyectoMap.get(cobrador.proyecto) ?? `#${cobrador.proyecto}`}
                            </TableCell>
                          )

                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{cobrador.nombre}</TableCell>

                        case '__activo':
                          return (
                            <TableCell key="__activo">
                              <Badge
                                variant="secondary"
                                className={cobrador.activo === 1
                                  ? 'font-normal bg-emerald-100 text-emerald-700'
                                  : 'font-normal bg-muted text-muted-foreground'
                                }
                              >
                                {cobrador.activo === 1 ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          )

                        default:
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {(cobrador[col.key as keyof Cobrador] as string) || '—'}
                            </TableCell>
                          )
                      }
                    })}

                    <TableCell className={`sticky right-0 z-10 transition-colors ${
                      isActive ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-card group-hover:bg-muted/40'
                    }`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(cobrador)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(cobrador)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(cobrador)}
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

      {/* ── Diálogo Ver / Crear / Editar ── */}
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

          {/* Header */}
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-orange-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${isEditing && !viewTarget ? 'bg-orange-100' : isEditing ? 'bg-amber-100' : 'bg-orange-100'}`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-5 w-5 text-orange-600" />
                  : isEditing
                  ? <Pencil className="h-5 w-5 text-amber-600" />
                  : <Banknote className="h-5 w-5 text-orange-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nuevo Cobrador' : isEditing ? 'Editar Cobrador' : viewTarget?.nombre}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {proyectoMap.get(viewTarget.proyecto) ?? ''}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">

              {/* ── Vista ── */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2">
                    <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                  </div>
                  <SectionDivider label="GENERAL" />
                  <div className="col-span-2">
                    <ViewField label="Nombre" value={viewTarget.nombre} />
                  </div>
                  <div className="col-span-2 rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Activo</span>
                    <Checkbox checked={!!viewTarget.activo} disabled />
                  </div>
                </div>

              ) : (
              /* ── Edición / Creación ── */
              <div className="grid grid-cols-2 gap-4">

                <SectionDivider label="IDENTIFICACION" />

                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                  <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona empresa">
                        {empresaMap.get(form.empresa) ?? 'Selecciona empresa'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                  <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))} disabled={!!viewTarget || !form.empresa}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona proyecto">
                        {proyectoMap.get(form.proyecto) ?? 'Selecciona proyecto'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {proyectosPorEmpresa.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <SectionDivider label="GENERAL" />

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre *</Label>
                  <Input id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del cobrador" />
                </div>

                <div className="col-span-2 flex items-center gap-2 rounded-lg border border-border/40 bg-muted/50 px-3 py-2.5">
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

          {/* Footer */}
          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                {puedeModificar && (
                  <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEdit}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Similar name warning */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => !o && setSimilarWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} cobrador
                  {similarWarning && similarWarning.length > 1 ? 'es' : ''} con un nombre muy parecido:
                </p>
                <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                  {similarWarning?.map((c) => (
                    <li key={c.codigo}>{c.nombre}</li>
                  ))}
                </ul>
                <p>¿Es realmente un cobrador diferente y desea continuar?</p>
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

      {/* ── Eliminar ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cobrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente <strong>{deleteTarget?.nombre}</strong>.
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

      {/* ── Historial ── */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_cobrador"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
