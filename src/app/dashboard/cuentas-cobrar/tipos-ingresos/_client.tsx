'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Trash2, Plus, Search,
  History, Settings2, ChevronDown, ChevronUp, X, Tags, Download, MapPin,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createTipoIngreso, updateTipoIngreso, deleteTipoIngreso } from '@/app/actions/tipos-ingresos'
import type { TipoIngreso, TipoIngresoForm } from '@/lib/types/tipos-ingresos'
import type { Empresa, Proyecto, Moneda } from '@/lib/types/proyectos'
import { jaroWinkler, toDbString } from '@/lib/utils'

// ─── Constants ─────────────────────────────────────────────────────────────

const FORMA_CALCULO_OTROS: Record<number, string> = {
  1: 'Monto Mensual Fijo',
  2: '% (Anual) Precio Lote',
  3: '% (Anual) Precio Lote - Enganche',
  4: '% (Anual) Saldo Capital',
  5: '% Capital Cuota',
}

const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

const NEVER_EXPORT = new Set(['cuenta', 'agrego_usuario', 'modifico_usuario'])

const fmt = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Helpers ───────────────────────────────────────────────────────────────

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
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">{label}</span>
      <div className="h-8 flex items-center rounded-lg bg-muted/50 border border-border/40 px-3">
        <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
      </div>
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

// ─── Column definitions ────────────────────────────────────────────────────

type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',  label: 'Empresa',  defaultVisible: false },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: true  },
  { key: 'nombre',   label: 'Nombre',   defaultVisible: true  },
  { key: 'activo',   label: 'Activo',   defaultVisible: true  },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: 'codigo', label: 'Codigo' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"` : str
}

function exportCsv(rows: TipoIngreso[], colPrefs: ColPref[], empresaMap: Map<number, string>, proyectoMap: Map<string, string>) {
  const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => {
      if (k === 'empresa') return formatCsvCell(empresaMap.get(r.empresa) ?? r.empresa)
      if (k === 'proyecto') return formatCsvCell(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? r.proyecto)
      return formatCsvCell(r[k as keyof TipoIngreso])
    }).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tipos-ingresos-${new Date().toISOString().slice(0, 10)}.csv`
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

// ─── Defaults ──────────────────────────────────────────────────────────────

const EMPTY_FORM: TipoIngresoForm = {
  empresa: 0,
  proyecto: 0,
  nombre: '',
  etiqueta: '',
  forma_pago: 0,
  moneda: '',
  monto: 0,
  hasta_monto: 0,
  factura_item: '',
  factura_descripcion: '',
  mora: 0,
  impuesto: 0,
  editable: 0,
  activo: 1,
}

// SKIP_KEYS: campos de texto que NO deben convertirse a mayusculas.
// etiqueta: spec dice NO uppercase, SI quitar tildes (ver handler especifico abajo).
const SKIP_KEYS = new Set<keyof TipoIngresoForm>(['etiqueta', 'moneda'])

// ─── Client component ──────────────────────────────────────────────────────

export function TiposIngresosClient({
  initialData,
  empresas,
  proyectos,
  monedas,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: TipoIngreso[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  monedas: Moneda[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const tableRef = useRef<HTMLDivElement>(null)
  const STORAGE_KEY = `tipos_ingresos_cols_v1_${userId}`

  // ── Table state ──────────────────────────────────────────────────────────
  const [search, setSearch]       = useState('')
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [colPrefs, setColPrefs] = useState<ColPref[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ColPref[]
        const allKeys = ALL_COLUMNS.map((c) => c.key)
        const hasAll = allKeys.every((k) => parsed.some((p) => p.key === k))
        if (hasAll) return parsed
      }
    } catch { /* ignore */ }
    return DEFAULT_PREFS
  })

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [isEditing, setIsEditing]       = useState(false)
  const [hadConflict, setHadConflict]   = useState(false)
  const [viewTarget, setViewTarget]     = useState<TipoIngreso | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TipoIngreso | null>(null)
  const [auditTarget, setAuditTarget]   = useState<TipoIngreso | null>(null)
  const [similarWarning, setSimilarWarning] = useState<string[]>([])
  const [form, setForm]                 = useState<TipoIngresoForm>(EMPTY_FORM)

  // Actualiza un campo del form. Para campos string: elimina tildes y convierte
  // a mayusculas, excepto las keys en SKIP_KEYS.
  function f(key: keyof TipoIngresoForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((p) => ({ ...p, [key]: v }))
  }

  // ── Virtual form state (forma pago) ──────────────────────────────────────
  const [modo, setModo] = useState<'eventual' | 'estado_cuenta'>('eventual')
  const [eventualMoneda, setEventualMoneda]         = useState('')
  const [eventualMonto, setEventualMonto]           = useState(0)
  const [estadoCuentaMoneda, setEstadoCuentaMoneda] = useState('')
  const [estadoCuentaMonto, setEstadoCuentaMonto]   = useState(0)
  const [formaCalculo, setFormaCalculo]             = useState(1)
  const [hastaMonto, setHastaMonto]                 = useState(0)

  // ── Derived ──────────────────────────────────────────────────────────────
  const empresaMap  = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const proyectoDefaultMoneda = useCallback((proyectoCodigo: number) => {
    return proyectos.find((p) => p.codigo === proyectoCodigo)?.moneda ?? (monedas[0]?.codigo ?? '')
  }, [proyectos, monedas])

  const proyectosFiltrados = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  const montoLabel = formaCalculo === 1 ? 'Monto' : 'Porcentaje (%)'

  // ── Column prefs persistence ──────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colPrefs)) } catch { /* ignore */ }
  }, [colPrefs, STORAGE_KEY])

  function toggleColPref(key: string) {
    setColPrefs((prev) => prev.map((p) => p.key === key ? { ...p, visible: !p.visible } : p))
  }
  function moveColPref(key: string, dir: -1 | 1) {
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
  function resetColPrefs() { setColPrefs(DEFAULT_PREFS) }

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => { const u = { ...prev }; if (next.size === 0) delete u[col]; else u[col] = next; return u })
  }

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ── Unique filter values ──────────────────────────────────────────────────
  const uniqueEmpresaNames  = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa) ?? ''))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? ''))].sort(), [initialData, proyectoMap])
  const uniqueNombreValues  = useMemo(() => [...new Set(initialData.map((r) => r.nombre))].sort(), [initialData])

  // ── Filtering pipeline ────────────────────────────────────────────────────
  const visibleCols = useMemo(() => colPrefs.filter((p) => p.visible), [colPrefs])

  const afterSearch = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return initialData
    return initialData.filter((r) =>
      r.nombre.toLowerCase().includes(q) ||
      r.etiqueta.toLowerCase().includes(q) ||
      String(r.codigo).includes(q)
    )
  }, [initialData, search])

  const filtered = useMemo(() => {
    let rows = afterSearch
    for (const [col, active] of Object.entries(colFilters)) {
      if (active.size === 0) continue
      rows = rows.filter((r) => {
        if (col === 'empresa')  return active.has(empresaMap.get(r.empresa) ?? '')
        if (col === 'proyecto') return active.has(proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? '')
        if (col === 'nombre')   return active.has(r.nombre)
        return active.has(String(r[col as keyof TipoIngreso]))
      })
    }
    return rows
  }, [afterSearch, colFilters, empresaMap, proyectoMap])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    }
  }, [filtered, cursorIdx])

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openView(row: TipoIngreso) {
    setViewTarget(row)
    setIsEditing(false)
    setHadConflict(false)
    setDialogOpen(true)
  }

  function openCreate() {
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    const defaultMoneda = proyectoDefaultMoneda(firstProyecto)
    setViewTarget(null)
    setIsEditing(true)
    setHadConflict(false)
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setModo('eventual')
    setEventualMoneda(defaultMoneda)
    setEventualMonto(0)
    setEstadoCuentaMoneda(defaultMoneda)
    setEstadoCuentaMonto(0)
    setFormaCalculo(1)
    setHastaMonto(0)
    setDialogOpen(true)
  }

  function startEdit() {
    if (!viewTarget) return
    setIsEditing(true)
    setForm({
      empresa: viewTarget.empresa,
      proyecto: viewTarget.proyecto,
      nombre: viewTarget.nombre,
      etiqueta: viewTarget.etiqueta,
      forma_pago: viewTarget.forma_pago,
      moneda: viewTarget.moneda,
      monto: viewTarget.monto,
      hasta_monto: viewTarget.hasta_monto,
      factura_item: viewTarget.factura_item ?? '',
      factura_descripcion: viewTarget.factura_descripcion ?? '',
      mora: viewTarget.mora,
      impuesto: viewTarget.impuesto,
      editable: viewTarget.editable,
      activo: viewTarget.activo,
    })
    // Reconstruct virtual state from forma_pago
    if (viewTarget.forma_pago === 0) {
      setModo('eventual')
      setEventualMoneda(viewTarget.moneda)
      setEventualMonto(viewTarget.monto)
      setEstadoCuentaMoneda(proyectoDefaultMoneda(viewTarget.proyecto))
      setEstadoCuentaMonto(0)
      setFormaCalculo(1)
      setHastaMonto(0)
    } else {
      setModo('estado_cuenta')
      setFormaCalculo(viewTarget.forma_pago)
      setEstadoCuentaMoneda(viewTarget.moneda)
      setEstadoCuentaMonto(viewTarget.monto)
      setHastaMonto(viewTarget.hasta_monto)
      setEventualMoneda(proyectoDefaultMoneda(viewTarget.proyecto))
      setEventualMonto(0)
    }
  }

  function cancelEdit() {
    if (viewTarget) {
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function doSave() {
    // Map virtual → DB fields
    const finalForm: TipoIngresoForm = {
      ...form,
      forma_pago: modo === 'eventual' ? 0 : formaCalculo,
      monto:      modo === 'eventual' ? eventualMonto : estadoCuentaMonto,
      moneda:     modo === 'eventual' ? eventualMoneda : estadoCuentaMoneda,
      hasta_monto: modo === 'eventual' ? 0 : hastaMonto,
    }

    // Sin cambios: no ir a la base de datos
    if (viewTarget) {
      const sinCambios =
        finalForm.nombre              === viewTarget.nombre              &&
        finalForm.etiqueta            === viewTarget.etiqueta            &&
        finalForm.forma_pago          === viewTarget.forma_pago          &&
        finalForm.moneda              === viewTarget.moneda              &&
        finalForm.monto               === viewTarget.monto               &&
        finalForm.hasta_monto         === viewTarget.hasta_monto         &&
        finalForm.factura_item        === (viewTarget.factura_item        ?? '') &&
        finalForm.factura_descripcion === (viewTarget.factura_descripcion ?? '') &&
        finalForm.mora                === viewTarget.mora                &&
        finalForm.impuesto            === viewTarget.impuesto            &&
        finalForm.editable            === viewTarget.editable            &&
        finalForm.activo              === viewTarget.activo
      if (sinCambios) { setDialogOpen(false); return }
    }

    startTransition(async () => {
      const lastModified = viewTarget?.modifico_fecha ?? undefined
      const result = viewTarget
        ? await updateTipoIngreso(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, finalForm, lastModified)
        : await createTipoIngreso(finalForm)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Tipo ingreso actualizado.' : 'Tipo ingreso creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleSave() {
    // Validate required virtual fields
    if (modo === 'eventual') {
      if (!eventualMoneda) { toast.error('Selecciona una moneda para el modo Eventual.'); return }
    } else {
      if (!estadoCuentaMoneda) { toast.error('Selecciona una moneda para el modo Estado Cuenta.'); return }
    }
    if (form.impuesto === 1) {
      if (!form.factura_item.trim()) { toast.error('El campo Item es requerido cuando Impuestos esta activo.'); return }
      if (!form.factura_descripcion.trim()) { toast.error('El campo Descripcion es requerido cuando Impuestos esta activo.'); return }
    }

    // Jaro-Winkler similarity check
    const relevantRows = initialData.filter(
      (x) => x.empresa === form.empresa && x.proyecto === form.proyecto &&
      (viewTarget ? x.codigo !== viewTarget.codigo : true)
    )
    const similar = relevantRows.filter(
      (x) => jaroWinkler(toDbString(form.nombre), toDbString(x.nombre)) >= 0.85
    ).map((x) => x.nombre)

    if (similar.length > 0) {
      setSimilarWarning(similar)
      return
    }

    doSave()
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteTipoIngreso(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Tipo ingreso eliminado.')
        setDeleteTarget(null)
        router.refresh()
      }
    })
  }

  // ── Mode change helpers ───────────────────────────────────────────────────
  function switchModo(next: 'eventual' | 'estado_cuenta') {
    if (next === 'eventual') {
      setModo('eventual')
    } else {
      setModo('estado_cuenta')
      setFormaCalculo(Number(Object.keys(FORMA_CALCULO_OTROS)[0]))
    }
  }

  // ── Proyecto change ───────────────────────────────────────────────────────
  function handleProyectoChange(proyectoCodigo: number) {
    const moneda = proyectoDefaultMoneda(proyectoCodigo)
    setForm((prev) => ({ ...prev, proyecto: proyectoCodigo }))
    setEventualMoneda(moneda)
    setEstadoCuentaMoneda(moneda)
  }

  // ── Empresa change ────────────────────────────────────────────────────────
  function handleEmpresaChange(empresaCodigo: number) {
    const firstProyecto = proyectos.find((p) => p.empresa === empresaCodigo)?.codigo ?? 0
    setForm((prev) => ({ ...prev, empresa: empresaCodigo, proyecto: firstProyecto }))
    const moneda = proyectoDefaultMoneda(firstProyecto)
    setEventualMoneda(moneda)
    setEstadoCuentaMoneda(moneda)
  }

  // ── Selection button style ────────────────────────────────────────────────
  const selBtnCls = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
        : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/70'
    }`

  // ── View mode ─────────────────────────────────────────────────────────────
  const viewMoneda = viewTarget
    ? (viewTarget.forma_pago === 0 ? viewTarget.moneda : viewTarget.moneda)
    : ''
  const viewFlag = CURRENCY_FLAG_MAP.get(viewMoneda)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-yellow-100 p-2.5">
            <Tags className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Tipos Ingresos</h1>
            <p className="text-sm text-muted-foreground">Catalogo de tipos de ingresos por proyecto</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button
            onClick={openCreate}
            disabled={proyectos.length === 0}
            className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Nuevo Tipo Ingreso
          </Button>
        )}
      </div>

      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay proyectos disponibles. Crea un proyecto antes de agregar tipos de ingresos.
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tipos de ingresos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(filtered, colPrefs, empresaMap, proyectoMap)}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <ColumnManager prefs={colPrefs} onToggle={toggleColPref} onMove={moveColPref} onReset={resetColPrefs} />
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Codigo</span>
              </TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={
                      col.key === 'empresa'  ? uniqueEmpresaNames  :
                      col.key === 'proyecto' ? uniqueProyectoNames :
                      col.key === 'nombre'   ? uniqueNombreValues  : []
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
                <TableCell colSpan={visibleCols.length + 2} className="h-32 text-center text-sm text-muted-foreground">
                  {search || hasActiveFilters
                    ? 'No se encontraron tipos de ingresos con ese criterio.'
                    : 'Todavia no hay tipos de ingresos. Haz clic en "Nuevo Tipo Ingreso" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${row.empresa}-${row.proyecto}-${row.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(row)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs ${isActive ? 'bg-yellow-50 dark:bg-yellow-950/30 border-l-[3px] border-l-yellow-600 text-yellow-700 dark:text-yellow-400 font-semibold' : 'bg-card text-muted-foreground group-hover:bg-muted/40'}`}>
                      {row.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':
                          return <TableCell key={col.key} className="text-muted-foreground">{empresaMap.get(row.empresa) ?? row.empresa}</TableCell>
                        case 'proyecto':
                          return <TableCell key={col.key} className="text-muted-foreground">{proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? row.proyecto}</TableCell>
                        case 'nombre':
                          return <TableCell key={col.key} className="font-medium">{row.nombre}</TableCell>
                        case 'activo':
                          return (
                            <TableCell key={col.key}>
                              {row.activo === 1
                                ? <Badge variant="secondary" className="font-normal bg-emerald-100 text-emerald-700">Activo</Badge>
                                : <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">Inactivo</Badge>}
                            </TableCell>
                          )
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{String(row[col.key as keyof TipoIngreso] ?? '')}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 ${isActive ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(row)}>
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(row)}>
                            <History className="mr-2 h-3.5 w-3.5" />Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Eliminar
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

      {/* ── Main dialog ── */}
      <Dialog modal={false} open={dialogOpen} onOpenChange={(open) => {
        if (!open && similarWarning.length > 0) return
        setDialogOpen(open)
        if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
      }}>
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-yellow-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${
                isEditing && !viewTarget ? 'bg-yellow-100' :
                isEditing ? 'bg-amber-100' : 'bg-yellow-100'
              }`}>
                {isEditing && !viewTarget
                  ? <Plus className={`h-4 w-4 ${isEditing && !viewTarget ? 'text-yellow-600' : 'text-amber-600'}`} />
                  : isEditing
                  ? <Pencil className="h-4 w-4 text-amber-600" />
                  : <Tags className="h-4 w-4 text-yellow-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nuevo Tipo Ingreso' : isEditing ? 'Editar Tipo Ingreso' : viewTarget?.nombre}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''}
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
              {!isEditing && viewTarget ? (
                // ── View mode ──────────────────────────────────────────────
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2"><ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa)} /></div>
                  <div className="col-span-2"><ViewField label="Proyecto" value={proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`)} /></div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                    <div /><div />
                  </div>

                  <SectionDivider label="GENERAL" />
                  <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <ViewField label="Etiqueta" value={viewTarget.etiqueta} />
                    <div /><div />
                  </div>

                  <SectionDivider label="FORMA PAGO" />
                  {/* Selection Buttons — view mode always disabled */}
                  <div className="col-span-2 flex gap-3">
                    <button type="button" className={selBtnCls(viewTarget.forma_pago === 0)} disabled>
                      Eventual
                    </button>
                    <button type="button" className={selBtnCls(viewTarget.forma_pago !== 0)} disabled>
                      Estado Cuenta
                    </button>
                  </div>

                  {viewTarget.forma_pago === 0 ? (
                    // Eventual view
                    <div className="col-span-2 grid grid-cols-3 gap-3">
                      <div>
                        {viewTarget.moneda && (
                          <div className="grid gap-1">
                            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda</span>
                            <div className="h-8 flex items-center rounded-lg bg-muted/50 border border-border/40 px-3">
                              <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                                {CURRENCY_FLAG_MAP.get(viewTarget.moneda) && (
                                  <img src={`https://flagcdn.com/w20/${CURRENCY_FLAG_MAP.get(viewTarget.moneda)}.png`} width={20} height={14} alt="" className="rounded-sm shrink-0" />
                                )}
                                {viewTarget.moneda}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <ViewField label="Monto" value={viewTarget.monto ? fmt(viewTarget.monto) : ''} />
                      <div />
                    </div>
                  ) : (
                    // Estado Cuenta view
                    <>
                      <div className="col-span-2">
                        <ViewField label="Forma Calculo" value={FORMA_CALCULO_OTROS[viewTarget.forma_pago]} />
                      </div>
                      <div className="col-span-2 grid grid-cols-3 gap-3">
                        <div>
                          {viewTarget.moneda && (
                            <div className="grid gap-1">
                              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda</span>
                              <div className="h-8 flex items-center rounded-lg bg-muted/50 border border-border/40 px-3">
                                <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                                  {CURRENCY_FLAG_MAP.get(viewTarget.moneda) && (
                                    <img src={`https://flagcdn.com/w20/${CURRENCY_FLAG_MAP.get(viewTarget.moneda)}.png`} width={20} height={14} alt="" className="rounded-sm shrink-0" />
                                  )}
                                  {viewTarget.moneda}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <ViewField
                          label={viewTarget.forma_pago === 1 ? 'Monto' : 'Porcentaje (%)'}
                          value={viewTarget.monto ? fmt(viewTarget.monto) : ''}
                        />
                        <ViewField label="Hasta Monto" value={viewTarget.hasta_monto ? fmt(viewTarget.hasta_monto) : ''} />
                      </div>
                    </>
                  )}

                  <SectionDivider label="FACTURACION" />
                  <ViewField label="Item" value={viewTarget.factura_item} />
                  <ViewField label="Descripcion" value={viewTarget.factura_descripcion} />

                  <SectionDivider label="OTROS PARAMETROS" />
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={!!viewTarget.fijo} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Fijo</span>
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={!!viewTarget.editable} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Editable</span>
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={!!viewTarget.impuesto} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Impuestos</span>
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={!!viewTarget.mora} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Mora</span>
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={!!viewTarget.activo} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Activo</span>
                    </div>
                    <div />
                  </div>
                </div>
              ) : (
                // ── Edit / Create mode ─────────────────────────────────────
                <div className="grid grid-cols-2 gap-4">
                  <SectionDivider label="IDENTIFICACION" />

                  {/* Empresa */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="empresa" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                    {viewTarget ? (
                      <ViewField label="" value={empresaMap.get(form.empresa)} />
                    ) : (
                      <Select value={String(form.empresa)} onValueChange={(v) => handleEmpresaChange(Number(v))}>
                        <SelectTrigger id="empresa" className="w-full"><SelectValue>{(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Proyecto */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="proyecto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                    {viewTarget ? (
                      <ViewField label="" value={proyectoMap.get(`${form.empresa}-${form.proyecto}`)} />
                    ) : (
                      <Select value={String(form.proyecto)} onValueChange={(v) => handleProyectoChange(Number(v))}>
                        <SelectTrigger id="proyecto" className="w-full"><SelectValue>{(v: string) => v ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {proyectosFiltrados.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Codigo (solo edicion) */}
                  {viewTarget && (
                    <div className="col-span-2 grid grid-cols-3 gap-4">
                      <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                      <div /><div />
                    </div>
                  )}

                  <SectionDivider label="GENERAL" />

                  {/* Nombre */}
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre *</Label>
                    <Input id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del tipo ingreso" />
                  </div>

                  {/* Etiqueta */}
                  <div className="col-span-2 grid grid-cols-3 gap-4">
                    <div className="grid gap-1">
                      <Label htmlFor="etiqueta" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Etiqueta *</Label>
                      <Input id="etiqueta" maxLength={10} value={form.etiqueta} onChange={(e) => f('etiqueta', e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))} placeholder="Ej: cuota" />
                    </div>
                    <div /><div />
                  </div>

                  <SectionDivider label="FORMA PAGO" />

                  {/* Selection Buttons */}
                  <div className="col-span-2 flex gap-3">
                    <button type="button" className={selBtnCls(modo === 'eventual')}
                      onClick={() => switchModo('eventual')}
                      disabled={!isEditing}>
                      Eventual
                    </button>
                    <button type="button" className={selBtnCls(modo === 'estado_cuenta')}
                      onClick={() => switchModo('estado_cuenta')}
                      disabled={!isEditing}>
                      Estado Cuenta
                    </button>
                  </div>

                  {/* Eventual fields */}
                  {modo === 'eventual' && (
                    <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                      <div className="grid gap-1">
                        <Label htmlFor="eventual_moneda" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda *</Label>
                        <Select value={eventualMoneda} onValueChange={setEventualMoneda}>
                          <SelectTrigger id="eventual_moneda" className="w-full">
                            <SelectValue>
                              {(v: string) => {
                                const flag = CURRENCY_FLAG_MAP.get(v)
                                return v ? (
                                  <span className="flex items-center gap-1.5">
                                    {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt="" className="rounded-sm" />}
                                    {v}
                                  </span>
                                ) : null
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {monedas.map((m) => {
                              const flag = CURRENCY_FLAG_MAP.get(m.codigo)
                              return (
                                <SelectItem key={m.codigo} value={m.codigo}>
                                  <span className="flex items-center gap-1.5">
                                    {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt="" className="rounded-sm" />}
                                    {m.codigo}
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="eventual_monto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Monto *</Label>
                        <Input id="eventual_monto" type="number" min={0} value={eventualMonto || ''} onChange={(e) => setEventualMonto(Number(e.target.value))} style={{ MozAppearance: 'textfield' }} className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                      </div>
                      <div />
                    </div>
                  )}

                  {/* Estado Cuenta fields */}
                  {modo === 'estado_cuenta' && (
                    <>
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="grid gap-1">
                          <Label htmlFor="forma_calculo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Forma Calculo *</Label>
                          <Select value={String(formaCalculo)} onValueChange={(v) => setFormaCalculo(Number(v))}>
                            <SelectTrigger id="forma_calculo" className="w-full"><SelectValue>{(v: string) => v ? (FORMA_CALCULO_OTROS[Number(v)] ?? v) : null}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {Object.entries(FORMA_CALCULO_OTROS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div />
                      </div>
                      <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                        <div className="grid gap-1">
                          <Label htmlFor="ec_moneda" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda *</Label>
                          <Select value={estadoCuentaMoneda} onValueChange={setEstadoCuentaMoneda}>
                            <SelectTrigger id="ec_moneda" className="w-full">
                              <SelectValue>
                                {(v: string) => {
                                  const flag = CURRENCY_FLAG_MAP.get(v)
                                  return v ? (
                                    <span className="flex items-center gap-1.5">
                                      {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt="" className="rounded-sm" />}
                                      {v}
                                    </span>
                                  ) : null
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {monedas.map((m) => {
                                const flag = CURRENCY_FLAG_MAP.get(m.codigo)
                                return (
                                  <SelectItem key={m.codigo} value={m.codigo}>
                                    <span className="flex items-center gap-1.5">
                                      {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} width={20} height={14} alt="" className="rounded-sm" />}
                                      {m.codigo}
                                    </span>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="ec_monto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">{montoLabel} *</Label>
                          <Input id="ec_monto" type="number" min={0} value={estadoCuentaMonto || ''} onChange={(e) => setEstadoCuentaMonto(Number(e.target.value))} style={{ MozAppearance: 'textfield' }} className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="hasta_monto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Hasta Monto</Label>
                          <Input id="hasta_monto" type="number" min={0} value={hastaMonto || ''} onChange={(e) => setHastaMonto(Number(e.target.value))} style={{ MozAppearance: 'textfield' }} className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                        </div>
                      </div>
                    </>
                  )}

                  <SectionDivider label="FACTURACION" />
                  <div className="grid gap-1">
                    <Label htmlFor="factura_item" className={`text-[11px] font-semibold tracking-wider text-muted-foreground${form.impuesto === 1 ? '' : ' opacity-50'}`}>
                      Item {form.impuesto === 1 && '*'}
                    </Label>
                    <Input
                      id="factura_item"
                      value={form.factura_item}
                      onChange={(e) => f('factura_item', e.target.value)}
                      disabled={form.impuesto !== 1}
                      placeholder="Item de factura"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="factura_descripcion" className={`text-[11px] font-semibold tracking-wider text-muted-foreground${form.impuesto === 1 ? '' : ' opacity-50'}`}>
                      Descripcion {form.impuesto === 1 && '*'}
                    </Label>
                    <Input
                      id="factura_descripcion"
                      value={form.factura_descripcion}
                      onChange={(e) => f('factura_descripcion', e.target.value)}
                      disabled={form.impuesto !== 1}
                      placeholder="Descripcion de factura"
                    />
                  </div>

                  <SectionDivider label="OTROS PARAMETROS" />
                  <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox id="fijo" checked={false} disabled />
                      <Label htmlFor="fijo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Fijo</Label>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox id="editable" checked={!!form.editable} onCheckedChange={(v) => setForm((p) => ({ ...p, editable: v ? 1 : 0 }))} />
                      <Label htmlFor="editable" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Editable</Label>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id="impuesto"
                        checked={!!form.impuesto}
                        onCheckedChange={(v) => {
                          const val = v ? 1 : 0
                          setForm((p) => ({
                            ...p,
                            impuesto: val,
                            factura_item: val ? p.factura_item : '',
                            factura_descripcion: val ? p.factura_descripcion : '',
                          }))
                        }}
                      />
                      <Label htmlFor="impuesto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Impuestos</Label>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox id="mora" checked={!!form.mora} onCheckedChange={(v) => setForm((p) => ({ ...p, mora: v ? 1 : 0 }))} />
                      <Label htmlFor="mora" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Mora</Label>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox id="activo" checked={!!form.activo} onCheckedChange={(v) => setForm((p) => ({ ...p, activo: v ? 1 : 0 }))} />
                      <Label htmlFor="activo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Activo</Label>
                    </div>
                    <div />
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
                <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo ingreso</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Esta accion no se puede deshacer. ¿Deseas eliminar el tipo ingreso <strong>{deleteTarget?.nombre}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Similar name warning ── */}
      <AlertDialog open={similarWarning.length > 0} onOpenChange={(open) => { if (!open) setSimilarWarning([]) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombre similar encontrado</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <p className="mb-2">Se encontraron tipos de ingresos con nombres similares en este proyecto:</p>
              <ul className="list-disc pl-5 space-y-1">
                {similarWarning.map((n) => <li key={n} className="font-medium">{n}</li>)}
              </ul>
              <p className="mt-2">¿Deseas continuar de todas formas?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSimilarWarning([])}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSimilarWarning([]); doSave() }}>
              Si, es diferente — Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Audit log ── */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(open) => { if (!open) setAuditTarget(null) }}
          tabla="t_tipo_ingreso"
          registroId={{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, codigo: auditTarget.codigo }}
        />
      )}
    </div>
  )
}
