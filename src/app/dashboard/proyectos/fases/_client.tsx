'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, Layers, Search, History, Eye, Settings2, ChevronDown, ChevronUp, X } from 'lucide-react'
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
import { createFase, updateFase, deleteFase } from '@/app/actions/fases'
import type { Empresa, Proyecto, Fase, FaseForm } from '@/lib/types/proyectos'

const MEDIDAS = ['Varas', 'Metros cuadrados', 'm²', 'Hectáreas', 'Manzanas', 'Cuerdas', 'Caballerías']

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
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  )
}

type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'nombre',   label: 'Nombre',   defaultVisible: true  },
  { key: 'empresa',  label: 'Empresa',  defaultVisible: true  },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: true  },
  { key: 'medida',   label: 'Medida',   defaultVisible: false },
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

const EMPTY_FORM: FaseForm = {
  empresa: 0,
  proyecto: 0,
  codigo: 0,
  nombre: '',
  medida: 'Varas',
}

export function FasesClient({
  initialData,
  empresas,
  proyectos,
  userId,
}: {
  initialData: Fase[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<Fase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Fase | null>(null)
  const [auditTarget, setAuditTarget] = useState<Fase | null>(null)
  const [form, setForm] = useState<FaseForm>(EMPTY_FORM)
  const [colFilters, setColFilters] = useState<ColFilters>({})

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa]
  )

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => { const u = { ...prev }; if (next.size === 0) delete u[col]; else u[col] = next; return u })
  }

  const uniqueEmpresaNames = useMemo(
    () => [...new Set(initialData.map((r) => empresaMap.get(r.empresa) ?? ''))].sort(),
    [initialData, empresaMap]
  )
  const uniqueProyectoNames = useMemo(
    () => [...new Set(initialData.map((r) => proyectoMap.get(r.proyecto) ?? ''))].sort(),
    [initialData, proyectoMap]
  )
  const uniqueVals = (key: keyof Fase) => [...new Set(initialData.map((r) => String(r[key] ?? '')))].sort()

  const afterSearch = initialData.filter((r) => {
    const q = search.toLowerCase()
    return !q || r.nombre?.toLowerCase().includes(q) ||
      (empresaMap.get(r.empresa) ?? '').toLowerCase().includes(q) ||
      String(r.codigo).includes(q)
  })

  const filtered = afterSearch.filter((r) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa') return vals.has(empresaMap.get(r.empresa) ?? '')
      if (col === 'proyecto') return vals.has(proyectoMap.get(r.proyecto) ?? '')
      return vals.has(String(r[col as keyof Fase] ?? ''))
    })
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

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

  function f(key: keyof FaseForm, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'empresa') { const fp = proyectos.find((p) => p.empresa === Number(value)); next.proyecto = fp?.codigo ?? 0 }
      return next
    })
  }

  function openCreate() {
    setViewTarget(null); setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setDialogOpen(true)
  }

  function openView(fase: Fase) {
    setViewTarget(fase); setIsEditing(false)
    setForm({ empresa: fase.empresa, proyecto: fase.proyecto, codigo: fase.codigo, nombre: fase.nombre, medida: fase.medida ?? 'Varas' })
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }
  function cancelEdit() {
    if (!viewTarget) { setDialogOpen(false); return }
    setIsEditing(false)
    setForm({ empresa: viewTarget.empresa, proyecto: viewTarget.proyecto, codigo: viewTarget.codigo, nombre: viewTarget.nombre, medida: viewTarget.medida ?? 'Varas' })
  }

  function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return }
    if (!form.empresa) { toast.error('Selecciona la empresa.'); return }
    if (!form.proyecto) { toast.error('Selecciona el proyecto.'); return }
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateFase(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form, lastModified)
        : await createFase(form)
      if (result.error) {
        if (result.error.includes('modificado')) { setHadConflict(true); toast.error(result.error) }
        else toast.error(result.error)
      } else {
        toast.success(viewTarget ? 'Fase actualizada.' : 'Fase creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteFase(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) toast.error(result.error)
      else { toast.success('Fase eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2.5">
            <Layers className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Fases</h1>
            <p className="text-sm text-muted-foreground">Administra las fases de los proyectos</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={proyectos.length === 0}>
          <Plus className="h-4 w-4" />
          Nueva Fase
        </Button>
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea proyectos antes de agregar fases.
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar fases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto">
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Código</TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa' ? uniqueEmpresaNames :
                      col.key === 'proyecto' ? uniqueProyectoNames :
                      uniqueVals(col.key as keyof Fase)
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
                  {search || hasActiveFilters ? 'Sin resultados para esa búsqueda.' : 'No hay fases registradas aún.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((fase, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${fase.empresa}-${fase.proyecto}-${fase.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-sky-50 dark:bg-sky-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(fase)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive ? 'bg-sky-50 dark:bg-sky-950/30 border-l-[3px] border-l-sky-600 text-sky-700 dark:text-sky-400 font-semibold' : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      #{fase.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'nombre':   return <TableCell key="nombre" className="font-medium">{fase.nombre}</TableCell>
                        case 'empresa':  return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(fase.empresa) ?? `#${fase.empresa}`}</TableCell>
                        case 'proyecto': return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(fase.proyecto) ?? `#${fase.proyecto}`}</TableCell>
                        default:         return <TableCell key={col.key} className="text-muted-foreground">{(fase[col.key as keyof Fase] as string) || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-sky-50 dark:bg-sky-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(fase)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> Ver / Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(fase)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(fase)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                          </DropdownMenuItem>
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
          if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
        }}
        modal={false}
      >
        <DialogContent className="flex flex-col max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing && !viewTarget
                ? <><Plus className="h-4 w-4 text-muted-foreground" /> Nueva Fase</>
                : isEditing
                ? <><Pencil className="h-4 w-4 text-muted-foreground" /> Editar Fase</>
                : <><Eye className="h-4 w-4 text-muted-foreground" /> {viewTarget?.nombre}</>}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {!isEditing && viewTarget ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>
                <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} />
                <ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`} />
                <ViewField label="Medida" value={viewTarget.medida} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 grid gap-1.5">
                  <Label>Empresa *</Label>
                  <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona empresa">{(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                    <SelectContent>{empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 grid gap-1.5">
                  <Label>Proyecto *</Label>
                  <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona proyecto">{(v: string) => v ? (proyectoMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                    <SelectContent>{proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 grid gap-1.5">
                  <Label>Nombre *</Label>
                  <Input value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Ej: Fase 1, Etapa A..." />
                </div>
                <div className="col-span-2 grid gap-1.5">
                  <Label>Unidad de Medida</Label>
                  <Select value={form.medida} onValueChange={(v) => f('medida', v ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MEDIDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0">
            {!isEditing && viewTarget ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                <Button onClick={startEdit} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>
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
            <AlertDialogTitle>¿Eliminar fase?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit Log */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_fase"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
