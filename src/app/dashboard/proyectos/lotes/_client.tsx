'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, MapPin, Search, History, Eye, Settings2, ChevronDown, ChevronUp, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { createLote, updateLote, deleteLote } from '@/app/actions/lotes'
import { getLoteEstado } from '@/lib/types/proyectos'
import type { Empresa, Proyecto, Fase, Manzana, Lote, LoteForm } from '@/lib/types/proyectos'

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
              <span className="truncate">{v || '(vacÃ­o)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || 'â€”'}</span>
    </div>
  )
}

type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'manzana',   label: 'Manzana',   defaultVisible: true  },
  { key: 'empresa',   label: 'Empresa',   defaultVisible: true  },
  { key: 'proyecto',  label: 'Proyecto',  defaultVisible: false },
  { key: 'extension', label: 'ExtensiÃ³n', defaultVisible: true  },
  { key: 'valor',     label: 'Valor',     defaultVisible: true  },
  { key: '__estado',  label: 'Estado',    defaultVisible: true  },
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

const MONEDAS = [
  { value: 'GTQ', label: 'Q â€” Quetzal' },
  { value: 'USD', label: '$ â€” DÃ³lar USD' },
]

const EMPTY_FORM: LoteForm = {
  empresa: 0,
  proyecto: 0,
  fase: 0,
  manzana: '',
  codigo: '',
  moneda: 'GTQ',
  valor: 0,
  extension: 0,
  finca: '',
  folio: '',
  libro: '',
  norte: '',
  sur: '',
  este: '',
  oeste: '',
  otro: '',
}

function EstadoBadge({ lote }: { lote: Lote }) {
  const estado = getLoteEstado(lote)
  return estado === 'disponible' ? (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
      Disponible
    </Badge>
  ) : (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
      Con Promesa
    </Badge>
  )
}

export function LotesClient({
  initialData,
  empresas,
  proyectos,
  fases,
  manzanas,
  userId,
}: {
  initialData: Lote[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  fases: Fase[]
  manzanas: Manzana[]
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<'todos' | 'disponible' | 'con-promesa'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<Lote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lote | null>(null)
  const [auditTarget, setAuditTarget] = useState<Lote | null>(null)
  const [form, setForm] = useState<LoteForm>(EMPTY_FORM)
  const [colFilters, setColFilters] = useState<ColFilters>({})

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const faseMap = useMemo(() => new Map(fases.map((f) => [f.codigo, f.nombre])), [fases])

  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa]
  )
  const fasesFiltradas = useMemo(
    () => fases.filter((f) => f.empresa === form.empresa && f.proyecto === form.proyecto),
    [fases, form.empresa, form.proyecto]
  )
  const manzanasFiltradas = useMemo(
    () => manzanas.filter((m) => m.empresa === form.empresa && m.proyecto === form.proyecto && m.fase === form.fase),
    [manzanas, form.empresa, form.proyecto, form.fase]
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
  const uniqueManzanaVals = useMemo(
    () => [...new Set(initialData.map((r) => r.manzana))].sort(),
    [initialData]
  )

  const afterSearch = useMemo(() => initialData.filter((l) => {
    const q = search.toLowerCase()
    return !q || l.codigo.toLowerCase().includes(q) ||
      l.manzana.toLowerCase().includes(q) ||
      (empresaMap.get(l.empresa) ?? '').toLowerCase().includes(q)
  }), [initialData, search, empresaMap])

  const afterEstado = useMemo(() => afterSearch.filter((l) => {
    if (filterEstado === 'todos') return true
    return getLoteEstado(l) === filterEstado
  }), [afterSearch, filterEstado])

  const filtered = useMemo(() => afterEstado.filter((l) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa')  return vals.has(empresaMap.get(l.empresa)  ?? '')
      if (col === 'proyecto') return vals.has(proyectoMap.get(l.proyecto) ?? '')
      if (col === 'manzana')  return vals.has(l.manzana)
      if (col === '__estado') return vals.has(getLoteEstado(l))
      return vals.has(String((l as Record<string, unknown>)[col] ?? ''))
    })
  ), [afterEstado, colFilters, empresaMap, proyectoMap])

  const hasActiveFilters = filterEstado !== 'todos' || Object.keys(colFilters).length > 0

  const STORAGE_KEY = `lotes_cols_v1_${userId}`
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

  useEffect(() => { setCursorIdx(null) }, [search, filterEstado, colFilters])

  function f(key: keyof LoteForm, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'empresa') {
        const fp = proyectos.find((p) => p.empresa === Number(value)); next.proyecto = fp?.codigo ?? 0
        const ff = fases.find((f2) => f2.empresa === Number(value) && f2.proyecto === next.proyecto); next.fase = ff?.codigo ?? 0
        const fm = manzanas.find((m) => m.empresa === Number(value) && m.proyecto === next.proyecto && m.fase === next.fase); next.manzana = fm?.codigo ?? ''
      }
      if (key === 'proyecto') {
        const ff = fases.find((f2) => f2.empresa === prev.empresa && f2.proyecto === Number(value)); next.fase = ff?.codigo ?? 0
        const fm = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === Number(value) && m.fase === next.fase); next.manzana = fm?.codigo ?? ''
      }
      if (key === 'fase') {
        const fm = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === prev.proyecto && m.fase === Number(value)); next.manzana = fm?.codigo ?? ''
      }
      return next
    })
  }

  function openCreate() {
    setViewTarget(null); setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    const firstFase = fases.find((f) => f.empresa === firstEmpresa && f.proyecto === firstProyecto)?.codigo ?? 0
    const firstManzana = manzanas.find((m) => m.empresa === firstEmpresa && m.proyecto === firstProyecto && m.fase === firstFase)?.codigo ?? ''
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto, fase: firstFase, manzana: firstManzana })
    setDialogOpen(true)
  }

  function openView(lote: Lote) {
    setViewTarget(lote); setIsEditing(false)
    setForm({
      empresa: lote.empresa, proyecto: lote.proyecto, fase: lote.fase, manzana: lote.manzana, codigo: lote.codigo,
      moneda: lote.moneda ?? 'GTQ', valor: lote.valor ?? 0, extension: lote.extension ?? 0,
      finca: lote.finca ?? '', folio: lote.folio ?? '', libro: lote.libro ?? '',
      norte: lote.norte ?? '', sur: lote.sur ?? '', este: lote.este ?? '', oeste: lote.oeste ?? '', otro: lote.otro ?? '',
    })
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }
  function cancelEdit() {
    if (!viewTarget) { setDialogOpen(false); return }
    setIsEditing(false)
    setForm({
      empresa: viewTarget.empresa, proyecto: viewTarget.proyecto, fase: viewTarget.fase, manzana: viewTarget.manzana, codigo: viewTarget.codigo,
      moneda: viewTarget.moneda ?? 'GTQ', valor: viewTarget.valor ?? 0, extension: viewTarget.extension ?? 0,
      finca: viewTarget.finca ?? '', folio: viewTarget.folio ?? '', libro: viewTarget.libro ?? '',
      norte: viewTarget.norte ?? '', sur: viewTarget.sur ?? '', este: viewTarget.este ?? '', oeste: viewTarget.oeste ?? '', otro: viewTarget.otro ?? '',
    })
  }

  function handleSave() {
    if (!form.codigo.trim()) { toast.error('El cÃ³digo del lote es requerido.'); return }
    if (!form.manzana.trim()) { toast.error('Selecciona la manzana.'); return }
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateLote(viewTarget.empresa, viewTarget.proyecto, viewTarget.fase, viewTarget.manzana, viewTarget.codigo, form, lastModified)
        : await createLote(form)
      if (result.error) {
        if (result.error.includes('modificado')) { setHadConflict(true); toast.error(result.error) }
        else toast.error(result.error)
      } else {
        toast.success(viewTarget ? 'Lote actualizado.' : 'Lote creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteLote(
        deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.fase, deleteTarget.manzana, deleteTarget.codigo
      )
      if (result.error) toast.error(result.error)
      else { toast.success('Lote eliminado.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  const disponibles = initialData.filter((l) => getLoteEstado(l) === 'disponible').length
  const conPromesa = initialData.length - disponibles

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5">
            <MapPin className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Lotes</h1>
            <p className="text-sm text-muted-foreground">CatÃ¡logo completo de lotes y su estado</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={manzanas.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo Lote
        </Button>
      </div>

      {/* Stats chips */}
      {initialData.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-foreground/30" />
            {initialData.length} lotes totales
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-emerald-200 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {disponibles} disponibles
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-amber-200 text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {conPromesa} con promesa
          </Badge>
        </div>
      )}

      {manzanas.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea manzanas antes de agregar lotes.
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar lotes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(['todos', 'disponible', 'con-promesa'] as const).map((v) => (
            <Button key={v} variant={filterEstado === v ? 'default' : 'outline'} size="sm" onClick={() => setFilterEstado(v)}>
              {v === 'todos' ? 'Todos' : v === 'disponible' ? 'Disponibles' : 'Con Promesa'}
            </Button>
          ))}
        </div>
        {Object.keys(colFilters).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar
          </Button>
        )}
        <div className="sm:ml-auto">
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
              <TableHead className="sticky left-0 z-20 bg-muted/30">CÃ³digo</TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'  ? uniqueEmpresaNames :
                      col.key === 'proyecto' ? uniqueProyectoNames :
                      col.key === 'manzana'  ? uniqueManzanaVals :
                      col.key === '__estado' ? ['disponible', 'con-promesa'] : []
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
                  {search || hasActiveFilters ? 'Sin resultados para ese filtro.' : 'No hay lotes registrados aÃºn.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lote, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                const estado = getLoteEstado(lote)
                return (
                  <TableRow
                    key={`${lote.empresa}-${lote.proyecto}-${lote.fase}-${lote.manzana}-${lote.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-sky-50 dark:bg-sky-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(lote)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-medium transition-colors ${
                      isActive ? 'bg-sky-50 dark:bg-sky-950/30 border-l-[3px] border-l-sky-600 text-sky-700 dark:text-sky-400 font-semibold' : 'bg-card text-foreground group-hover:bg-muted/40'
                    }`}>
                      {lote.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'manzana':  return <TableCell key="manzana"  className="text-muted-foreground">{lote.manzana}</TableCell>
                        case 'empresa':  return <TableCell key="empresa"  className="text-muted-foreground">{empresaMap.get(lote.empresa)   ?? `#${lote.empresa}`}</TableCell>
                        case 'proyecto': return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(lote.proyecto) ?? `#${lote.proyecto}`}</TableCell>
                        case 'extension': return <TableCell key="extension" className="text-muted-foreground">{lote.extension ? lote.extension.toLocaleString() : 'â€”'}</TableCell>
                        case 'valor':    return (
                          <TableCell key="valor" className="font-mono text-sm">
                            {lote.valor ? new Intl.NumberFormat('es-GT', { style: 'currency', currency: lote.moneda ?? 'GTQ' }).format(lote.valor) : 'â€”'}
                          </TableCell>
                        )
                        case '__estado': return (
                          <TableCell key="__estado">
                            {estado === 'disponible'
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Disponible</Badge>
                              : <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Con Promesa</Badge>}
                          </TableCell>
                        )
                        default: return <TableCell key={col.key} className="text-muted-foreground">{String((lote as Record<string, unknown>)[col.key] ?? '') || 'â€”'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-sky-50 dark:bg-sky-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(lote)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> Ver / Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(lote)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(lote)}>
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
        <DialogContent className="flex flex-col w-full max-w-2xl h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing && !viewTarget
                ? <><Plus className="h-4 w-4 text-muted-foreground" /> Nuevo Lote</>
                : isEditing
                ? <><Pencil className="h-4 w-4 text-muted-foreground" /> Editar Lote {viewTarget?.codigo}</>
                : <><Eye className="h-4 w-4 text-muted-foreground" /> Lote {viewTarget?.codigo}</>}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="ubicacion" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="ubicacion">UbicaciÃ³n</TabsTrigger>
              <TabsTrigger value="datos">Datos Generales</TabsTrigger>
              <TabsTrigger value="colindancias">Colindancias</TabsTrigger>
            </TabsList>

            {/* UbicaciÃ³n */}
            <TabsContent value="ubicacion" className="mt-4 flex-1 overflow-y-auto pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div className="col-span-2"><ViewField label="CÃ³digo" value={viewTarget.codigo} /></div>
                  <ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)   ?? `#${viewTarget.empresa}`} />
                  <ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`} />
                  <ViewField label="Fase"     value={faseMap.get(viewTarget.fase)         ?? `#${viewTarget.fase}`} />
                  <ViewField label="Manzana"  value={viewTarget.manzana} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 grid gap-1.5">
                    <Label>Empresa *</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Empresa">{(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                      <SelectContent>{empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label>Proyecto *</Label>
                    <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Proyecto">{(v: string) => v ? (proyectoMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                      <SelectContent>{proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Fase *</Label>
                    <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Fase">{(v: string) => v ? (faseMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                      <SelectContent>{fasesFiltradas.map((f2) => <SelectItem key={f2.codigo} value={String(f2.codigo)}>{f2.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Manzana *</Label>
                    <Select value={form.manzana} onValueChange={(v) => f('manzana', v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Manzana" /></SelectTrigger>
                      <SelectContent>{manzanasFiltradas.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label>CÃ³digo del Lote *</Label>
                    <Input value={form.codigo} onChange={(e) => f('codigo', e.target.value)} placeholder="Ej: 001, L-01, A1..." disabled={!!viewTarget} />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Datos Generales */}
            <TabsContent value="datos" className="mt-4 flex-1 overflow-y-auto pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <ViewField label="Moneda"    value={viewTarget.moneda} />
                  <ViewField label="Valor"     value={viewTarget.valor ? String(viewTarget.valor) : undefined} />
                  <ViewField label="ExtensiÃ³n" value={viewTarget.extension ? String(viewTarget.extension) : undefined} />
                  <ViewField label="Finca"     value={viewTarget.finca} />
                  <ViewField label="Folio"     value={viewTarget.folio} />
                  <ViewField label="Libro"     value={viewTarget.libro} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Moneda</Label>
                    <Select value={form.moneda} onValueChange={(v) => f('moneda', v ?? 'GTQ')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MONEDAS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Valor</Label>
                    <Input type="number" step="0.01" value={form.valor} onChange={(e) => f('valor', Number(e.target.value))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>ExtensiÃ³n</Label>
                    <Input type="number" step="0.01" value={form.extension} onChange={(e) => f('extension', Number(e.target.value))} />
                  </div>
                  <div className="col-span-2"><Separator /></div>
                  <div className="grid gap-1.5"><Label>Finca</Label><Input value={form.finca} onChange={(e) => f('finca', e.target.value)} placeholder="No. de finca" /></div>
                  <div className="grid gap-1.5"><Label>Folio</Label><Input value={form.folio} onChange={(e) => f('folio', e.target.value)} placeholder="No. de folio" /></div>
                  <div className="grid gap-1.5"><Label>Libro</Label><Input value={form.libro} onChange={(e) => f('libro', e.target.value)} placeholder="No. de libro" /></div>
                </div>
              )}
            </TabsContent>

            {/* Colindancias */}
            <TabsContent value="colindancias" className="mt-4 flex-1 overflow-y-auto pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <ViewField label="Norte" value={viewTarget.norte} />
                  <ViewField label="Sur"   value={viewTarget.sur} />
                  <ViewField label="Este"  value={viewTarget.este} />
                  <ViewField label="Oeste" value={viewTarget.oeste} />
                  <div className="col-span-2"><ViewField label="Otras" value={viewTarget.otro} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5"><Label>Norte</Label><Input value={form.norte} onChange={(e) => f('norte', e.target.value)} placeholder="Colindancia al norte" /></div>
                  <div className="grid gap-1.5"><Label>Sur</Label><Input value={form.sur} onChange={(e) => f('sur', e.target.value)} placeholder="Colindancia al sur" /></div>
                  <div className="grid gap-1.5"><Label>Este</Label><Input value={form.este} onChange={(e) => f('este', e.target.value)} placeholder="Colindancia al este" /></div>
                  <div className="grid gap-1.5"><Label>Oeste</Label><Input value={form.oeste} onChange={(e) => f('oeste', e.target.value)} placeholder="Colindancia al oeste" /></div>
                  <div className="col-span-2 grid gap-1.5"><Label>Otras colindancias</Label><Input value={form.otro} onChange={(e) => f('otro', e.target.value)} placeholder="Otras colindancias relevantes" /></div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cerrar</Button>
                <Button onClick={startEdit} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEdit}>{viewTarget ? 'Volver' : 'Cancelar'}</Button>
                <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardandoâ€¦' : 'Guardar'}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Â¿Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarÃ¡ el lote <strong>{deleteTarget?.codigo}</strong> de la manzana <strong>{deleteTarget?.manzana}</strong>. AcciÃ³n irreversible.
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
          tabla="t_lote"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={`Lote ${auditTarget.codigo} / Manzana ${auditTarget.manzana}`}
        />
      )}
    </div>
  )
}
