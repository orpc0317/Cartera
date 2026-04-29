'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Eye, Plus, Users, Search,
  History, ChevronDown, ChevronUp, X, Settings2, MapPin, Trash2, Receipt,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { CountrySelect } from '@/components/ui/country-select'
import { PhoneField, DIAL_CODES, splitPhone } from '@/components/ui/phone-field'
import { createCliente, updateCliente, deleteCliente } from '@/app/actions/clientes'
import { REGIMENES_IVA, validarNIT, validarDPI } from '@/lib/constants'
import type { Empresa, Proyecto, Cliente, ClienteForm } from '@/lib/types/proyectos'
import type { Pais, Departamento, Municipio } from '@/app/actions/geo'
import { jaroWinkler, toDbString } from '@/lib/utils'

// ─── Tipos locales ─────────────────────────────────────────────────────────

type ColFilters = Record<string, Set<string>>
type ColDef  = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

// ─── Columnas ──────────────────────────────────────────────────────────────

const ALL_COLUMNS: ColDef[] = [
  { key: '__proyecto',                label: 'Proyecto',        defaultVisible: true  },
  { key: 'nombre',                    label: 'Nombre',          defaultVisible: true  },
  { key: 'telefono1',                 label: 'Telefono',        defaultVisible: true  },
  { key: 'correo',                    label: 'Correo',          defaultVisible: true  },
  { key: '__tipo_identificacion',     label: 'Tipo ID',         defaultVisible: true  },
  { key: 'identificacion_tributaria', label: 'ID Tributaria',   defaultVisible: true  },
  { key: '__regimen_iva',             label: 'Regimen IVA',     defaultVisible: true  },
  { key: 'direccion',                 label: 'Direccion',       defaultVisible: false },
  { key: 'direccion_pais',            label: 'Pais',            defaultVisible: false },
  { key: 'codigo_postal',             label: 'Cod. Postal',     defaultVisible: false },
  { key: 'nombre_factura',            label: 'Nombre Factura',  defaultVisible: false },
  { key: 'telefono2',                 label: 'Telefono 2',      defaultVisible: false },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// ─── Formulario vacío ──────────────────────────────────────────────────────

const TIPO_IDENTIFICACION_LABELS: Record<number, string> = { 0: 'NIT', 1: 'DPI', 2: 'Extranjero' }

const EMPTY_FORM: ClienteForm = {
  empresa: 0,
  proyecto: 0,
  codigo: 0,
  nombre: '',
  telefono1: '',
  telefono2: '',
  correo: '',
  nombre_factura: '',
  identificacion_tributaria: '',
  tipo_identificacion: 0,
  regimen_iva: 1,
  direccion: '',
  direccion_pais: '',
  direccion_departamento: '',
  direccion_municipio: '',
  codigo_postal: '',
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
  initialData: Cliente[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  paises: Pais[]
  departamentos: Departamento[]
  municipios: Municipio[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

// ─── Componente principal ──────────────────────────────────────────────────

export function ClientesClient({
  initialData, empresas, proyectos, paises, departamentos, municipios,
  puedeAgregar, puedeModificar, puedeEliminar, userId,
}: Props) {
  // Teléfono: lógica igual que Proyectos
  const [tel1Iso, setTel1Iso] = useState('')
  const [tel1Local, setTel1Local] = useState('')
  const [tel2Iso, setTel2Iso] = useState('')
  const [tel2Local, setTel2Local] = useState('')

  // Existing code continues...
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Búsqueda y filtros ────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})

  // ── Diálogo ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<Cliente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [auditTarget, setAuditTarget] = useState<Cliente | null>(null)

  // ── Formulario ────────────────────────────────────────────────────────
  const [form, setForm] = useState<ClienteForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Cliente[] | null>(null)
  const [paisCodigo, setPaisCodigo] = useState('')
  const [deptoCodigo, setDeptoCodigo] = useState('')

  // Sincronizar estado local con form (solo cuando hay valor — evita sobreescribir el default ISO al crear)
  useEffect(() => {
    if (!form.telefono1) return
    const { iso, local } = splitPhone(form.telefono1)
    setTel1Iso(iso)
    setTel1Local(local)
  }, [form.telefono1])
  useEffect(() => {
    if (!form.telefono2) return
    const { iso, local } = splitPhone(form.telefono2)
    setTel2Iso(iso)
    setTel2Local(local)
  }, [form.telefono2])

  // ── Mapas para FKs ────────────────────────────────────────────────────
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo, p.nombre])), [proyectos])

  // ── Proyectos filtrados por empresa (para selects del modal) ──────────
  const proyectosPorEmpresa = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  // ── Geo (para formulario) ─────────────────────────────────────────────
  const deptosFiltrados = departamentos.filter((d) => d.pais === paisCodigo)
  const municipiosFiltrados = municipios.filter((m) => m.pais === paisCodigo && m.departamento === deptoCodigo)

  // ── Pipeline de filtrado ──────────────────────────────────────────────
  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const u = { ...prev }
      if (next.size === 0) delete u[col]
      else u[col] = next
      return u
    })
  }

  const afterSearch = useMemo(() => initialData.filter((c) => {
    const q = search.toLowerCase()
    return !q ||
      c.nombre?.toLowerCase().includes(q) ||
      c.telefono1?.toLowerCase().includes(q) ||
      c.correo?.toLowerCase().includes(q) ||
      c.identificacion_tributaria?.toLowerCase().includes(q) ||
      String(c.codigo).includes(q)
  }), [initialData, search])

  const filtered = useMemo(() => afterSearch.filter((c) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === '__tipo_identificacion') return vals.has(String(c.tipo_identificacion ?? 0))
      if (col === '__regimen_iva') return vals.has(String(c.regimen_iva))
      if (col === '__proyecto') return vals.has(String(c.proyecto))
      return vals.has(String(c[col as keyof Cliente] ?? ''))
    })
  ), [afterSearch, colFilters])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // ── Preferencias de columnas ──────────────────────────────────────────
  const STORAGE_KEY = `clientes_cols_v1_${userId}`
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
  const visibleCols = colPrefs.filter((p) => p.visible)

  // ── Valores únicos para filtros de columna ────────────────────────────
  function uniqueVals(key: keyof Cliente) {
    return [...new Set(initialData.map((c) => String(c[key] ?? '')))].sort()
  }

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

  // ── Helpers de formulario ────────────────────────────────────────────
  const SKIP_KEYS = new Set<string>(['correo', 'direccion_pais', 'direccion_departamento', 'direccion_municipio'])

  function f(key: keyof ClienteForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key as string)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const fp = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = fp?.codigo ?? 0
        const isoFromProyecto = fp?.pais ?? ''
        if (!next.telefono1) { setTel1Iso(isoFromProyecto); setTel1Local('') }
        if (!next.telefono2) { setTel2Iso(isoFromProyecto); setTel2Local('') }
        next.direccion_pais = isoFromProyecto; next.direccion_departamento = ''; next.direccion_municipio = ''
        setPaisCodigo(isoFromProyecto); setDeptoCodigo('')
      }
      if (key === 'proyecto') {
        const fp = proyectos.find((p) => p.codigo === Number(value))
        const isoFromProyecto = fp?.pais ?? ''
        if (!next.telefono1) { setTel1Iso(isoFromProyecto); setTel1Local('') }
        if (!next.telefono2) { setTel2Iso(isoFromProyecto); setTel2Local('') }
        next.direccion_pais = isoFromProyecto; next.direccion_departamento = ''; next.direccion_municipio = ''
        setPaisCodigo(isoFromProyecto); setDeptoCodigo('')
      }
      return next
    })
  }

  function buildFormFromCliente(c: Cliente) {
    const pCode = c.direccion_pais ?? ''
    const dCode = c.direccion_departamento ?? ''
    return {
      paisCodigo: pCode,
      deptoCodigo: dCode,
      form: {
        empresa: c.empresa,
        proyecto: c.proyecto,
        codigo: c.codigo,
        nombre: c.nombre,
        telefono1: c.telefono1,
        telefono2: c.telefono2 ?? '',
        correo: c.correo ?? '',
        nombre_factura: c.nombre_factura ?? '',
        identificacion_tributaria: c.identificacion_tributaria ?? '',
        tipo_identificacion: c.tipo_identificacion ?? 0,
        regimen_iva: c.regimen_iva,
        direccion: c.direccion,
        direccion_pais: pCode,
        direccion_departamento: dCode,
        direccion_municipio: c.direccion_municipio ?? '',
        codigo_postal: c.codigo_postal ?? '',
      } satisfies ClienteForm,
    }
  }

  // ── Acciones de diálogo ──────────────────────────────────────────────
  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)
    const firstProyectoCodigo = firstProyecto?.codigo ?? 0
    const defaultPhoneIso = firstProyecto?.pais ?? ''
    setForm({
      ...EMPTY_FORM,
      empresa: firstEmpresa,
      proyecto: firstProyectoCodigo,
      direccion_pais: defaultPhoneIso,
    })
    setPaisCodigo(defaultPhoneIso)
    setDeptoCodigo('')
    setTel1Iso(defaultPhoneIso); setTel1Local('')
    setTel2Iso(defaultPhoneIso); setTel2Local('')
    setDialogOpen(true)
  }

  function openView(cliente: Cliente) {
    const { form: fm, paisCodigo: pc, deptoCodigo: dc } = buildFormFromCliente(cliente)
    setViewTarget(cliente)
    setForm(fm)
    setPaisCodigo(pc)
    setDeptoCodigo(dc)
    setIsEditing(false)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      const { form: fm, paisCodigo: pc, deptoCodigo: dc } = buildFormFromCliente(viewTarget)
      setForm(fm); setPaisCodigo(pc); setDeptoCodigo(dc)
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────
  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteCliente(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Cliente eliminado.')
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  // ── Guardar ──────────────────────────────────────────────────────────
  function handleSave() {
    if (!form.nombre.trim())    { toast.error('El nombre es requerido.'); return }
    if (!form.telefono1.trim()) { toast.error('El teléfono es requerido.'); return }
    if (form.direccion_pais === 'GT' && form.tipo_identificacion === 0 && form.identificacion_tributaria.trim() && !validarNIT(form.identificacion_tributaria)) {
      toast.error('El NIT no tiene una estructura válida.')
      return
    }
    if (form.tipo_identificacion === 1 && form.identificacion_tributaria.trim() && !validarDPI(form.identificacion_tributaria)) {
      toast.error('El DPI debe contener exactamente 13 dígitos numéricos y tener una estructura de CUI válida.')
      return
    }
    if (!form.direccion.trim()) { toast.error('La dirección es requerida.'); return }
    if (!form.empresa)          { toast.error('La empresa es requerida.'); return }
    if (!form.proyecto)         { toast.error('El proyecto es requerido.'); return }
    if (!form.direccion_pais)   { toast.error('El país es requerido.'); return }
    if (!form.direccion_departamento) { toast.error('El departamento es requerido.'); return }
    if (!form.direccion_municipio)    { toast.error('El municipio es requerido.'); return }

    // Verificar similitud de nombre (umbral 0.85) contra clientes del mismo proyecto
    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((cl) =>
      cl.empresa === form.empresa && cl.proyecto === form.proyecto &&
      (viewTarget ? cl.codigo !== viewTarget.codigo : true)
    )
    const similar = candidates.filter(
      (cl) => cl.nombre && jaroWinkler(normalizedInput, toDbString(cl.nombre)) >= 0.85
    )
    if (similar.length > 0) { setSimilarWarning(similar); return }

    doSave()
  }

  function doSave() {
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateCliente(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form, lastModified)
        : await createCliente(form)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Cliente actualizado.' : 'Cliente creado.')
        setDialogOpen(false)
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
          <div className="rounded-xl bg-indigo-100 p-2.5">
            <Users className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">Administra los clientes por proyecto</p>
          </div>
        </div>
        <Button onClick={openCreate} disabled={!puedeAgregar} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* ── Búsqueda + ColumnManager ── */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
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
        <div className="ml-auto">
          <ColumnManager prefs={colPrefs} onToggle={toggleCol} onMove={moveCol} onReset={() => saveColPrefs(DEFAULT_PREFS)} />
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
                if (col.key === '__tipo_identificacion') {
                  return (
                    <TableHead key="__tipo_identificacion">
                      <ColumnFilter
                        label="Tipo ID"
                        values={Object.values(TIPO_IDENTIFICACION_LABELS)}
                        active={new Set([...(colFilters['__tipo_identificacion'] ?? new Set())].map((k) => TIPO_IDENTIFICACION_LABELS[Number(k)] ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = Object.fromEntries(Object.entries(TIPO_IDENTIFICACION_LABELS).map(([k, v]) => [v, k]))
                          setColFilter('__tipo_identificacion', new Set([...labels].map((l) => byLabel[l] ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                if (col.key === '__regimen_iva') {
                  return (
                    <TableHead key="__regimen_iva">
                      <ColumnFilter
                        label="Regimen IVA"
                        values={[...new Set(initialData.map((c) => REGIMENES_IVA[c.regimen_iva] ?? `#${c.regimen_iva}`))].sort()}
                        active={new Set([...(colFilters['__regimen_iva'] ?? new Set())].map((k) => REGIMENES_IVA[Number(k)] ?? `#${k}`))}
                        onChange={(labels) => {
                          const byLabel = Object.fromEntries(Object.entries(REGIMENES_IVA).map(([k, v]) => [v, k]))
                          setColFilter('__regimen_iva', new Set([...labels].map((l) => byLabel[l] ?? l)))
                        }}
                      />
                    </TableHead>
                  )
                }
                return (
                  <TableHead key={col.key}>
                    <ColumnFilter
                      label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                      values={uniqueVals(col.key as keyof Cliente)}
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
                    ? 'No se encontraron clientes con ese criterio.'
                    : 'Todavía no hay clientes. Haz clic en "Nuevo Cliente" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cliente, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${cliente.empresa}-${cliente.proyecto}-${cliente.codigo}`}
                    className={`group cursor-pointer transition-colors ${
                      isActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(cliente)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-l-[3px] border-l-indigo-600 text-indigo-700 dark:text-indigo-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {cliente.codigo}
                    </TableCell>

                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{cliente.nombre}</TableCell>

                        case '__proyecto':
                          return (
                            <TableCell key="__proyecto" className="text-muted-foreground">
                              {proyectoMap.get(cliente.proyecto) ?? `#${cliente.proyecto}`}
                            </TableCell>
                          )

                        case 'telefono1':
                          return <TableCell key="telefono1" className="text-muted-foreground">{cliente.telefono1 || '—'}</TableCell>

                        case 'correo':
                          return <TableCell key="correo" className="text-muted-foreground">{cliente.correo || '—'}</TableCell>

                        case 'identificacion_tributaria':
                          return <TableCell key="identificacion_tributaria" className="font-mono text-xs text-muted-foreground">{cliente.identificacion_tributaria || '—'}</TableCell>

                        case '__tipo_identificacion':
                          return (
                            <TableCell key="__tipo_identificacion">
                              <Badge variant="outline" className="font-normal">
                                {TIPO_IDENTIFICACION_LABELS[cliente.tipo_identificacion ?? 0] ?? `#${cliente.tipo_identificacion}`}
                              </Badge>
                            </TableCell>
                          )

                        case '__regimen_iva':
                          return (
                            <TableCell key="__regimen_iva">
                              <Badge variant="secondary" className="font-normal">
                                {REGIMENES_IVA[cliente.regimen_iva] ?? `#${cliente.regimen_iva}`}
                              </Badge>
                            </TableCell>
                          )

                        case 'direccion_pais': {
                          const p = paises.find((x) => x.codigo === cliente.direccion_pais)
                          return (
                            <TableCell key="direccion_pais" className="text-muted-foreground">
                              {cliente.direccion_pais ? (
                                <span className="flex items-center gap-1.5">
                                  <img src={`https://flagcdn.com/w20/${cliente.direccion_pais.toLowerCase()}.png`} alt={cliente.direccion_pais} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {p?.nombre ?? cliente.direccion_pais}
                                </span>
                              ) : '—'}
                            </TableCell>
                          )
                        }

                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">
                            {(cliente[col.key as keyof Cliente] as string) || '—'}
                          </TableCell>
                      }
                    })}

                    <TableCell className={`sticky right-0 z-10 transition-colors ${
                      isActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-card group-hover:bg-muted/40'
                    }`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(cliente)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(cliente)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          {puedeEliminar && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(cliente)}
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
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-indigo-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${isEditing && !viewTarget ? 'bg-indigo-100' : isEditing ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-5 w-5 text-indigo-600" />
                  : isEditing
                  ? <Pencil className="h-5 w-5 text-amber-600" />
                  : <Users className="h-5 w-5 text-indigo-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nuevo Cliente' : isEditing ? 'Editar Cliente' : viewTarget?.nombre}
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
              <TabsTrigger value="facturacion" className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Facturación
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">

              {/* ── Vista ── */}
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">

                  <div className="col-span-2">
                    <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Proyecto" value={proyectoMap.get(viewTarget.proyecto) ?? `#${viewTarget.proyecto}`} />
                  </div>
                  <div className="col-span-2">
                    <ViewField label="Nombre Cliente" value={viewTarget.nombre} />
                  </div>

                  <SectionDivider label="Contacto" />

                  <ViewField label="Telefono" value={viewTarget.telefono1} />
                  <ViewField label="Telefono 2" value={viewTarget.telefono2} />
                  <div className="col-span-2">
                    <ViewField label="Correo" value={viewTarget.correo} />
                  </div>

                  <SectionDivider label="Direccion" />

                  <div className="col-span-2">
                    <ViewField label="Direccion" value={viewTarget.direccion} />
                  </div>

                  {/* País con bandera */}
                  <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
                    <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Pais</span>
                    {viewTarget.direccion_pais ? (() => {
                      const p = paises.find((x) => x.codigo === viewTarget.direccion_pais)
                      return (
                        <span className="flex items-center gap-1.5 text-[13px] font-medium">
                          {p && <img src={`https://flagcdn.com/w20/${p.codigo.toLowerCase()}.png`} alt={p.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                          {p?.nombre ?? viewTarget.direccion_pais}
                        </span>
                      )
                    })() : <span className="text-[13px] font-medium">—</span>}
                  </div>

                  <ViewField
                    label="Departamento"
                    value={departamentos.find((d) => d.pais === viewTarget.direccion_pais && d.codigo === viewTarget.direccion_departamento)?.nombre ?? viewTarget.direccion_departamento}
                  />
                  <ViewField
                    label="Municipio"
                    value={municipios.find((m) => m.pais === viewTarget.direccion_pais && m.departamento === viewTarget.direccion_departamento && m.codigo === viewTarget.direccion_municipio)?.nombre ?? viewTarget.direccion_municipio}
                  />
                  <ViewField label="Cod. Postal" value={viewTarget.codigo_postal} />

                </div>

              ) : (
              /* ── Edición / Creación ── */
              <div className="grid grid-cols-2 gap-4">

                {/* Empresa */}
                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                  <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona empresa">{(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                    <SelectContent>{empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Proyecto */}
                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Proyecto *</Label>
                  <Select value={String(form.proyecto)} onValueChange={(v) => f('proyecto', Number(v))} disabled={!!viewTarget || !form.empresa}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona proyecto">{(v: string) => v ? (proyectoMap.get(Number(v)) ?? v) : null}</SelectValue></SelectTrigger>
                    <SelectContent>{proyectosPorEmpresa.map((p) => <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre Cliente *</Label>
                  <Input id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre completo del cliente" />
                </div>

                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Contacto</span>
                  <div className="flex-1 border-t border-primary/30" />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Telefono *</Label>
                  <PhoneField
                    iso={tel1Iso}
                    local={tel1Local}
                    onIsoChange={(v) => { setTel1Iso(v); f('telefono1', v && DIAL_CODES[v] ? `+${DIAL_CODES[v]}${tel1Local}` : tel1Local) }}
                    onLocalChange={(v) => { setTel1Local(v); f('telefono1', tel1Iso && DIAL_CODES[tel1Iso] ? `+${DIAL_CODES[tel1Iso]}${v}` : v) }}
                    placeholder="Número local"
                  />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Telefono 2</Label>
                  <PhoneField
                    iso={tel2Iso}
                    local={tel2Local}
                    onIsoChange={(v) => { setTel2Iso(v); f('telefono2', v && DIAL_CODES[v] ? `+${DIAL_CODES[v]}${tel2Local}` : tel2Local) }}
                    onLocalChange={(v) => { setTel2Local(v); f('telefono2', tel2Iso && DIAL_CODES[tel2Iso] ? `+${DIAL_CODES[tel2Iso]}${v}` : v) }}
                    placeholder="Número local"
                  />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="correo" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Correo</Label>
                  <Input id="correo" type="email" value={form.correo} onChange={(e) => setForm((p) => ({ ...p, correo: e.target.value }))} placeholder="Correo@ejemplo.com" />
                </div>

                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Direccion</span>
                  <div className="flex-1 border-t border-primary/30" />
                </div>

                <div className="col-span-2 grid gap-1">
                  <Label htmlFor="direccion" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Direccion *</Label>
                  <Input id="direccion" value={form.direccion} onChange={(e) => f('direccion', e.target.value)} placeholder="Dirección completa" />
                </div>

                <div className="grid gap-1">
                  <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Pais *</Label>
                  <CountrySelect
                    paises={paises}
                    value={paisCodigo}
                    onChange={(codigo) => {
                      setPaisCodigo(codigo)
                      setDeptoCodigo('')
                      setForm((p) => ({ ...p, direccion_pais: codigo, direccion_departamento: '', direccion_municipio: '' }))
                    }}
                  />
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="depto" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Departamento *</Label>
                  <select
                    id="depto"
                    title="Departamento"
                    value={deptoCodigo}
                    disabled={!paisCodigo}
                    onChange={(e) => {
                      const v = e.target.value
                      setDeptoCodigo(v)
                      setForm((p) => ({ ...p, direccion_departamento: v, direccion_municipio: '' }))
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    value={form.direccion_municipio}
                    disabled={!deptoCodigo}
                    onChange={(e) => setForm((p) => ({ ...p, direccion_municipio: e.target.value }))}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{deptoCodigo ? 'Seleccionar municipio' : 'Primero selecciona un departamento'}</option>
                    {municipiosFiltrados.map((m) => (
                      <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <Label htmlFor="codigo_postal" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Cod. Postal</Label>
                  <Input id="codigo_postal" value={form.codigo_postal} onChange={(e) => f('codigo_postal', e.target.value)} placeholder="Código postal" />
                </div>

              </div>
            )}
            </TabsContent>

            {/* ── Tab Facturación ── */}
            <TabsContent value="facturacion" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <ViewField label="Nombre Factura" value={viewTarget.nombre_factura} />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <ViewField label="Tipo ID" value={TIPO_IDENTIFICACION_LABELS[viewTarget.tipo_identificacion ?? 0] ?? `#${viewTarget.tipo_identificacion}`} />
                    <ViewField label="ID Tributaria" value={viewTarget.identificacion_tributaria} />
                    <ViewField label="Regimen IVA" value={REGIMENES_IVA[viewTarget.regimen_iva] ?? `#${viewTarget.regimen_iva}`} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="nombre_factura" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre Factura</Label>
                    <Input id="nombre_factura" value={form.nombre_factura} onChange={(e) => f('nombre_factura', e.target.value)} placeholder="Nombre para facturación (si difiere)" />
                  </div>

                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <Label htmlFor="tipo_id" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Tipo ID</Label>
                      <Select value={String(form.tipo_identificacion)} onValueChange={(v) => f('tipo_identificacion', Number(v))}>
                        <SelectTrigger id="tipo_id" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPO_IDENTIFICACION_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1">
                      <Label htmlFor="id_trib" className="text-[11px] font-semibold tracking-wider text-muted-foreground">ID Tributaria</Label>
                      <Input id="id_trib" value={form.identificacion_tributaria} onChange={(e) => f('identificacion_tributaria', e.target.value)} placeholder="NIT o equivalente" />
                    </div>

                    <div className="grid gap-1">
                      <Label htmlFor="regimen_iva" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Regimen IVA</Label>
                      <Select value={String(form.regimen_iva)} onValueChange={(v) => f('regimen_iva', Number(v))}>
                        <SelectTrigger id="regimen_iva" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(REGIMENES_IVA).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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

      {/* Similar name warning */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => !o && setSimilarWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} cliente
                  {similarWarning && similarWarning.length > 1 ? 's' : ''} con un nombre muy parecido:
                </p>
                <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                  {similarWarning?.map((cl) => (
                    <li key={cl.codigo}>{cl.nombre}</li>
                  ))}
                </ul>
                <p>¿Es realmente un cliente diferente y desea continuar?</p>
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
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{' '}
              <strong>{deleteTarget?.nombre}</strong>.
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
          tabla="t_cliente"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
