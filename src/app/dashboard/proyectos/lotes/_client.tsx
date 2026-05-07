'use client'

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Trash2, Plus, MapPin, Search, History,
  Settings2, ChevronDown, ChevronUp, X, Receipt, ClipboardList,
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { createLote, updateLote, deleteLote, getLoteReservaInfo, type LoteReservaInfo } from '@/app/actions/lotes'
import { getLoteEstado, LOTE_ESTADO_BADGE, COUNTRY_CURRENCY_MAP } from '@/lib/constants'
import type { Empresa, Proyecto, Fase, Manzana, Lote, LoteForm, Moneda } from '@/lib/types/proyectos'

// --- Constantes ---

const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

const SKIP_KEYS = new Set(['moneda', 'manzana'])

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type ColDef = { key: string; label: string; defaultVisible: boolean; numeric?: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',   label: 'Empresa',   defaultVisible: false },
  { key: 'proyecto',  label: 'Proyecto',  defaultVisible: true  },
  { key: 'fase',      label: 'Fase',      defaultVisible: true  },
  { key: 'manzana',   label: 'Manzana',   defaultVisible: true  },
  { key: 'moneda',    label: 'Moneda',    defaultVisible: true  },
  { key: 'valor',     label: 'Precio',    defaultVisible: true,  numeric: true },
  { key: 'finca',     label: 'Finca',     defaultVisible: false },
  { key: 'libro',     label: 'Libro',     defaultVisible: false },
  { key: 'folio',     label: 'Folio',     defaultVisible: false },
  { key: 'extension', label: 'Extension', defaultVisible: true,  numeric: true },
  { key: 'norte',     label: 'Norte',     defaultVisible: false },
  { key: 'sur',       label: 'Sur',       defaultVisible: false },
  { key: 'este',      label: 'Este',      defaultVisible: false },
  { key: 'oeste',     label: 'Oeste',     defaultVisible: false },
  { key: 'otro',      label: 'Otro',      defaultVisible: false },
  { key: '__estado',  label: 'Estado',    defaultVisible: true  },
]

const EMPTY_FORM: LoteForm = {
  empresa: 0,
  proyecto: 0,
  fase: 0,
  manzana: '',
  codigo: '',
  moneda: '',
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

type ColFilters = Record<string, Set<string>>

// --- Helpers UI ---

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
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
  const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))
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

// --- Componente Principal ---

export function LotesClient({
  initialData,
  empresas,
  proyectos,
  fases,
  manzanas,
  monedas,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: Lote[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  fases: Fase[]
  manzanas: Manzana[]
  monedas: Moneda[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [reservaInfo, setReservaInfo] = useState<LoteReservaInfo | null>(null)
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

  const STORAGE_KEY = `lotes_cols_v1_${userId}`
  const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))
  const [colPrefs, setColPrefs] = useState<ColPref[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: ColPref[] = JSON.parse(saved)
        const merged = DEFAULT_PREFS.map((dp) => {
          const found = parsed.find((p) => p.key === dp.key)
          return found ?? dp
        })
        return merged.sort((a, b) => {
          const ai = parsed.findIndex((p) => p.key === a.key)
          const bi = parsed.findIndex((p) => p.key === b.key)
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
      }
    } catch { /* ignore */ }
    return DEFAULT_PREFS
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colPrefs))
  }, [colPrefs, STORAGE_KEY])

  // Maps
  const empresaMap  = useMemo(() => new Map(empresas.map((e)  => [e.codigo,  e.nombre])),  [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo,  p.nombre])),  [proyectos])
  const faseMap     = useMemo(() => new Map(fases.map((f)     => [f.codigo,  f.nombre])),  [fases])

  // Cascada en formulario
  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )
  const fasesFiltradas = useMemo(
    () => fases.filter((f) => f.empresa === form.empresa && f.proyecto === form.proyecto),
    [fases, form.empresa, form.proyecto],
  )
  const manzanasFiltradas = useMemo(
    () => manzanas.filter((m) => m.empresa === form.empresa && m.proyecto === form.proyecto && m.fase === form.fase),
    [manzanas, form.empresa, form.proyecto, form.fase],
  )

  const medida = useMemo(
    () => fases.find((f) => f.codigo === form.fase)?.medida ?? '',
    [fases, form.fase],
  )

  // Filtros tabla
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const uniqueEmpresaNames  = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa)   ?? ''))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(r.proyecto) ?? ''))].sort(), [initialData, proyectoMap])
  const uniqueFaseNames     = useMemo(() => [...new Set(initialData.map((r) => faseMap.get(r.fase)         ?? ''))].sort(), [initialData, faseMap])
  const uniqueManzanaVals   = useMemo(() => [...new Set(initialData.map((r) => r.manzana))].sort(),                         [initialData])
  const uniqueMonedaVals    = useMemo(() => [...new Set(initialData.map((r) => r.moneda))].sort(),                          [initialData])
  const uniqueEstadoVals    = ['Disponible', 'Reservado', 'Vendido']

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return initialData.filter((l) => {
      if (q &&
          !l.codigo.toLowerCase().includes(q) &&
          !l.manzana.toLowerCase().includes(q) &&
          !(proyectoMap.get(l.proyecto) ?? '').toLowerCase().includes(q) &&
          !(faseMap.get(l.fase) ?? '').toLowerCase().includes(q)) return false
      return Object.entries(colFilters).every(([col, vals]) => {
        if (col === 'empresa')  return vals.has(empresaMap.get(l.empresa)   ?? '')
        if (col === 'proyecto') return vals.has(proyectoMap.get(l.proyecto) ?? '')
        if (col === 'fase')     return vals.has(faseMap.get(l.fase)         ?? '')
        if (col === 'manzana')  return vals.has(l.manzana)
        if (col === 'moneda')   return vals.has(l.moneda)
        if (col === '__estado') return vals.has(getLoteEstado(l.promesa, l.recibo_numero))
        return vals.has(String((l as Record<string, unknown>)[col] ?? ''))
      })
    })
  }, [initialData, search, colFilters, empresaMap, proyectoMap, faseMap])

  const hasActiveFilters = Object.keys(colFilters).length > 0

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

  useEffect(() => {
    if (!viewTarget || viewTarget.recibo_numero === 0) { setReservaInfo(null); return }
    getLoteReservaInfo(viewTarget.empresa, viewTarget.proyecto, viewTarget.fase, viewTarget.manzana, viewTarget.codigo)
      .then(setReservaInfo)
      .catch(() => setReservaInfo(null))
  }, [viewTarget])

  // --- form helper ---

  const f = useCallback((key: string, value: unknown) => {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const firstPro = proyectos.find((p) => p.empresa === (v as number))
        const pCod = firstPro?.codigo ?? 0
        const firstFa = fases.find((fa) => fa.empresa === (v as number) && fa.proyecto === pCod)
        const fCod = firstFa?.codigo ?? 0
        const firstMz = manzanas.find((m) => m.empresa === (v as number) && m.proyecto === pCod && m.fase === fCod)
        next.proyecto = pCod
        next.fase     = fCod
        next.manzana  = firstMz?.codigo ?? ''
      }
      if (key === 'proyecto') {
        const firstFa = fases.find((fa) => fa.empresa === prev.empresa && fa.proyecto === (v as number))
        const fCod = firstFa?.codigo ?? 0
        const firstMz = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === (v as number) && m.fase === fCod)
        next.fase    = fCod
        next.manzana = firstMz?.codigo ?? ''
      }
      if (key === 'fase') {
        const firstMz = manzanas.find((m) => m.empresa === prev.empresa && m.proyecto === prev.proyecto && m.fase === (v as number))
        next.manzana = firstMz?.codigo ?? ''
      }
      return next
    })
  }, [proyectos, fases, manzanas])

  // --- Abrir dialog ---

  function openView(lote: Lote) {
    setViewTarget(lote)
    setIsEditing(false)
    setDialogOpen(true)
  }

  function openCreate() {
    const firstEmpresa = empresas[0]
    const empCod = firstEmpresa?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === empCod)
    const proCod = firstProyecto?.codigo ?? 0
    const firstFase = fases.find((fa) => fa.empresa === empCod && fa.proyecto === proCod)
    const faCod = firstFase?.codigo ?? 0
    const firstManzana = manzanas.find((m) => m.empresa === empCod && m.proyecto === proCod && m.fase === faCod)

    const paisFromProject = firstProyecto?.pais ?? ''
    const paisFromEmpresa = firstEmpresa?.pais ?? ''
    const detectedCountry = paisFromProject || paisFromEmpresa

    let monedaDefault = monedas[0]?.codigo ?? ''
    if (detectedCountry) {
      const iso = COUNTRY_CURRENCY_MAP[detectedCountry] ?? ''
      monedaDefault = monedas.find((m) => m.codigo === iso) ? iso : (monedas[0]?.codigo ?? '')
    } else {
      fetch('https://ipapi.co/json/')
        .then((r) => r.json())
        .then((d: Record<string, unknown>) => {
          if (d.country_code) {
            const iso = COUNTRY_CURRENCY_MAP[d.country_code as string] ?? ''
            const m = monedas.find((m) => m.codigo === iso) ? iso : (monedas[0]?.codigo ?? '')
            setForm((prev) => ({ ...prev, moneda: m }))
          }
        })
        .catch(() => {})
    }

    setForm({
      ...EMPTY_FORM,
      empresa:  empCod,
      proyecto: proCod,
      fase:     faCod,
      manzana:  firstManzana?.codigo ?? '',
      moneda:   monedaDefault,
    })
    setValorStr('')
    setExtensionStr('')
    setViewTarget(null)
    setIsEditing(true)
    setDialogOpen(true)
  }

  function startEdit() {
    if (!viewTarget) return
    setForm({
      empresa:   viewTarget.empresa,
      proyecto:  viewTarget.proyecto,
      fase:      viewTarget.fase,
      manzana:   viewTarget.manzana,
      codigo:    viewTarget.codigo,
      moneda:    viewTarget.moneda,
      valor:     viewTarget.valor,
      extension: viewTarget.extension,
      finca:     viewTarget.finca  ?? '',
      folio:     viewTarget.folio  ?? '',
      libro:     viewTarget.libro  ?? '',
      norte:     viewTarget.norte  ?? '',
      sur:       viewTarget.sur    ?? '',
      este:      viewTarget.este   ?? '',
      oeste:     viewTarget.oeste  ?? '',
      otro:      viewTarget.otro   ?? '',
    })
    setValorStr(String(viewTarget.valor))
    setExtensionStr(String(viewTarget.extension))
    setIsEditing(true)
  }

  function cancelEdit() {
    if (viewTarget) setIsEditing(false)
    else setDialogOpen(false)
  }

  // --- Guardar ---

  function handleSave() {
    startTransition(async () => {
      const valor     = parseFloat(valorStr)     || form.valor
      const extension = parseFloat(extensionStr) || form.extension
      if (viewTarget) {
        const res = await updateLote(
          viewTarget.empresa, viewTarget.proyecto, viewTarget.fase, viewTarget.manzana, viewTarget.codigo,
          { moneda: form.moneda, valor, finca: form.finca, folio: form.folio, libro: form.libro,
            extension, norte: form.norte, sur: form.sur, este: form.este, oeste: form.oeste, otro: form.otro },
          viewTarget.modifico_fecha,
        )
        if (res.error) {
          if (res.error.includes('modificado por otro usuario')) setHadConflict(true)
          toast.error(res.error)
          return
        }
        toast.success('Lote actualizado.')
        setIsEditing(false)
        router.refresh()
      } else {
        const res = await createLote({ ...form, valor, extension })
        if (res.error) { toast.error(res.error); return }
        toast.success('Lote creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  // --- Eliminar ---

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await deleteLote(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.fase, deleteTarget.manzana, deleteTarget.codigo)
      if (res.error) { toast.error(res.error); return }
      toast.success('Lote eliminado.')
      setDeleteTarget(null)
      router.refresh()
    })
  }

  // --- Export CSV ---

  function exportCsv() {
    const SKIP_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])
    const colsToExport = ['codigo', ...colPrefs
      .filter((p) => p.visible && p.key !== '__estado' && !SKIP_EXPORT.has(p.key) && p.key !== 'codigo')
      .map((p) => p.key)]
    const headers = colsToExport.map((k) => k === 'codigo' ? 'Codigo' : (ALL_COLUMNS.find((c) => c.key === k)?.label ?? k))
    const rows = filtered.map((l) =>
      colsToExport.map((k) => {
        if (k === 'empresa')  return empresaMap.get(l.empresa)   ?? ''
        if (k === 'proyecto') return proyectoMap.get(l.proyecto) ?? ''
        if (k === 'fase')     return faseMap.get(l.fase)         ?? ''
        const v = (l as Record<string, unknown>)[k]
        return v ?? ''
      }),
    )
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const date = new Date().toISOString().slice(0, 10)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `lotes-${date}.csv`
    a.click()
  }

  // --- Column manager ---

  function toggleCol(key: string) {
    setColPrefs((prev) => prev.map((p) => p.key === key ? { ...p, visible: !p.visible } : p))
  }
  function moveCol(key: string, dir: -1 | 1) {
    setColPrefs((prev) => {
      const idx = prev.findIndex((p) => p.key === key)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }
  function resetCols() { setColPrefs(DEFAULT_PREFS) }

  // --- Icon badge ---

  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100' : 'bg-rose-100'
  const iconColor   = isEditing && viewTarget ? 'text-amber-600' : 'text-rose-600'
  const modalIcon   = isEditing && !viewTarget
    ? <Plus  className={`h-4 w-4 ${iconColor}`} />
    : isEditing
    ? <Pencil className={`h-4 w-4 ${iconColor}`} />
    : <MapPin className={`h-4 w-4 ${iconColor}`} />

  function getMedida(faseCode: number) {
    return fases.find((f) => f.codigo === faseCode)?.medida ?? ''
  }

  // --- Render ---

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-100 p-2.5">
            <MapPin className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Lotes</h1>
            <p className="text-sm text-muted-foreground">Administra los lotes dentro de las manzanas de cada proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
            <Plus className="h-4 w-4" />
            Nuevo Lote
          </Button>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>Exportar CSV</Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={resetCols} />
        </div>
      </div>

      {/* Tabla */}
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
              <TableHead className="sticky left-0 z-10 bg-muted/30 whitespace-nowrap w-[90px]">
                <span className="text-xs font-medium text-muted-foreground">Codigo</span>
              </TableHead>
              {colPrefs.filter((p) => p.visible).map((pref) => {
                const col = ALL_COLUMNS.find((c) => c.key === pref.key)!
                const filterValues =
                  pref.key === 'empresa'  ? uniqueEmpresaNames  :
                  pref.key === 'proyecto' ? uniqueProyectoNames :
                  pref.key === 'fase'     ? uniqueFaseNames     :
                  pref.key === 'manzana'  ? uniqueManzanaVals   :
                  pref.key === 'moneda'   ? uniqueMonedaVals    :
                  pref.key === '__estado' ? uniqueEstadoVals    : null
                return (
                  <TableHead key={pref.key} className={`whitespace-nowrap${col.numeric ? ' text-right' : ''}`}>
                    {filterValues ? (
                      <ColumnFilter
                        label={col.label}
                        values={filterValues}
                        active={colFilters[pref.key] ?? new Set()}
                        onChange={(next) => setColFilter(pref.key, next)}
                      />
                    ) : <span className="text-xs font-medium text-muted-foreground">{col.label}</span>}
                  </TableHead>
                )
              })}
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colPrefs.filter((p) => p.visible).length + 2} className="h-24 text-center text-muted-foreground">
                  Sin resultados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lote, rowIdx) => {
                const estado = getLoteEstado(lote.promesa, lote.recibo_numero)
                const estadoBadge = LOTE_ESTADO_BADGE[estado]
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${lote.empresa}-${lote.proyecto}-${lote.fase}-${lote.manzana}-${lote.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(lote)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-l-[3px] border-l-rose-600 text-rose-700 dark:text-rose-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {lote.codigo}
                    </TableCell>
                    {colPrefs.filter((p) => p.visible).map((pref) => {
                      switch (pref.key) {
                        case 'empresa':
                          return <TableCell key="empresa"  className="whitespace-nowrap">{empresaMap.get(lote.empresa)   ?? lote.empresa}</TableCell>
                        case 'proyecto':
                          return <TableCell key="proyecto" className="whitespace-nowrap">{proyectoMap.get(lote.proyecto) ?? lote.proyecto}</TableCell>
                        case 'fase':
                          return <TableCell key="fase"     className="whitespace-nowrap">{faseMap.get(lote.fase)         ?? lote.fase}</TableCell>
                        case 'manzana':
                          return <TableCell key="manzana">{lote.manzana}</TableCell>
                        case 'moneda': {
                          const flag = CURRENCY_FLAG_MAP.get(lote.moneda)
                          return (
                            <TableCell key="moneda" className="text-muted-foreground">
                              {flag ? (
                                <span className="flex items-center gap-1.5">
                                  <img src={`https://flagcdn.com/w20/${flag}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {lote.moneda}
                                </span>
                              ) : lote.moneda || '\u2014'}
                            </TableCell>
                          )
                        }
                        case 'valor':
                          return <TableCell key="valor"     className="tabular-nums text-right">{fmt(lote.valor)}</TableCell>
                        case 'extension':
                          return <TableCell key="extension" className="tabular-nums text-right whitespace-nowrap">{fmt(lote.extension)} {getMedida(lote.fase)}</TableCell>
                        case '__estado':
                          return (
                            <TableCell key="__estado">
                              <Badge variant={estadoBadge.variant} className={estadoBadge.className}>{estado}</Badge>
                            </TableCell>
                          )
                        default: {
                          const v = (lote as Record<string, unknown>)[pref.key]
                          return <TableCell key={pref.key}>{v != null ? String(v) : '\u2014'}</TableCell>
                        }
                      }
                    })}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(lote)}>
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(lote)}>
                            <History className="mr-2 h-3.5 w-3.5" /> Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(lote)}>
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

      <p className="text-xs text-muted-foreground">{filtered.length} lote{filtered.length !== 1 ? 's' : ''}</p>

      {/* Dialog crear / ver / editar */}
      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-rose-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{modalIcon}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nuevo Lote' : isEditing ? 'Editar Lote' : `Lote ${viewTarget?.codigo}`}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {proyectoMap.get(viewTarget.proyecto) ?? ''} · {faseMap.get(viewTarget.fase) ?? ''} · {viewTarget.manzana}
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
              <TabsTrigger value="otros" className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Otros
              </TabsTrigger>
              {!isEditing && viewTarget && (
                <TabsTrigger value="promesas" className="gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Promesas
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab General */}
            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2"><ViewField label="Empresa"  value={empresaMap.get(viewTarget.empresa)   ?? ''} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? ''} /></div>
                  <ViewField label="Fase"    value={faseMap.get(viewTarget.fase) ?? ''} />
                  <ViewField label="Manzana" value={viewTarget.manzana} />
                  <ViewField label="Codigo"  value={viewTarget.codigo}  />
                  <SectionDivider label="GENERAL" />
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Moneda</span>
                    {(() => {
                      const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda)
                      return flag ? (
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <img src={`https://flagcdn.com/w20/${flag}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                          {viewTarget.moneda}
                        </span>
                      ) : <span className="text-sm font-medium">{viewTarget.moneda}</span>
                    })()}
                  </div>
                  <ViewField label="Valor"     value={viewTarget.valor ? fmt(viewTarget.valor) : ''} />
                  <ViewField label="Extension" value={viewTarget.extension ? `${fmt(viewTarget.extension)} ${getMedida(viewTarget.fase)}` : ''} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2 space-y-1.5">
                    <Label>Empresa</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona empresa">
                          {(v: string) => v && v !== '0' ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Proyecto</Label>
                    <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona proyecto">
                          {(v: string) => v && v !== '0' ? (proyectoMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fase</Label>
                    <Select value={String(form.fase)} onValueChange={(v) => f('fase', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona fase">
                          {(v: string) => v && v !== '0' ? (faseMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {fasesFiltradas.map((fa) => <SelectItem key={fa.codigo} value={String(fa.codigo)}>{fa.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Manzana</Label>
                    <Select value={form.manzana} onValueChange={(v) => f('manzana', v)} disabled={!!viewTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona manzana">
                          {(v: string) => v || null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {manzanasFiltradas.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!viewTarget ? (
                    <div className="space-y-1.5">
                      <Label>Codigo</Label>
                      <Input value={form.codigo} onChange={(e) => f('codigo', e.target.value)} placeholder="Ej: L-001" />
                    </div>
                  ) : (
                    <ViewField label="Codigo" value={viewTarget.codigo} />
                  )}
                  <SectionDivider label="GENERAL" />
                  <div className="space-y-1.5">
                    <Label>Moneda</Label>
                    <Select value={form.moneda} onValueChange={(v) => f('moneda', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona moneda">
                          {(v: string) => {
                            const flag = CURRENCY_FLAG_MAP.get(v)
                            return flag ? (
                              <span className="flex items-center gap-1.5">
                                <img src={`https://flagcdn.com/w20/${flag}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                {v}
                              </span>
                            ) : v || null
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {monedas.map((m) => {
                          const flag = CURRENCY_FLAG_MAP.get(m.codigo)
                          return (
                            <SelectItem key={m.codigo} value={m.codigo}>
                              {flag ? (
                                <span className="flex items-center gap-2">
                                  <img src={`https://flagcdn.com/w20/${flag}.png`} alt={flag} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {m.codigo}
                                </span>
                              ) : m.codigo}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor</Label>
                    <Input type="number" min={0} step="0.01" value={valorStr} onChange={(e) => setValorStr(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Extension</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="number" min={0} step="0.01" value={extensionStr} onChange={(e) => setExtensionStr(e.target.value)} placeholder="0.00" className="flex-1" />
                      {medida && <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{medida}</span>}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab Otros */}
            <TabsContent value="otros" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="REGISTRO" />
                  <ViewField label="Finca" value={viewTarget.finca} />
                  <ViewField label="Folio" value={viewTarget.folio} />
                  <ViewField label="Libro" value={viewTarget.libro} />
                  <SectionDivider label="COLINDANCIAS" />
                  <ViewField label="Norte" value={viewTarget.norte} />
                  <ViewField label="Sur"   value={viewTarget.sur}   />
                  <ViewField label="Este"  value={viewTarget.este}  />
                  <ViewField label="Oeste" value={viewTarget.oeste} />
                  <ViewField label="Otros" value={viewTarget.otro}  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="REGISTRO" />
                  <div className="space-y-1.5">
                    <Label>Finca</Label>
                    <Input value={form.finca ?? ''} onChange={(e) => f('finca', e.target.value)} placeholder="No. de finca" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Folio</Label>
                    <Input value={form.folio ?? ''} onChange={(e) => f('folio', e.target.value)} placeholder="No. de folio" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Libro</Label>
                    <Input value={form.libro ?? ''} onChange={(e) => f('libro', e.target.value)} placeholder="No. de libro" />
                  </div>
                  <SectionDivider label="COLINDANCIAS" />
                  <div className="space-y-1.5">
                    <Label>Norte</Label>
                    <Input value={form.norte ?? ''} onChange={(e) => f('norte', e.target.value)} placeholder="Colindancia norte" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sur</Label>
                    <Input value={form.sur ?? ''} onChange={(e) => f('sur', e.target.value)} placeholder="Colindancia sur" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Este</Label>
                    <Input value={form.este ?? ''} onChange={(e) => f('este', e.target.value)} placeholder="Colindancia este" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Oeste</Label>
                    <Input value={form.oeste ?? ''} onChange={(e) => f('oeste', e.target.value)} placeholder="Colindancia oeste" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Otros</Label>
                    <Input value={form.otro ?? ''} onChange={(e) => f('otro', e.target.value)} placeholder="Otras colindancias" />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab Promesas — solo en modo Ver */}
            {!isEditing && viewTarget && (
              <TabsContent value="promesas" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3"><SectionDivider label="RESERVA" /></div>
                  <ViewField
                    label="Reserva"
                    value={viewTarget.recibo_numero > 0 ? (reservaInfo?.reserva_numero ? String(reservaInfo.reserva_numero) : '') : ''}
                  />
                  <ViewField
                    label="Recibo"
                    value={viewTarget.recibo_numero > 0 ? `${viewTarget.recibo_serie ?? ''}${viewTarget.recibo_numero}` : ''}
                  />
                  <ViewField
                    label="Fecha"
                    value={viewTarget.recibo_numero > 0 ? (reservaInfo?.fecha ?? '') : ''}
                  />
                  <div className="col-span-3">
                    <ViewField
                      label="Cliente"
                      value={viewTarget.recibo_numero > 0 ? (reservaInfo?.cliente_nombre ?? '') : ''}
                    />
                  </div>
                </div>
              </TabsContent>
            )}
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
                <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente el lote{' '}
              <strong>{deleteTarget?.codigo}</strong>.
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

      {/* Audit log */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_lote"
          cuenta={auditTarget.cuenta}
          codigo={`${auditTarget.empresa}-${auditTarget.proyecto}-${auditTarget.fase}-${auditTarget.manzana}-${auditTarget.codigo}`}
          titulo={auditTarget.codigo}
        />
      )}
    </div>
  )
}