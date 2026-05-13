'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Trash2, Plus, Grid3x3, Search,
  History, Eye, Settings2, ChevronDown, ChevronUp, X, MapPin, Download,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createManzana, deleteManzana } from '@/app/actions/manzanas'
import type { Empresa, Proyecto, Fase, Manzana, ManzanaForm } from '@/lib/types/proyectos'

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

function ViewField({ label, value }: { label: string; value?: string | null }) {
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

// ─── Column Manager ────────────────────────────────────────────────────────

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',  label: 'Empresa',  defaultVisible: false },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: true  },
  { key: 'fase',     label: 'Fase',     defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

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

const EMPTY_FORM: ManzanaForm = { empresa: 0, proyecto: 0, fase: 0, codigo: '' }

// ─── Component ────────────────────────────────────────────────────────────

export function ManzanasClient({
  manzanas,
  empresas,
  proyectos,
  fases,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  manzanas:       Manzana[]
  empresas:       Empresa[]
  proyectos:      Proyecto[]
  fases:          Fase[]
  puedeAgregar:   boolean
  puedeModificar: boolean
  puedeEliminar:  boolean
  userId:         string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search,       setSearch]       = useState('')
  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [isCreating,   setIsCreating]   = useState(false)
  const [viewTarget,   setViewTarget]   = useState<Manzana | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Manzana | null>(null)
  const [auditTarget,  setAuditTarget]  = useState<Manzana | null>(null)
  const [form,         setForm]         = useState<ManzanaForm>(EMPTY_FORM)
  const [colFilters,   setColFilters]   = useState<ColFilters>({})

  // ─── Lookup maps ──────────────────────────────────────────────────────────

  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo,  e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const faseMap     = useMemo(() => new Map(fases.map((f) => [f.codigo,     f.nombre])), [fases])

  // ─── Cascaded selects ─────────────────────────────────────────────────────

  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )
  const fasesFiltradas = useMemo(
    () => fases.filter((f) => f.empresa === form.empresa && f.proyecto === form.proyecto),
    [fases, form.empresa, form.proyecto],
  )

  // ─── Column filters ───────────────────────────────────────────────────────

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]; else u[col] = next
      return u
    })
  }

  const uniqueEmpresaNames  = useMemo(() => [...new Set(manzanas.map((r) => empresaMap.get(r.empresa)   ?? ''))].sort(), [manzanas, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(manzanas.map((r) => proyectoMap.get(r.proyecto) ?? ''))].sort(), [manzanas, proyectoMap])
  const uniqueFaseNames     = useMemo(() => [...new Set(manzanas.map((r) => faseMap.get(r.fase)         ?? ''))].sort(), [manzanas, faseMap])

  // ─── Filtering pipeline ───────────────────────────────────────────────────

  const afterSearch = manzanas.filter((r) => {
    const q = search.toLowerCase()
    return !q ||
      r.codigo.toLowerCase().includes(q) ||
      (empresaMap.get(r.empresa)   ?? '').toLowerCase().includes(q) ||
      (proyectoMap.get(r.proyecto) ?? '').toLowerCase().includes(q) ||
      (faseMap.get(r.fase)         ?? '').toLowerCase().includes(q)
  })

  const filtered = afterSearch.filter((r) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa')  return vals.has(empresaMap.get(r.empresa)   ?? '')
      if (col === 'proyecto') return vals.has(proyectoMap.get(r.proyecto) ?? '')
      if (col === 'fase')     return vals.has(faseMap.get(r.fase)         ?? '')
      return vals.has(String((r as Record<string, unknown>)[col] ?? ''))
    }),
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ─── Column preferences (localStorage) ───────────────────────────────────

  const STORAGE_KEY = `manzanas_cols_v1_${userId}`
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
  const visibleCols = colPrefs.filter((p) => p.visible && ALL_COLUMNS.some((c) => c.key === p.key))

  // ─── Keyboard navigation ──────────────────────────────────────────────────

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

  // ─── Form handler ──────────────────────────────────────────────────────────

  function f(key: keyof ManzanaForm, value: string | number) {
    const v = typeof value === 'string'
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const fp = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = fp?.codigo ?? 0
        const ff = fases.find((f2) => f2.empresa === Number(value) && f2.proyecto === next.proyecto)
        next.fase = ff?.codigo ?? 0
      }
      if (key === 'proyecto') {
        const ff = fases.find((f2) => f2.empresa === prev.empresa && f2.proyecto === Number(value))
        next.fase = ff?.codigo ?? 0
      }
      return next
    })
  }

  // ─── Dialog handlers ──────────────────────────────────────────────────────

  function openCreate() {
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    const firstFase     = fases.find((f2) => f2.empresa === firstEmpresa && f2.proyecto === firstProyecto)?.codigo ?? 0
    setForm({ empresa: firstEmpresa, proyecto: firstProyecto, fase: firstFase, codigo: '' })
    setViewTarget(null)
    setIsCreating(true)
    setDialogOpen(true)
  }

  function openView(m: Manzana) {
    setViewTarget(m)
    setIsCreating(false)
    setDialogOpen(true)
  }

  // ─── Save / Delete ─────────────────────────────────────────────────────────

  function handleSave() {
    if (!form.empresa)       { toast.error('Selecciona empresa.'); return }
    if (!form.proyecto)      { toast.error('Selecciona proyecto.'); return }
    if (!form.fase)          { toast.error('Selecciona fase.'); return }
    if (!form.codigo.trim()) { toast.error('El codigo es requerido.'); return }

    startTransition(async () => {
      const result = await createManzana(form)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Manzana creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteManzana(
        deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.fase, deleteTarget.codigo,
      )
      if (result.error) toast.error(result.error)
      else { toast.success('Manzana eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10)
    const headers = ['Codigo', 'Empresa', 'Proyecto', 'Fase', 'Agrego Fecha', 'Modifico Fecha']
    const rows = filtered.map((m) => [
      m.codigo,
      empresaMap.get(m.empresa)   ?? String(m.empresa),
      proyectoMap.get(m.proyecto) ?? String(m.proyecto),
      faseMap.get(m.fase)         ?? String(m.fase),
      m.agrego_fecha   ?? '',
      m.modifico_fecha ?? '',
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `manzanas-${date}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5">
            <Grid3x3 className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Manzanas</h1>
            <p className="text-sm text-muted-foreground">Administra las manzanas dentro de las fases de cada proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2" disabled={proyectos.length === 0}>
            <Plus className="h-4 w-4" />
            Nueva Manzana
          </Button>
        )}
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea proyectos antes de agregar manzanas.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar manzanas..."
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
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30"><span className="text-xs font-medium text-muted-foreground">Codigo</span></TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'  ? uniqueEmpresaNames  :
                      col.key === 'proyecto' ? uniqueProyectoNames :
                      col.key === 'fase'     ? uniqueFaseNames     : []
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
                    ? 'No se encontraron manzanas con ese criterio.'
                    : 'Todavia no hay manzanas. Haz clic en "Nueva Manzana" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${m.empresa}-${m.proyecto}-${m.fase}-${m.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(m)}
                  >
                    <TableCell className={`sticky left-0 z-10 w-20 font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-l-[3px] border-l-amber-600 text-amber-700 dark:text-amber-400 font-semibold'
                        : 'bg-card text-foreground group-hover:bg-muted/40'
                    }`}>
                      {m.codigo}
                    </TableCell>

                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':  return <TableCell key="empresa"  className="text-muted-foreground">{empresaMap.get(m.empresa)   ?? String(m.empresa)}</TableCell>
                        case 'proyecto': return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(m.proyecto) ?? String(m.proyecto)}</TableCell>
                        case 'fase':     return <TableCell key="fase"     className="text-muted-foreground">{faseMap.get(m.fase)         ?? String(m.fase)}</TableCell>
                        default:         return <TableCell key={col.key}  className="text-muted-foreground">{String((m as Record<string, unknown>)[col.key] ?? '') || '—'}</TableCell>
                      }
                    })}

                    <TableCell className={`sticky right-0 z-10 w-12 transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(m)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(m)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(m)}
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

      {/* Ver / Crear Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) { setIsCreating(false); setViewTarget(null) } }}
        modal={false}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-amber-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className="shrink-0 rounded-xl p-2 bg-amber-100">
                {isCreating
                  ? <Plus className="h-5 w-5 text-amber-600" />
                  : <Grid3x3 className="h-5 w-5 text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isCreating ? 'Nueva Manzana' : `Manzana ${viewTarget?.codigo}`}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {proyectoMap.get(viewTarget.proyecto) ?? String(viewTarget.proyecto)}
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
              {isCreating ? (
                <div className="grid grid-cols-2 gap-4">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona empresa">
                          {(v: string) => v && Number(v) ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                    <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona proyecto">
                          {(v: string) => v && Number(v) ? (proyectoMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Fase *</Label>
                    <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona fase">
                          {(v: string) => v && Number(v) ? (faseMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {fasesFiltradas.map((f2) => <SelectItem key={f2.codigo} value={String(f2.codigo)}>{f2.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Codigo *</Label>
                    <Input
                      value={form.codigo}
                      onChange={(e) => f('codigo', e.target.value)}
                      placeholder="Ej: A, B, 1, 2..."
                    />
                  </div>
                </div>
              ) : viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2"><ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)   ?? String(viewTarget.empresa)} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? String(viewTarget.proyecto)} /></div>
                  <ViewField label="Fase"   value={faseMap.get(viewTarget.fase) ?? String(viewTarget.fase)} />
                  <ViewField label="Codigo" value={viewTarget.codigo} />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {isCreating ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar manzana?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Se eliminara la manzana <strong>{deleteTarget?.codigo}</strong> de la fase{' '}
              <strong>{faseMap.get(deleteTarget?.fase ?? 0) ?? deleteTarget?.fase}</strong>.
              Esta accion es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
          tabla="t_manzana"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={`Manzana ${auditTarget.codigo}`}
        />
      )}
    </div>
  )
}