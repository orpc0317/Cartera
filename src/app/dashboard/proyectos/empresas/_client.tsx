'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Eye, Plus, Building2, Search, History, ChevronDown, ChevronUp, X, Settings2, MapPin, Trash2 } from 'lucide-react'
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
import {
  createEmpresa, updateEmpresa, deleteEmpresa,
} from '@/app/actions/empresas'
import type { Empresa, EmpresaForm, Proyecto } from '@/lib/types/proyectos'
import { REGIMENES_ISR, validarNIT } from '@/lib/constants'
import { jaroWinkler, toDbString } from '@/lib/utils'
import { CountrySelect } from '@/components/ui/country-select'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import type { Pais, Departamento, Municipio } from '@/app/actions/geo'

// ─── Helpers ───────────────────────────────────────────────────────────────

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

// ─── Campo de sólo lectura en modo vista ─────────────────────────────────

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

// ─── Definición de columnas configurables ────────────────────────────────

type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'nombre',                   label: 'Nombre Comercial', defaultVisible: true  },
  { key: 'razon_social',             label: 'Razon Social',   defaultVisible: true  },
  { key: 'pais',                     label: 'Pais',           defaultVisible: true  },
  { key: 'identificaion_tributaria', label: 'ID Tributaria',  defaultVisible: true  },
  { key: '__regimen',                label: 'Regimen',        defaultVisible: true  },
  { key: 'departamento',             label: 'Departamento',   defaultVisible: false },
  { key: 'municipio',                label: 'Municipio',      defaultVisible: false },
  { key: 'direccion',                label: 'Direccion',      defaultVisible: false },
  { key: 'codigo_postal',            label: 'Codigo postal',  defaultVisible: false },
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
                <Checkbox
                  checked={pref.visible}
                  onCheckedChange={() => onToggle(pref.key)}
                />
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

const EMPTY_FORM: EmpresaForm = {
  codigo: 0,
  nombre: '',
  razon_social: '',
  identificaion_tributaria: '',
  pais: '',
  departamento: '',
  municipio: '',
  direccion: '',
  codigo_postal: '',
  regimen_isr: 1,
}

// ─── Componente principal ──────────────────────────────────────────────────

interface Props {
  initialData: Empresa[]
  proyectos: Proyecto[]
  paises: Pais[]
  departamentos: Departamento[]
  municipios: Municipio[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

export function EmpresasClient({ initialData, proyectos, paises, departamentos, municipios, puedeAgregar, puedeModificar, puedeEliminar, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [auditTarget, setAuditTarget] = useState<Empresa | null>(null)
  const [viewTarget, setViewTarget] = useState<Empresa | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null)
  const [form, setForm] = useState<EmpresaForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Empresa[] | null>(null)
  const [colFilters, setColFilters] = useState<ColFilters>({})

  // Códigos seleccionados para cascada (no van al form, solo filtran)
  const [paisCodigo, setPaisCodigo] = useState('')
  const [deptoCodigo, setDeptoCodigo] = useState('')

  const deptosFiltrados = departamentos.filter((d) => d.pais === paisCodigo)
  const municipiosFiltrados = municipios.filter(
    (m) => m.pais === paisCodigo && m.departamento === deptoCodigo
  )

  // Valores únicos por columna (sobre datos sin filtrar)
  const uniqueVals = (key: keyof Empresa) =>
    [...new Set(initialData.map((e) => String(e[key] ?? '')))].sort()

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const updated = { ...prev }
      if (next.size === 0) delete updated[col]
      else updated[col] = next
      return updated
    })
  }

  const afterSearch = initialData.filter((e) => {
    const q = search.toLowerCase()
    return !q ||
      e.nombre?.toLowerCase().includes(q) ||
      e.razon_social?.toLowerCase().includes(q) ||
      e.identificaion_tributaria?.toLowerCase().includes(q) ||
      e.pais?.toLowerCase().includes(q) ||
      e.departamento?.toLowerCase().includes(q) ||
      e.municipio?.toLowerCase().includes(q) ||
      e.direccion?.toLowerCase().includes(q) ||
      String(e.codigo).includes(q)
  })

  const filtered = afterSearch.filter((e) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === '__regimen') return vals.has(String(e.regimen_isr))
      return vals.has(String(e[col as keyof Empresa] ?? ''))
    })
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ─ Preferencias de columnas (localStorage por usuario) ──────────────────────
  const STORAGE_KEY = `empresas_cols_v1_${userId}`

  // Siempre iniciar con DEFAULT_PREFS para que server y cliente coincidan.
  // Tras la hidratación, el useEffect aplica las preferencias guardadas.
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

  // ─ Cursor de teclado ───────────────────────────────────────────────────
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

  // Resetear cursor al cambiar los datos filtrados
  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  function buildFormFromEmpresa(empresa: Empresa): { form: EmpresaForm; paisCodigo: string; deptoCodigo: string } {
    const pCode = empresa.pais ?? ''
    const dCode = empresa.departamento ?? ''
    return {
      paisCodigo: pCode,
      deptoCodigo: dCode,
      form: {
        codigo: empresa.codigo,
        nombre: empresa.nombre,
        razon_social: empresa.razon_social ?? '',
        identificaion_tributaria: empresa.identificaion_tributaria ?? '',
        pais: pCode,
        departamento: dCode,
        municipio: empresa.municipio ?? '',
        direccion: empresa.direccion ?? '',
        codigo_postal: empresa.codigo_postal ?? '',
        regimen_isr: empresa.regimen_isr ?? 1,
      },
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

  function startEdit() {
    setIsEditing(true)
  }

  function cancelEdit() {
    if (viewTarget) {
      // Volver a modo vista — resetear form a valores originales
      const { form: f, paisCodigo: pc, deptoCodigo: dc } = buildFormFromEmpresa(viewTarget)
      setForm(f)
      setPaisCodigo(pc)
      setDeptoCodigo(dc)
      setIsEditing(false)
    } else {
      // Creando nuevo — cerrar directamente
      setDialogOpen(false)
    }
  }

  function handleField(key: keyof EmpresaForm, value: string | number) {
    const v = typeof value === 'string' && key !== 'pais' && key !== 'departamento' && key !== 'municipio'
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((f) => ({ ...f, [key]: v }))
  }

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
    if (!form.nombre.trim()) {
      toast.error('El nombre es requerido.')
      return
    }
    if (!form.razon_social.trim()) {
      toast.error('La razón social es requerida.')
      return
    }
    if (!form.identificaion_tributaria.trim()) {
      toast.error('La identificación tributaria es requerida.')
      return
    }
    if (form.pais === 'GT' && !validarNIT(form.identificaion_tributaria)) {
      toast.error('El NIT no tiene una estructura válida.')
      return
    }
    if (!form.direccion.trim()) {
      toast.error('La dirección es requerida.')
      return
    }
    if (!form.pais.trim()) {
      toast.error('El país es requerido.')
      return
    }
    if (!form.departamento.trim()) {
      toast.error('El departamento es requerido.')
      return
    }
    if (!form.municipio.trim()) {
      toast.error('El municipio es requerido.')
      return
    }

    // Verificar similitud de nombre (umbral 0.85) contra empresas ya registradas
    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((e) =>
      viewTarget ? e.codigo !== viewTarget.codigo : true
    )
    const similar = candidates.filter(
      (e) => e.nombre && jaroWinkler(normalizedInput, e.nombre) >= 0.85
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

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5">
            <Building2 className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              Administra las empresas lotificadoras
            </p>
          </div>
        </div>
        <Button onClick={openCreate} disabled={!puedeAgregar} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Search */}
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
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
        <div className="ml-auto">
          <ColumnManager
            prefs={colPrefs}
            onToggle={toggleCol}
            onMove={moveCol}
            onReset={() => saveColPrefs(DEFAULT_PREFS)}
          />
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
              {visibleCols.map((col) => {
                if (col.key === '__regimen') {
                  return (
                    <TableHead key="__regimen">
                      <ColumnFilter
                        label="Regimen"
                        values={[...new Set(initialData.map(e => REGIMENES_ISR[e.regimen_isr] ?? `#${e.regimen_isr}`))].sort()}
                        active={new Set([...(colFilters['__regimen'] ?? new Set())].map(k => REGIMENES_ISR[Number(k)] ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = Object.fromEntries(Object.entries(REGIMENES_ISR).map(([k, v]) => [v, k]))
                          const ids = new Set([...labels].map(l => byLabel[l] ?? l))
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
                      values={uniqueVals(col.key as keyof Empresa)}
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
                      case 'pais':
                        return (
                          <TableCell key="pais" className="text-muted-foreground">
                            {empresa.pais ? (() => {
                              const p = paises.find((x) => x.codigo === empresa.pais)
                              return (
                                <span className="flex items-center gap-1.5">
                                  <img src={`https://flagcdn.com/w20/${empresa.pais.toLowerCase()}.png`} alt={empresa.pais} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {p?.nombre ?? empresa.pais}
                                </span>
                              )
                            })() : '—'}
                          </TableCell>
                        )
                      case 'identificaion_tributaria':
                        return <TableCell key="identificaion_tributaria" className="font-mono text-xs text-muted-foreground">{empresa.identificaion_tributaria || '—'}</TableCell>
                      case '__regimen':
                        return (
                          <TableCell key="__regimen">
                            <Badge variant="secondary" className="font-normal">
                              {REGIMENES_ISR[empresa.regimen_isr] ?? `#${empresa.regimen_isr}`}
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
                      <DropdownMenuTrigger
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
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
                        {puedeEliminar && !proyectos.some((p) => p.empresa === empresa.codigo) && (
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
        <DialogContent className="flex flex-col w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-emerald-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${
                isEditing && !viewTarget ? 'bg-emerald-100' : isEditing ? 'bg-amber-100' : 'bg-emerald-100'
              }`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-5 w-5 text-emerald-600" />
                  : isEditing
                  ? <Pencil className="h-5 w-5 text-amber-600" />
                  : <Building2 className="h-5 w-5 text-emerald-600" />}
              </div>
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

          <Tabs defaultValue="general" className="mt-1 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto pr-1">
              {/* ── Modo Vista ── */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <ViewField label="Nombre Comercial" value={viewTarget.nombre} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Razon Social" value={viewTarget.razon_social} />
                  </div>
                  <ViewField label="Identificacion Tributaria" value={viewTarget.identificaion_tributaria} />
                  <ViewField label="Regimen ISR" value={REGIMENES_ISR[viewTarget.regimen_isr] ?? `#${viewTarget.regimen_isr}`} />
                  <div className="col-span-2">
                    <ViewField label="Direccion" value={viewTarget.direccion} />
                  </div>
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Pais</span>
                    {viewTarget.pais ? (() => {
                      const p = paises.find((x) => x.codigo === viewTarget.pais)
                      return (
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {p && <img src={`https://flagcdn.com/w20/${p.codigo.toLowerCase()}.png`} alt={p.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                          {p?.nombre ?? viewTarget.pais}
                        </span>
                      )
                    })() : <span className="text-sm font-medium">—</span>}
                  </div>
                  <ViewField label="Departamento" value={departamentos.find((d) => d.pais === viewTarget.pais && d.codigo === viewTarget.departamento)?.nombre ?? viewTarget.departamento} />
                  <ViewField label="Municipio" value={municipios.find((m) => m.pais === viewTarget.pais && m.departamento === viewTarget.departamento && m.codigo === viewTarget.municipio)?.nombre ?? viewTarget.municipio} />
                  <ViewField label="Codigo postal" value={viewTarget.codigo_postal} />
                </div>
              ) : (
              /* ── Modo Edición / Creación ── */
              <div className="grid grid-cols-2 gap-4">

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre Comercial *</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => handleField('nombre', e.target.value)}
                    placeholder="Nombre comercial"
                  />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="razon_social" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Razon Social *</Label>
                  <Input
                    id="razon_social"
                    value={form.razon_social}
                    onChange={(e) => handleField('razon_social', e.target.value)}
                    placeholder="Razón social legal"
                  />
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="id_trib" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Identificacion Tributaria *</Label>
                  <Input
                    id="id_trib"
                    value={form.identificaion_tributaria}
                    onChange={(e) => handleField('identificaion_tributaria', e.target.value)}
                    placeholder="NIT o equivalente"
                  />
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="regimen" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Regimen ISR *</Label>
                  <Select
                    value={String(form.regimen_isr)}
                    onValueChange={(v) => handleField('regimen_isr', Number(v))}
                  >
                    <SelectTrigger id="regimen">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIMENES_ISR).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="direccion" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Direccion *</Label>
                  <Input
                    id="direccion"
                    value={form.direccion}
                    onChange={(e) => handleField('direccion', e.target.value)}
                    placeholder="Dirección completa"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Pais *</Label>
                  <CountrySelect
                    paises={paises}
                    value={paisCodigo}
                    onChange={(codigo) => {
                      setPaisCodigo(codigo)
                      setDeptoCodigo('')
                      setForm((f) => ({ ...f, pais: codigo, departamento: '', municipio: '' }))
                    }}
                  />
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="departamento" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Departamento *</Label>
                  <select
                    id="departamento"
                    title="Departamento"
                    value={deptoCodigo}
                    disabled={!paisCodigo}
                    onChange={(e) => {
                      const v = e.target.value
                      setDeptoCodigo(v)
                      setForm((f) => ({ ...f, departamento: v, municipio: '' }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{paisCodigo ? 'Seleccionar departamento' : 'Primero selecciona un país'}</option>
                    {deptosFiltrados.map((d) => (
                      <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="municipio" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Municipio *</Label>
                  <select
                    id="municipio"
                    title="Municipio"
                    value={form.municipio}
                    disabled={!deptoCodigo}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((f) => ({ ...f, municipio: v }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{deptoCodigo ? 'Seleccionar municipio' : 'Primero selecciona un departamento'}</option>
                    {municipiosFiltrados.map((m) => (
                      <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="codigo_postal" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Codigo postal</Label>
                  <Input
                    id="codigo_postal"
                    value={form.codigo_postal}
                    onChange={(e) => handleField('codigo_postal', e.target.value)}
                    placeholder="Ej: 01001"
                  />
                </div>

              </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              /* Modo Vista */
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cerrar
                </Button>
                {puedeModificar && (
                  <Button onClick={startEdit} className="gap-2">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
              </>
            ) : (
              /* Modo Edición / Creación */
              <>
                <Button variant="outline" onClick={cancelEdit}>
                  {viewTarget ? 'Volver' : 'Cancelar'}
                </Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
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

      {/* Similar name warning */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => !o && setSimilarWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} empresa
                  {similarWarning && similarWarning.length > 1 ? 's' : ''} con un nombre muy parecido:
                </p>
                <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                  {similarWarning?.map((e) => (
                    <li key={e.codigo}>{e.nombre}</li>
                  ))}
                </ul>
                <p>¿Es realmente una empresa diferente y desea continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setSimilarWarning(null); doSave() }}
            >
              Sí, es diferente — Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
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
    </div>
  )
}
