'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Trash2, Plus, CreditCard, Search,
  History, Eye, Settings2, ChevronDown, ChevronUp, X, MapPin, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  createCuentaBancaria, updateCuentaBancaria, deleteCuentaBancaria,
} from '@/app/actions/cuentas-bancarias'
import type { CuentaBancaria, CuentaBancariaForm, Empresa, Proyecto, Banco, Moneda } from '@/lib/types/proyectos'

// ─── Moneda display map ────────────────────────────────────────────────────

const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

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
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

// ─── Column manager ────────────────────────────────────────────────────────

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',  label: 'Empresa',  defaultVisible: false },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: false },
  { key: 'banco',    label: 'Banco',    defaultVisible: true  },
  { key: 'nombre',   label: 'Nombre',   defaultVisible: true  },
  { key: 'numero',   label: 'Numero',   defaultVisible: true  },
  { key: 'moneda',   label: 'Moneda',   defaultVisible: true  },
  { key: 'activo',   label: 'Activo',   defaultVisible: true  },
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

function exportCsv(rows: CuentaBancaria[], colPrefs: ColPref[]) {
  const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof CuentaBancaria])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cuentas-bancarias-${new Date().toISOString().slice(0, 10)}.csv`
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

const EMPTY_FORM: CuentaBancariaForm = {
  empresa: 0,
  proyecto: 0,
  banco: 0,
  numero: '',
  nombre: '',
  moneda: 'GTQ',
  activo: 1,
}

// ─── Skip-sanitization keys ───────────────────────────────────────────────

const SKIP_KEYS = new Set<keyof CuentaBancariaForm>(['moneda'])

// ─── Client component ──────────────────────────────────────────────────────

export function CuentasBancariasClient({
  initialData,
  empresas,
  proyectos,
  bancos,
  monedas,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: CuentaBancaria[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  bancos: Banco[]
  monedas: Moneda[]
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
  const [viewTarget, setViewTarget]     = useState<CuentaBancaria | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CuentaBancaria | null>(null)
  const [auditTarget, setAuditTarget]   = useState<CuentaBancaria | null>(null)
  const [form, setForm]                 = useState<CuentaBancariaForm>(EMPTY_FORM)
  const [colFilters, setColFilters]     = useState<ColFilters>({})

  // ─── Lookup maps ─────────────────────────────────────────────────────────

  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])
  const bancoMap    = useMemo(() => new Map(bancos.map((b) => [b.codigo, b.nombre])), [bancos])

  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa]
  )
  const bancosFiltrados = useMemo(
    () => bancos.filter((b) => b.empresa === form.empresa && b.proyecto === form.proyecto),
    [bancos, form.empresa, form.proyecto]
  )

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => { const u = { ...prev }; if (next.size === 0) delete u[col]; else u[col] = next; return u })
  }

  // Unique values for column filters
  const uniqueEmpresaNames  = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa)  ?? ''))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(r.proyecto) ?? ''))].sort(), [initialData, proyectoMap])
  const uniqueBancoNames    = useMemo(() => [...new Set(initialData.map((r) => bancoMap.get(r.banco)  ?? ''))].sort(), [initialData, bancoMap])
  const uniqueMonedaLabels  = useMemo(() => [...new Set(initialData.map((r) => r.moneda))].sort(), [initialData])

  // ─── Filtering pipeline ───────────────────────────────────────────────────

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? initialData : initialData.filter((r) =>
      r.nombre?.toLowerCase().includes(q) ||
      r.numero?.toLowerCase().includes(q) ||
      (bancoMap.get(r.banco) ?? '').toLowerCase().includes(q) ||
      String(r.codigo).includes(q)
    )
  }, [initialData, search, bancoMap])

  const filtered = useMemo(() =>
    afterSearch.filter((r) =>
      Object.entries(colFilters).every(([col, vals]) => {
        if (col === 'empresa')  return vals.has(empresaMap.get(r.empresa)  ?? '')
        if (col === 'proyecto') return vals.has(proyectoMap.get(r.proyecto) ?? '')
        if (col === 'banco')    return vals.has(bancoMap.get(r.banco)    ?? '')
        if (col === 'moneda') return vals.has(r.moneda)
        if (col === 'activo') return vals.has(r.activo === 1 ? 'Activo' : 'Inactivo')
        return vals.has(String(r[col as keyof CuentaBancaria] ?? ''))
      })
    ),
    [afterSearch, colFilters, empresaMap, proyectoMap, bancoMap]
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ─── Column prefs ─────────────────────────────────────────────────────────

  const STORAGE_KEY = `cuentas_ban_cols_v1_${userId}`
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
    const next = [...colPrefs]; const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    saveColPrefs(next)
  }
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  const tableRef = useRef<HTMLDivElement>(null)
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursorIdx((prev) => prev === null ? 0 : Math.min(prev + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursorIdx((prev) => prev === null ? 0 : Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && cursorIdx !== null) { e.preventDefault(); openView(filtered[cursorIdx]) }
    else if (e.key === 'Escape') { setCursorIdx(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, cursorIdx])

  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  // ─── Form helpers ─────────────────────────────────────────────────────────

  function f(key: keyof CuentaBancariaForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const firstProy = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = firstProy?.codigo ?? 0
        next.banco = 0
      }
      if (key === 'proyecto') {
        next.banco = 0
      }
      return next
    })
  }

  function openCreate() {
    setViewTarget(null); setIsEditing(true)
    const firstEmpresa  = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    const firstBanco    = bancos.find((b) => b.empresa === firstEmpresa && b.proyecto === firstProyecto)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto, banco: firstBanco })
    setDialogOpen(true)
  }

  function openView(cb: CuentaBancaria) {
    setViewTarget(cb); setIsEditing(false)
    setForm({
      empresa: cb.empresa,
      proyecto: cb.proyecto,
      banco: cb.banco,
      numero: cb.numero,
      nombre: cb.nombre,
      moneda: cb.moneda,
      activo: cb.activo,
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
      banco: viewTarget.banco,
      numero: viewTarget.numero,
      nombre: viewTarget.nombre,
      moneda: viewTarget.moneda,
      activo: viewTarget.activo,
    })
  }

  function handleSave() {
    if (!form.empresa)       { toast.error('Selecciona la empresa.'); return }
    if (!form.proyecto)      { toast.error('Selecciona el proyecto.'); return }
    if (!form.banco)         { toast.error('Selecciona el banco.'); return }
    if (!form.numero.trim()) { toast.error('El numero de cuenta es requerido.'); return }
    if (!form.nombre.trim()) { toast.error('El nombre de cuenta es requerido.'); return }
    if (!form.moneda.trim()) { toast.error('Selecciona la moneda.'); return }

    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateCuentaBancaria(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form, lastModified)
        : await createCuentaBancaria(form)
      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Cuenta bancaria actualizada.' : 'Cuenta bancaria creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteCuentaBancaria(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) toast.error(result.error)
      else { toast.success('Cuenta bancaria eliminada.'); router.refresh() }
      setDeleteTarget(null)
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-100 p-2.5">
            <CreditCard className="h-5 w-5 text-cyan-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Cuentas Bancarias</h1>
            <p className="text-sm text-muted-foreground">Cuentas bancarias por proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2" disabled={bancos.length === 0}>
            <Plus className="h-4 w-4" />
            Nueva Cuenta
          </Button>
        )}
      </div>

      {bancos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero crea bancos antes de agregar cuentas bancarias.
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cuentas bancarias..."
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Codigo</TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'  ? uniqueEmpresaNames  :
                      col.key === 'proyecto' ? uniqueProyectoNames :
                      col.key === 'banco'    ? uniqueBancoNames    :
                      col.key === 'moneda'   ? uniqueMonedaLabels  :
                      col.key === 'activo'   ? ['Activo', 'Inactivo'] :
                      [...new Set(initialData.map((r) => String(r[col.key as keyof CuentaBancaria] ?? '')))].sort()
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
                    ? 'No se encontraron cuentas bancarias con ese criterio.'
                    : 'Todavia no hay cuentas bancarias. Haz clic en "Nueva Cuenta" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cb, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                const flagIso = CURRENCY_FLAG_MAP.get(cb.moneda)
                return (
                  <TableRow
                    key={`${cb.empresa}-${cb.proyecto}-${cb.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-cyan-50 dark:bg-cyan-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(cb)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-cyan-50 dark:bg-cyan-950/30 border-l-[3px] border-l-cyan-600 text-cyan-700 dark:text-cyan-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {cb.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{cb.nombre}</TableCell>
                        case 'numero':
                          return <TableCell key="numero" className="font-mono text-xs text-muted-foreground">{cb.numero || '—'}</TableCell>
                        case 'empresa':
                          return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(cb.empresa) ?? `#${cb.empresa}`}</TableCell>
                        case 'proyecto':
                          return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(cb.proyecto) ?? `#${cb.proyecto}`}</TableCell>
                        case 'banco':
                          return <TableCell key="banco" className="text-muted-foreground">{bancoMap.get(cb.banco) ?? `#${cb.banco}`}</TableCell>
                        case 'moneda':
                          return (
                            <TableCell key="moneda" className="text-muted-foreground">
                              {flagIso ? (
                                <span className="flex items-center gap-1.5">
                                  <img src={`https://flagcdn.com/w20/${flagIso}.png`} alt={flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {cb.moneda}
                                </span>
                              ) : cb.moneda || '—'}
                            </TableCell>
                          )
                        case 'activo':
                          return (
                            <TableCell key="activo">
                              <Badge variant="secondary" className={cb.activo === 1 ? 'font-normal bg-emerald-100 text-emerald-700' : 'font-normal bg-muted text-muted-foreground'}>
                                {cb.activo === 1 ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          )
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{String((cb as Record<string, unknown>)[col.key] ?? '') || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${isActive ? 'bg-cyan-50 dark:bg-cyan-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(cb)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(cb)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(cb)}>
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
        <DialogContent className="flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-cyan-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${isEditing && !viewTarget ? 'bg-cyan-100' : isEditing ? 'bg-amber-100' : 'bg-cyan-100'}`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-5 w-5 text-cyan-600" />
                  : isEditing
                  ? <Pencil className="h-5 w-5 text-amber-600" />
                  : <CreditCard className="h-5 w-5 text-cyan-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nueva Cuenta Bancaria' : isEditing ? 'Editar Cuenta Bancaria' : viewTarget?.nombre}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {bancoMap.get(viewTarget.banco) ?? ''}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-1 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto pr-1">
              {!isEditing && viewTarget ? (
                /* ── View mode ── */
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Identificacion</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2"><ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)  ?? `#${viewTarget.empresa}`} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`} /></div>
                  <div className="col-span-2"><ViewField label="Codigo" value={String(viewTarget.codigo)} /></div>

                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">General</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>

                  <div className="col-span-2"><ViewField label="Banco"    value={bancoMap.get(viewTarget.banco)    ?? `#${viewTarget.banco}`} /></div>
                  <div className="col-span-2"><ViewField label="Nombre Cuenta"  value={viewTarget.nombre} /></div>
                  <ViewField label="Numero Cuenta" value={viewTarget.numero} />
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Moneda</span>
                    {(() => {
                    const flagIso = CURRENCY_FLAG_MAP.get(viewTarget.moneda)
                    return (
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {flagIso && <img src={`https://flagcdn.com/w20/${flagIso}.png`} alt={flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                        {viewTarget.moneda || '—'}
                      </span>
                    )
                  })()}
                  </div>
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Activo</span>
                    <Checkbox checked={!!viewTarget.activo} disabled />
                  </div>
                </div>
              ) : (
                /* ── Edit / Create mode ── */
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Identificacion</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
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

                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">General</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>

                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Banco *</Label>
                    <Select value={String(form.banco)} onValueChange={(v) => f('banco', Number(v))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona banco">{(v: string) => v ? (bancoMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {bancosFiltrados.length === 0
                          ? <SelectItem value="0" disabled>Sin bancos para este proyecto</SelectItem>
                          : bancosFiltrados.map((b) => <SelectItem key={b.codigo} value={String(b.codigo)}>{b.nombre}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre Cuenta *</Label>
                    <Input
                      id="nombre"
                      value={form.nombre}
                      onChange={(e) => f('nombre', e.target.value)}
                      placeholder="Ej: cuenta operativa principal..."
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="numero" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Numero Cuenta *</Label>
                    <Input
                      id="numero"
                      value={form.numero}
                      onChange={(e) => f('numero', e.target.value)}
                      placeholder="Ej: 1234567890"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda *</Label>
                    <Select value={form.moneda} onValueChange={(v) => f('moneda', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona moneda">
                          {(v: string) => {
                            const flagIso = CURRENCY_FLAG_MAP.get(v)
                            return v ? (
                              <span className="flex items-center gap-1.5">
                                {flagIso && <img src={`https://flagcdn.com/w20/${flagIso}.png`} alt={flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                                {v}
                              </span>
                            ) : null
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {monedas.map((m) => {
                          const flagIso = CURRENCY_FLAG_MAP.get(m.codigo)
                          return (
                            <SelectItem key={m.codigo} value={m.codigo}>
                              <span className="flex items-center gap-2">
                                {flagIso && <img src={`https://flagcdn.com/w20/${flagIso}.png`} alt={flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                                {m.codigo}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 py-1">
                    <Checkbox
                      id="activo"
                      checked={form.activo === 1}
                      onCheckedChange={(v: boolean) => setForm((p) => ({ ...p, activo: v ? 1 : 0 }))}
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
            <AlertDialogTitle>¿Eliminar cuenta bancaria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente <strong>{deleteTarget?.nombre}</strong> ({deleteTarget?.numero}).
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
          tabla="t_cuenta_bancaria"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
