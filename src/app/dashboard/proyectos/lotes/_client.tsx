'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Plus, MapPin, Search, History, Eye, Settings2, ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react'
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
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: '__proyecto', label: 'Proyecto',     defaultVisible: true },
  { key: 'fase',     label: 'Fase',         defaultVisible: true },
  { key: 'manzana',  label: 'Manzana',      defaultVisible: true },
  { key: 'valor',    label: 'Precio Venta', defaultVisible: true },
  { key: '__estado', label: 'Estado',       defaultVisible: true },
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

const CURRENCIES: { iso: string; name: string; flagIso: string }[] = [
  { iso: 'ARS', name: 'Peso Argentino',        flagIso: 'AR' },
  { iso: 'BOB', name: 'Boliviano',              flagIso: 'BO' },
  { iso: 'BRL', name: 'Real Brasileno',         flagIso: 'BR' },
  { iso: 'CAD', name: 'Dolar Canadiense',       flagIso: 'CA' },
  { iso: 'CLP', name: 'Peso Chileno',           flagIso: 'CL' },
  { iso: 'COP', name: 'Peso Colombiano',        flagIso: 'CO' },
  { iso: 'CRC', name: 'Colon Costarricense',    flagIso: 'CR' },
  { iso: 'CUP', name: 'Peso Cubano',            flagIso: 'CU' },
  { iso: 'DOP', name: 'Peso Dominicano',        flagIso: 'DO' },
  { iso: 'EUR', name: 'Euro',                   flagIso: 'EU' },
  { iso: 'GBP', name: 'Libra Esterlina',        flagIso: 'GB' },
  { iso: 'GTQ', name: 'Quetzal Guatemalteco',   flagIso: 'GT' },
  { iso: 'HNL', name: 'Lempira Hondureno',      flagIso: 'HN' },
  { iso: 'MXN', name: 'Peso Mexicano',          flagIso: 'MX' },
  { iso: 'NIO', name: 'Cordoba Nicaraguense',   flagIso: 'NI' },
  { iso: 'PAB', name: 'Balboa Panameno',        flagIso: 'PA' },
  { iso: 'PEN', name: 'Sol Peruano',            flagIso: 'PE' },
  { iso: 'PYG', name: 'Guarani Paraguayo',      flagIso: 'PY' },
  { iso: 'SVC', name: 'Colon Salvadoreno',      flagIso: 'SV' },
  { iso: 'USD', name: 'Dolar Estadounidense',   flagIso: 'US' },
  { iso: 'UYU', name: 'Peso Uruguayo',          flagIso: 'UY' },
  { iso: 'VES', name: 'Bolivar Venezolano',     flagIso: 'VE' },
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
  puedeEliminar,
  userId,
}: {
  initialData: Lote[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  fases: Fase[]
  manzanas: Manzana[]
  puedeEliminar: boolean
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
  const [valorStr, setValorStr] = useState('')
  const [extensionStr, setExtensionStr] = useState('')
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

  const uniqueFaseNames = useMemo(
    () => [...new Set(initialData.map((r) => faseMap.get(r.fase) ?? ''))].sort(),
    [initialData, faseMap]
  )
  const uniqueManzanaVals = useMemo(
    () => [...new Set(initialData.map((r) => r.manzana))].sort(),
    [initialData]
  )

  const afterSearch = useMemo(() => initialData.filter((l) => {
    const q = search.toLowerCase()
    return !q || l.codigo.toLowerCase().includes(q) ||
      l.manzana.toLowerCase().includes(q) ||
      (proyectoMap.get(l.proyecto) ?? '').toLowerCase().includes(q) ||
      (faseMap.get(l.fase) ?? '').toLowerCase().includes(q)
  }), [initialData, search, proyectoMap, faseMap])

  const afterEstado = useMemo(() => afterSearch.filter((l) => {
    if (filterEstado === 'todos') return true
    return getLoteEstado(l) === filterEstado
  }), [afterSearch, filterEstado])

  const filtered = useMemo(() => afterEstado.filter((l) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'fase')     return vals.has(faseMap.get(l.fase) ?? '')
      if (col === 'manzana')  return vals.has(l.manzana)
      if (col === '__estado') return vals.has(getLoteEstado(l))
      if (col === '__proyecto') return vals.has(proyectoMap.get(l.proyecto) ?? '')
      return vals.has(String((l as Record<string, unknown>)[col] ?? ''))
    })
  ), [afterEstado, colFilters, faseMap])

  const hasActiveFilters = filterEstado !== 'todos' || Object.keys(colFilters).length > 0

  const STORAGE_KEY = `lotes_cols_v2_${userId}`
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
    const v = typeof value === 'string' && key !== 'manzana' && key !== 'moneda'
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const fp = proyectos.find((p) => p.empresa === Number(value)); next.proyecto = fp?.codigo ?? 0
        next.moneda = fp?.moneda ?? 'GTQ'
        const ff = fases.find((f2) => f2.empresa === Number(value) && f2.proyecto === next.proyecto); next.fase = ff?.codigo ?? 0
        const fm = manzanas.find((m) => m.empresa === Number(value) && m.proyecto === next.proyecto && m.fase === next.fase); next.manzana = fm?.codigo ?? ''
      }
      if (key === 'proyecto') {
        const fp = proyectos.find((p) => p.empresa === prev.empresa && p.codigo === Number(value))
        next.moneda = fp?.moneda ?? prev.moneda
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
    const firstProy = proyectos.find((p) => p.empresa === firstEmpresa)
    const firstProyecto = firstProy?.codigo ?? 0
    const firstMoneda = firstProy?.moneda ?? 'GTQ'
    const firstFase = fases.find((f) => f.empresa === firstEmpresa && f.proyecto === firstProyecto)?.codigo ?? 0
    const firstManzana = manzanas.find((m) => m.empresa === firstEmpresa && m.proyecto === firstProyecto && m.fase === firstFase)?.codigo ?? ''
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto, fase: firstFase, manzana: firstManzana, moneda: firstMoneda })
    setValorStr('')
    setExtensionStr('')
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
    setValorStr(lote.valor ? lote.valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
    setExtensionStr(lote.extension ? lote.extension.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
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
    setValorStr(viewTarget.valor ? viewTarget.valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
    setExtensionStr(viewTarget.extension ? viewTarget.extension.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
  }

  function handleSave() {
    if (!form.codigo.trim()) { toast.error('El codigo del lote es requerido.'); return }
    if (!form.manzana.trim()) { toast.error('Selecciona la manzana.'); return }
    if (!form.extension || form.extension <= 0) { toast.error('La extension es requerida.'); return }
    if (!form.valor || form.valor <= 0) { toast.error('El valor es requerido.'); return }
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
          <div className="rounded-xl bg-rose-100 p-2.5">
            <MapPin className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Lotes</h1>
            <p className="text-sm text-muted-foreground">Catalogo completo de lotes y su estado</p>
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
              <TableHead className="sticky left-0 z-20 bg-muted/30">Lote</TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === '__proyecto' ? [...new Set(filtered.map((l) => proyectoMap.get(l.proyecto) ?? ''))].sort() :
                      col.key === 'fase'     ? uniqueFaseNames :
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
                  {search || hasActiveFilters ? 'Sin resultados para ese filtro.' : 'No hay lotes registrados aun.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lote, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                const estado = getLoteEstado(lote)
                return (
                  <TableRow
                    key={`${lote.empresa}-${lote.proyecto}-${lote.fase}-${lote.manzana}-${lote.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(lote)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-medium transition-colors ${
                      isActive ? 'bg-rose-50 dark:bg-rose-950/30 border-l-[3px] border-l-rose-600 text-rose-700 dark:text-rose-400 font-semibold' : 'bg-card text-foreground group-hover:bg-muted/40'
                    }`}>
                      {lote.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case '__proyecto': return <TableCell key="__proyecto" className="text-muted-foreground">{proyectoMap.get(lote.proyecto) ?? `#${lote.proyecto}`}</TableCell>
                        case 'fase':     return <TableCell key="fase"     className="text-muted-foreground">{faseMap.get(lote.fase)  ?? `#${lote.fase}`}</TableCell>
                        case 'manzana':  return <TableCell key="manzana"  className="text-muted-foreground">{lote.manzana}</TableCell>
                        case 'codigo':   return <TableCell key="codigo"   className="font-medium">{lote.codigo}</TableCell>
                        case 'valor':    return (
                          <TableCell key="valor" className="text-muted-foreground">
                            {lote.valor ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-muted-foreground">{lote.moneda ?? 'GTQ'}</span>
                                {new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(lote.valor)}
                              </span>
                            ) : '—'}
                          </TableCell>
                        )
                        case '__estado': return (
                          <TableCell key="__estado">
                            {estado === 'disponible'
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Disponible</Badge>
                              : <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Con Promesa</Badge>}
                          </TableCell>
                        )
                        default: return <TableCell key={col.key} className="text-muted-foreground">{String((lote as Record<string, unknown>)[col.key] ?? '') || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
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
                          {puedeEliminar && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(lote)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                            </DropdownMenuItem>
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
          if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
        }}
        modal={false}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-rose-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${isEditing && viewTarget ? 'bg-amber-100' : 'bg-rose-100'}`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-4 w-4 text-rose-600" />
                  : isEditing
                  ? <Pencil className="h-4 w-4 text-amber-600" />
                  : <MapPin className="h-4 w-4 text-rose-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nuevo Lote' : isEditing ? 'Editar Lote' : `Lote ${viewTarget?.codigo}`}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Manzana {viewTarget.manzana} — {proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-1 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="colindancias" className="gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Colindancias
              </TabsTrigger>
            </TabsList>

            {/* General = Ubicacion + Datos Generales */}
            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)   ?? `#${viewTarget.empresa}`} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`} /></div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <ViewField label="Fase"    value={faseMap.get(viewTarget.fase) ?? `#${viewTarget.fase}`} />
                    <ViewField label="Manzana" value={viewTarget.manzana} />
                    <ViewField label="Codigo"  value={viewTarget.codigo} />
                  </div>
                  {(() => {
                    const medida = fases.find((f) => f.empresa === viewTarget.empresa && f.proyecto === viewTarget.proyecto && f.codigo === viewTarget.fase)?.medida
                    return (
                      <div className="col-span-2 grid grid-cols-3 gap-3">
                        <ViewField label={`Extension${medida ? ` (${medida})` : ''}`} value={viewTarget.extension ? viewTarget.extension.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : undefined} />
                      </div>
                    )
                  })()}
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Precio Venta</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  {(() => {
                    const c = CURRENCIES.find((x) => x.iso === viewTarget.moneda)
                    return (
                      <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
                        <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">Moneda</span>
                        {c ? (
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <img src={`https://flagcdn.com/w20/${c.flagIso.toLowerCase()}.png`} alt={c.flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                            {c.iso} — {c.name}
                          </span>
                        ) : <span className="block text-sm font-medium">{viewTarget.moneda ?? '—'}</span>}
                      </div>
                    )
                  })()}
                  <ViewField label="Valor"  value={viewTarget.valor ? viewTarget.valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : undefined} />
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Registro</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <ViewField label="Finca"  value={viewTarget.finca} />
                  <ViewField label="Folio"  value={viewTarget.folio} />
                  <ViewField label="Libro"  value={viewTarget.libro} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona empresa">{(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                      <SelectContent>{empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                    <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona proyecto">{(v: string) => v ? (proyectoMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                      <SelectContent>{proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Fase *</Label>
                      <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))} disabled={!!viewTarget}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Fase">{(v: string) => v ? (faseMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                        <SelectContent>{fasesFiltradas.map((f2) => <SelectItem key={f2.codigo} value={String(f2.codigo)}>{f2.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Manzana *</Label>
                      <Select value={form.manzana} onValueChange={(v) => f('manzana', v ?? '')} disabled={!!viewTarget}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Manzana" /></SelectTrigger>
                        <SelectContent>{manzanasFiltradas.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Codigo *</Label>
                      <Input value={form.codigo} onChange={(e) => f('codigo', e.target.value)} placeholder="Ej: 001" disabled={!!viewTarget} />
                    </div>
                  </div>
                  {(() => {
                    const medida = fases.find((f2) => f2.empresa === form.empresa && f2.proyecto === form.proyecto && f2.codigo === form.fase)?.medida
                    return (
                      <div className="col-span-2 grid grid-cols-3 gap-3">
                        <div className="grid gap-1">
                          <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Extension{medida ? ` (${medida})` : ''} *</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={extensionStr}
                            placeholder="0.00"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '')
                              setExtensionStr(raw)
                              const n = parseFloat(raw)
                              if (!isNaN(n)) f('extension', n)
                              else if (raw === '' || raw === '.') f('extension', 0)
                            }}
                            onFocus={() => setExtensionStr(form.extension ? form.extension.toString() : '')}
                            onBlur={() => {
                              const n = parseFloat(extensionStr.replace(/,/g, ''))
                              const clean = isNaN(n) ? 0 : n
                              f('extension', clean)
                              setExtensionStr(clean > 0 ? clean.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
                            }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Precio Venta</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda</Label>
                    <div className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                      {(() => {
                        const c = CURRENCIES.find((x) => x.iso === form.moneda)
                        return c ? (
                          <>
                            <img src={`https://flagcdn.com/w20/${c.flagIso.toLowerCase()}.png`} alt={c.flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                            {c.iso} — {c.name}
                          </>
                        ) : form.moneda
                      })()}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Valor *</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={valorStr}
                      placeholder="0.00"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '')
                        setValorStr(raw)
                        const n = parseFloat(raw)
                        if (!isNaN(n)) f('valor', n)
                        else if (raw === '' || raw === '.') f('valor', 0)
                      }}
                      onFocus={() => setValorStr(form.valor ? form.valor.toString() : '')}
                      onBlur={() => {
                        const n = parseFloat(valorStr.replace(/,/g, ''))
                        const clean = isNaN(n) ? 0 : n
                        f('valor', clean)
                        setValorStr(clean > 0 ? clean.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
                      }}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Registro</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Finca</Label><Input value={form.finca} onChange={(e) => f('finca', e.target.value)} placeholder="No. de finca" /></div>
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Folio</Label><Input value={form.folio} onChange={(e) => f('folio', e.target.value)} placeholder="No. de folio" /></div>
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Libro</Label><Input value={form.libro} onChange={(e) => f('libro', e.target.value)} placeholder="No. de libro" /></div>
                </div>
              )}
            </TabsContent>

            {/* Colindancias */}
            <TabsContent value="colindancias" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="Norte" value={viewTarget.norte} />
                  <ViewField label="Sur"   value={viewTarget.sur} />
                  <ViewField label="Este"  value={viewTarget.este} />
                  <ViewField label="Oeste" value={viewTarget.oeste} />
                  <div className="col-span-2"><ViewField label="Otras Colindancias" value={viewTarget.otro} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Norte</Label><Input value={form.norte} onChange={(e) => f('norte', e.target.value)} placeholder="Colindancia al norte" /></div>
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Sur</Label><Input value={form.sur} onChange={(e) => f('sur', e.target.value)} placeholder="Colindancia al sur" /></div>
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Este</Label><Input value={form.este} onChange={(e) => f('este', e.target.value)} placeholder="Colindancia al este" /></div>
                  <div className="grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Oeste</Label><Input value={form.oeste} onChange={(e) => f('oeste', e.target.value)} placeholder="Colindancia al oeste" /></div>
                  <div className="col-span-2 grid gap-1"><Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Otras Colindancias</Label><Input value={form.otro} onChange={(e) => f('otro', e.target.value)} placeholder="Otras colindancias relevantes" /></div>
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
            <AlertDialogTitle>¿Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el lote <strong>{deleteTarget?.codigo}</strong> de la manzana <strong>{deleteTarget?.manzana}</strong>. Accion irreversible.
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
