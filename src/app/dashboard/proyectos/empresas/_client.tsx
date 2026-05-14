'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Eye, Plus, Building2, Search,
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
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createEmpresa, updateEmpresa, deleteEmpresa } from '@/app/actions/empresas'
import type { Empresa, EmpresaForm } from '@/lib/types/proyectos'
import { REGIMENES_ISR, validarNIT } from '@/lib/constants'
import { jaroWinkler, toDbString } from '@/lib/utils'
import { CountrySelect } from '@/components/ui/country-select'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import type { Pais, Departamento, Municipio } from '@/app/actions/geo'

// ─── Constants ─────────────────────────────────────────────────────────────

const SKIP_KEYS = new Set(['direccion_pais', 'direccion_departamento', 'direccion_municipio'])

// ─── Helper components ─────────────────────────────────────────────────────

type ColFilters = Record<string, Set<string>>

function ColumnFilter({
  label, values, active, onChange,
}: {
  label: string
  values: string[]
  active: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const isFiltered = active.size > 0
  return (
    <Popover>
      <PopoverTrigger render={
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium transition-colors hover:bg-accent ${
            isFiltered ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {label}
          <ChevronDown className="h-3 w-3" />
          {isFiltered && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {active.size}
            </span>
          )}
        </button>
      } />
      <PopoverContent className="w-52 p-2" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
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

function ViewField({ label, value }: { label: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">{label}</span>
      <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
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
  { key: 'nombre',                   label: 'Nombre',        defaultVisible: true  },
  { key: 'razon_social',             label: 'Razon Social',  defaultVisible: true  },
  { key: 'identificacion_tributaria', label: 'ID Tributaria', defaultVisible: true  },
  { key: 'direccion',                label: 'Direccion',     defaultVisible: false },
  { key: 'direccion_pais',           label: 'Pais',          defaultVisible: false },
  { key: 'direccion_departamento',   label: 'Departamento',  defaultVisible: false },
  { key: 'direccion_municipio',      label: 'Municipio',     defaultVisible: false },
  { key: 'codigo_postal',            label: 'Codigo Postal', defaultVisible: false },
  { key: '__regimen',                label: 'Regimen ISR',   defaultVisible: false },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

function ColumnManager({ prefs, onToggle, onMove, onReset }: {
  prefs: ColPref[]
  onToggle: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onReset: () => void
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
          <button type="button" onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground">
            Restablecer
          </button>
        </div>
        <div className="space-y-0.5">
          {prefs.map((pref, i) => {
            const col = ALL_COLUMNS.find((c) => c.key === pref.key)!
            return (
              <div key={pref.key} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-accent">
                <Checkbox checked={pref.visible} onCheckedChange={() => onToggle(pref.key)} />
                <span className="flex-1 text-sm">{col.label}</span>
                <button type="button" disabled={i === 0} onClick={() => onMove(pref.key, -1)}
                  title="Subir columna"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)}
                  title="Bajar columna"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Form defaults ─────────────────────────────────────────────────────────

const EMPTY_FORM: EmpresaForm = {
  codigo: 0,
  nombre: '',
  razon_social: '',
  identificacion_tributaria: '',
  direccion_pais: '',
  direccion_departamento: '',
  direccion_municipio: '',
  direccion: '',
  codigo_postal: '',
  regimen_isr: 0,
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  initialData: Empresa[]
  paises: Pais[]
  departamentos: Departamento[]
  municipios: Municipio[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

// ─── Main component ────────────────────────────────────────────────────────

export function EmpresasClient({
  initialData, paises, departamentos, municipios,
  puedeAgregar, puedeModificar, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch]           = useState('')
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [isEditing, setIsEditing]     = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [auditTarget, setAuditTarget] = useState<Empresa | null>(null)
  const [viewTarget, setViewTarget]   = useState<Empresa | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null)
  const [form, setForm]               = useState<EmpresaForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Empresa[] | null>(null)
  const [colFilters, setColFilters]   = useState<ColFilters>({})

  // Cascada geo
  const [paisCodigo, setPaisCodigo]   = useState('')
  const [deptoCodigo, setDeptoCodigo] = useState('')

  const deptosFiltrados     = departamentos.filter((d) => d.pais === paisCodigo)
  const municipiosFiltrados = municipios.filter(
    (m) => m.pais === paisCodigo && m.departamento === deptoCodigo,
  )

  // ─ Filters ──────────────────────────────────────────────────────────────

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const updated = { ...prev }
      if (next.size === 0) delete updated[col]
      else updated[col] = next
      return updated
    })
  }

  const uniqueVals = (key: keyof Empresa) =>
    [...new Set(initialData.map((e) => String(e[key] ?? '')))].sort()

  const afterSearch = initialData.filter((e) => {
    const q = search.toLowerCase()
    return !q ||
      e.nombre?.toLowerCase().includes(q) ||
      e.razon_social?.toLowerCase().includes(q) ||
      e.identificacion_tributaria?.toLowerCase().includes(q) ||
      e.direccion_pais?.toLowerCase().includes(q) ||
      e.direccion_departamento?.toLowerCase().includes(q) ||
      e.direccion_municipio?.toLowerCase().includes(q) ||
      e.direccion?.toLowerCase().includes(q) ||
      String(e.codigo).includes(q)
  })

  const filtered = afterSearch.filter((e) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === '__regimen') return vals.has(String(e.regimen_isr))
      return vals.has(String(e[col as keyof Empresa] ?? ''))
    }),
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ─ Column prefs (localStorage) ──────────────────────────────────────────

  const STORAGE_KEY = `empresas_cols_v1_${userId}`
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

  // ─ Keyboard navigation ──────────────────────────────────────────────────

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
  }, [filtered, cursorIdx])

  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  // ─ Form helpers ─────────────────────────────────────────────────────────

  function buildFormFromEmpresa(empresa: Empresa) {
    const pCode = empresa.direccion_pais ?? ''
    const dCode = empresa.direccion_departamento ?? ''
    return {
      paisCodigo: pCode,
      deptoCodigo: dCode,
      form: {
        codigo:                    empresa.codigo,
        nombre:                    empresa.nombre,
        razon_social:              empresa.razon_social ?? '',
        identificacion_tributaria:  empresa.identificacion_tributaria ?? '',
        direccion_pais:            pCode,
        direccion_departamento:    dCode,
        direccion_municipio:       empresa.direccion_municipio ?? '',
        direccion:                 empresa.direccion ?? '',
        codigo_postal:             empresa.codigo_postal ?? '',
        regimen_isr:               empresa.regimen_isr ?? 0,
      } satisfies EmpresaForm,
    }
  }

  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    setForm(EMPTY_FORM)
    setPaisCodigo('')
    setDeptoCodigo('')
    setDialogOpen(true)
  }

  function openView(empresa: Empresa) {
    const { form: f, paisCodigo: pc, deptoCodigo: dc } = buildFormFromEmpresa(empresa)
    setViewTarget(empresa)
    setForm(f)
    setPaisCodigo(pc)
    setDeptoCodigo(dc)
    setIsEditing(false)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      const { form: f, paisCodigo: pc, deptoCodigo: dc } = buildFormFromEmpresa(viewTarget)
      setForm(f)
      setPaisCodigo(pc)
      setDeptoCodigo(dc)
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  function f(key: keyof EmpresaForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => ({ ...prev, [key]: v }))
  }

  // ─ Actions ──────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteEmpresa(deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Empresa eliminada.')
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return }
    if (!form.razon_social.trim()) { toast.error('La razon social es requerida.'); return }
    if (!form.identificacion_tributaria.trim()) { toast.error('La identificacion tributaria es requerida.'); return }
    if (form.direccion_pais === 'GT' && form.identificacion_tributaria && !validarNIT(form.identificacion_tributaria)) {
      toast.error('El NIT no tiene una estructura valida.')
      return
    }
    if (!form.direccion.trim()) { toast.error('La direccion es requerida.'); return }
    if (!form.direccion_pais) { toast.error('El pais es requerido.'); return }
    if (!form.direccion_departamento) { toast.error('El departamento es requerido.'); return }
    if (!form.direccion_municipio) { toast.error('El municipio es requerido.'); return }

    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((e) => viewTarget ? e.codigo !== viewTarget.codigo : true)
    const similar = candidates.filter(
      (e) => e.nombre && jaroWinkler(normalizedInput, toDbString(e.nombre)) >= 0.85,
    )
    if (similar.length > 0) {
      setSimilarWarning(similar)
      return
    }

    doSave()
  }

  function doSave() {
    startTransition(async () => {
      const result = viewTarget
        ? await updateEmpresa(viewTarget.codigo, form, viewTarget.modifico_fecha ?? undefined)
        : await createEmpresa(form)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Empresa actualizada.' : 'Empresa creada.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function exportCSV() {
    const date = new Date().toISOString().slice(0, 10)
    const headers = ['Codigo', 'Nombre', 'Razon Social', 'ID Tributaria', 'Direccion', 'Pais', 'Departamento', 'Municipio', 'Codigo Postal', 'Regimen ISR']
    const rows = initialData.map((e) => [
      e.codigo,
      e.nombre,
      e.razon_social,
      e.identificacion_tributaria,
      e.direccion,
      paises.find((p) => p.codigo === e.direccion_pais)?.nombre ?? e.direccion_pais,
      departamentos.find((d) => d.pais === e.direccion_pais && d.codigo === e.direccion_departamento)?.nombre ?? e.direccion_departamento,
      municipios.find((m) => m.pais === e.direccion_pais && m.departamento === e.direccion_departamento && m.codigo === e.direccion_municipio)?.nombre ?? e.direccion_municipio,
      e.codigo_postal,
      REGIMENES_ISR[e.regimen_isr] ?? String(e.regimen_isr),
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `empresas-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─ Icon badge ───────────────────────────────────────────────────────────

  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100' : 'bg-emerald-100'
  const iconEl = isEditing && !viewTarget
    ? <Plus className="h-5 w-5 text-emerald-600" />
    : isEditing
    ? <Pencil className="h-5 w-5 text-amber-600" />
    : <Building2 className="h-5 w-5 text-emerald-600" />

  // ─ Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* ─ Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5">
            <Building2 className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">Administra las empresas lotificadoras</p>
          </div>
        </div>
        {puedeAgregar && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Empresa
          </Button>
        )}
      </div>

      {/* ─ Search + toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empresas..."
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
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <ColumnManager
            prefs={colPrefs}
            onToggle={toggleCol}
            onMove={moveCol}
            onReset={() => saveColPrefs(DEFAULT_PREFS)}
          />
        </div>
      </div>

      {/* ─ Tabla ────────────────────────────────────────────────────────── */}
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
              {visibleCols.map((col) => {
                if (col.key === '__regimen') {
                  return (
                    <TableHead key="__regimen">
                      <ColumnFilter
                        label="Regimen ISR"
                        values={[...new Set(initialData.map((e) => REGIMENES_ISR[e.regimen_isr] ?? String(e.regimen_isr)))].sort()}
                        active={new Set([...(colFilters['__regimen'] ?? new Set())].map((k) => REGIMENES_ISR[Number(k)] ?? k))}
                        onChange={(labels) => {
                          const byLabel = Object.fromEntries(
                            Object.entries(REGIMENES_ISR).map(([k, v]) => [v, k]),
                          )
                          const ids = new Set([...labels].map((l) => byLabel[l] ?? l))
                          setColFilter('__regimen', ids)
                        }}
                      />
                    </TableHead>
                  )
                }
                return (
                  <TableHead key={col.key}>
                    <ColumnFilter
                      label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                      values={
                        col.key === 'direccion_pais'
                          ? [...new Set(initialData.map((e) => paises.find((p) => p.codigo === e.direccion_pais)?.nombre ?? e.direccion_pais ?? ''))].sort()
                          : col.key === 'direccion_departamento'
                          ? [...new Set(initialData.map((e) => departamentos.find((d) => d.pais === e.direccion_pais && d.codigo === e.direccion_departamento)?.nombre ?? e.direccion_departamento ?? ''))].sort()
                          : col.key === 'direccion_municipio'
                          ? [...new Set(initialData.map((e) => municipios.find((m) => m.pais === e.direccion_pais && m.departamento === e.direccion_departamento && m.codigo === e.direccion_municipio)?.nombre ?? e.direccion_municipio ?? ''))].sort()
                          : uniqueVals(col.key as keyof Empresa)
                      }
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
                    ? 'No se encontraron empresas con ese criterio.'
                    : 'Todavía no hay empresas. Haz clic en "Nueva Empresa" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((empresa, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={empresa.codigo}
                    className={`group cursor-pointer transition-colors ${
                      isActive ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(empresa)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-l-[3px] border-l-emerald-600 text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {empresa.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{empresa.nombre}</TableCell>
                        case 'razon_social':
                          return <TableCell key="razon_social" className="text-muted-foreground">{empresa.razon_social || '—'}</TableCell>
                        case 'identificacion_tributaria':
                          return <TableCell key="identificacion_tributaria" className="font-mono text-xs text-muted-foreground">{empresa.identificacion_tributaria || '—'}</TableCell>
                        case 'direccion':
                          return <TableCell key="direccion" className="text-muted-foreground">{empresa.direccion || '—'}</TableCell>
                        case 'direccion_pais': {
                          const p = paises.find((x) => x.codigo === empresa.direccion_pais)
                          return (
                            <TableCell key="direccion_pais" className="text-muted-foreground">
                              {empresa.direccion_pais ? (
                                <span className="flex items-center gap-1.5">
                                  <img
                                    src={`https://flagcdn.com/w20/${empresa.direccion_pais.toLowerCase()}.png`}
                                    alt={empresa.direccion_pais}
                                    width={20}
                                    height={14}
                                    className="object-cover rounded-sm shrink-0"
                                  />
                                  {p?.nombre ?? empresa.direccion_pais}
                                </span>
                              ) : '—'}
                            </TableCell>
                          )
                        }
                        case 'direccion_departamento': {
                          const d = departamentos.find((x) => x.pais === empresa.direccion_pais && x.codigo === empresa.direccion_departamento)
                          return <TableCell key="direccion_departamento" className="text-muted-foreground">{(d?.nombre ?? empresa.direccion_departamento) || '—'}</TableCell>
                        }
                        case 'direccion_municipio': {
                          const m = municipios.find((x) => x.pais === empresa.direccion_pais && x.departamento === empresa.direccion_departamento && x.codigo === empresa.direccion_municipio)
                          return <TableCell key="direccion_municipio" className="text-muted-foreground">{(m?.nombre ?? empresa.direccion_municipio) || '—'}</TableCell>
                        }
                        case 'codigo_postal':
                          return <TableCell key="codigo_postal" className="text-muted-foreground">{empresa.codigo_postal || '—'}</TableCell>
                        case '__regimen':
                          return (
                            <TableCell key="__regimen">
                              <Badge variant="secondary" className="font-normal">
                                {REGIMENES_ISR[empresa.regimen_isr] ?? String(empresa.regimen_isr)}
                              </Badge>
                            </TableCell>
                          )
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{(empresa[col.key as keyof Empresa] as string) || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${
                      isActive ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-card group-hover:bg-muted/40'
                    }`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(empresa)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(empresa)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(empresa)}
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

      {/* ─ Ver / Crear / Editar Dialog ──────────────────────────────────── */}
      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && similarWarning) return   // no cerrar mientras el aviso de nombres similares está activo
          setDialogOpen(open)
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-emerald-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{iconEl}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nueva Empresa' : isEditing ? 'Editar Empresa' : viewTarget?.nombre}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {viewTarget.razon_social || ''}
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

              {/* ── Modo Vista ── */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <SectionDivider label="IDENTIFICACION" />
                  <div className="col-span-2">
                    <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                  </div>
                  <SectionDivider label="GENERAL" />
                  <div className="col-span-2">
                    <ViewField label="Nombre" value={viewTarget.nombre} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Razon Social" value={viewTarget.razon_social} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="ID Tributaria" value={viewTarget.identificacion_tributaria} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Direccion" value={viewTarget.direccion} />
                  </div>
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Pais</span>
                    {viewTarget.direccion_pais ? (() => {
                      const p = paises.find((x) => x.codigo === viewTarget.direccion_pais)
                      return (
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                          <img
                            src={`https://flagcdn.com/w20/${viewTarget.direccion_pais.toLowerCase()}.png`}
                            alt={viewTarget.direccion_pais}
                            width={20}
                            height={14}
                            className="object-cover rounded-sm shrink-0"
                          />
                          {p?.nombre ?? viewTarget.direccion_pais}
                        </span>
                      )
                    })() : <span className="text-[13px] font-medium text-foreground"></span>}
                  </div>
                  <ViewField
                    label="Departamento"
                    value={departamentos.find((d) => d.pais === viewTarget.direccion_pais && d.codigo === viewTarget.direccion_departamento)?.nombre ?? viewTarget.direccion_departamento}
                  />
                  <ViewField
                    label="Municipio"
                    value={municipios.find((m) => m.pais === viewTarget.direccion_pais && m.departamento === viewTarget.direccion_departamento && m.codigo === viewTarget.direccion_municipio)?.nombre ?? viewTarget.direccion_municipio}
                  />
                  <ViewField label="Codigo Postal" value={viewTarget.codigo_postal} />
                  <div className="col-span-2">
                    <ViewField label="Regimen ISR" value={REGIMENES_ISR[viewTarget.regimen_isr] ?? String(viewTarget.regimen_isr)} />
                  </div>
                </div>

              ) : (

              /* ── Modo Edicion / Creacion ── */
              <div className="grid grid-cols-2 gap-4">
                {viewTarget && (
                  <>
                    <SectionDivider label="IDENTIFICACION" />
                    <div className="col-span-2">
                      <ViewField label="Codigo" value={String(viewTarget.codigo)} />
                    </div>
                  </>
                )}
                <SectionDivider label="GENERAL" />

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => f('nombre', e.target.value)}
                    placeholder="Nombre comercial"
                  />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="razon_social" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Razon Social *</Label>
                  <Input
                    id="razon_social"
                    value={form.razon_social}
                    onChange={(e) => f('razon_social', e.target.value)}
                    placeholder="Razon social legal"
                  />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="id_trib" className="text-[11px] font-semibold tracking-wider text-muted-foreground">ID Tributaria *</Label>
                  <Input
                    id="id_trib"
                    value={form.identificacion_tributaria}
                    onChange={(e) => f('identificacion_tributaria', e.target.value)}
                    placeholder="NIT o equivalente"
                  />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="direccion" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Direccion *</Label>
                  <Input
                    id="direccion"
                    value={form.direccion}
                    onChange={(e) => f('direccion', e.target.value)}
                    placeholder="Direccion completa"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Pais *</Label>
                  <CountrySelect
                    paises={paises}
                    value={paisCodigo}
                    onChange={(codigo) => {
                      const firstDepto = departamentos.filter((d) => d.pais === codigo)[0]
                      const firstMuni  = firstDepto
                        ? municipios.filter((m) => m.pais === codigo && m.departamento === firstDepto.codigo)[0]
                        : undefined
                      setPaisCodigo(codigo)
                      setDeptoCodigo(firstDepto?.codigo ?? '')
                      setForm((prev) => ({
                        ...prev,
                        direccion_pais:          codigo,
                        direccion_departamento:   firstDepto?.codigo ?? '',
                        direccion_municipio:      firstMuni?.codigo ?? '',
                      }))
                    }}
                  />
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="departamento" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Departamento</Label>
                  <select
                    id="departamento"
                    title="Departamento"
                    value={deptoCodigo}
                    disabled={!paisCodigo}
                    onChange={(e) => {
                      const v = e.target.value
                      const firstMuni = municipios.filter((m) => m.pais === paisCodigo && m.departamento === v)[0]
                      setDeptoCodigo(v)
                      setForm((prev) => ({ ...prev, direccion_departamento: v, direccion_municipio: firstMuni?.codigo ?? '' }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{paisCodigo ? 'Selecciona departamento' : 'Primero selecciona un pais'}</option>
                    {deptosFiltrados.map((d) => (
                      <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="municipio" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Municipio</Label>
                  <select
                    id="municipio"
                    title="Municipio"
                    value={form.direccion_municipio}
                    disabled={!deptoCodigo}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, direccion_municipio: e.target.value }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{deptoCodigo ? 'Selecciona municipio' : 'Primero selecciona un departamento'}</option>
                    {municipiosFiltrados.map((m) => (
                      <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="codigo_postal" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Codigo Postal</Label>
                  <Input
                    id="codigo_postal"
                    value={form.codigo_postal}
                    onChange={(e) => f('codigo_postal', e.target.value)}
                    placeholder="Ej: 01001"
                  />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="regimen_isr" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Regimen ISR</Label>
                  <Select
                    value={String(form.regimen_isr)}
                    onValueChange={(v) => f('regimen_isr', Number(v))}
                  >
                    <SelectTrigger id="regimen_isr" className="w-full">
                      <SelectValue>
                        {(v: string) => v !== '' ? (REGIMENES_ISR[Number(v)] ?? v) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIMENES_ISR).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      {/* ─ Audit Log ────────────────────────────────────────────────────── */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_empresa"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}

      {/* ─ Similar names warning ─────────────────────────────────────────── */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => !o && setSimilarWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <div className="mb-2">
                Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} empresa
                {similarWarning && similarWarning.length > 1 ? 's' : ''} con un nombre muy parecido:
              </div>
              <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                {similarWarning?.map((e) => (
                  <li key={e.codigo}>{e.nombre}</li>
                ))}
              </ul>
              <div>¿Es realmente una empresa diferente y desea continuar?</div>
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

      {/* ─ Delete confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Se eliminará <strong>{deleteTarget?.nombre}</strong>. Esta acción no se puede deshacer.
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

    </div>
  )
}
