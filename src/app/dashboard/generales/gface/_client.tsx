'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil, Eye, Plus, ShieldCheck, Search,
  History, ChevronDown, ChevronUp, X, Settings2, MapPin, Trash2, Download, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import { createGface, updateGface, deleteGface } from '@/app/actions/gface'
import type { Empresa, Proyecto } from '@/lib/types/proyectos'
import type { Gface, GfaceForm } from '@/lib/types/gface'
import { jaroWinkler, toDbString } from '@/lib/utils'

type ColFilters = Record<string, Set<string>>
type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa', label: 'Empresa', defaultVisible: false },
  { key: 'proyecto', label: 'Proyecto', defaultVisible: true },
  { key: 'nombre', label: 'Nombre', defaultVisible: true },
  { key: 'requestor', label: 'Requestor', defaultVisible: true },
  { key: 'entity', label: 'Entidad', defaultVisible: false },
  { key: 'user_name', label: 'Usuario', defaultVisible: true },
  { key: 'web_service', label: 'Servicio Web', defaultVisible: false },
  { key: 'web_service_documento', label: 'Servicio Web de Documento', defaultVisible: false },
  { key: 'certificado_post', label: 'Certificado Post', defaultVisible: false },
  { key: 'certificado_ruta', label: 'Ruta del Certificado', defaultVisible: false },
  { key: 'certificado_nombre', label: 'Nombre del Certificado', defaultVisible: false },
  { key: 'correo_envio', label: 'Correo de Envio', defaultVisible: true },
  { key: 'correo_copia', label: 'Correo Copia', defaultVisible: false },
  { key: 'primera_firma', label: 'Primera Firma', defaultVisible: true },
  { key: 'validar_identificacion', label: 'Validar Identificacion', defaultVisible: true },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

const EMPTY_FORM: GfaceForm = {
  empresa: 0,
  proyecto: 0,
  codigo: 0,
  nombre: '',
  requestor: '',
  entity: '',
  user_name: '',
  token: '',
  web_service: '',
  web_service_documento: '',
  certificado_post: '',
  certificado_ruta: '',
  certificado_nombre: '',
  certificado_contrasena: '',
  correo_envio: '',
  correo_copia: '',
  primera_firma: 0,
  validar_identificacion: 0,
}

const SKIP_KEYS = new Set<keyof GfaceForm>([
  'requestor',
  'entity',
  'user_name',
  'token',
  'web_service',
  'web_service_documento',
  'certificado_post',
  'certificado_ruta',
  'certificado_nombre',
  'certificado_contrasena',
  'correo_envio',
  'correo_copia',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LABEL_CLASS = 'font-semibold tracking-wider text-muted-foreground'

const NEVER_EXPORT = new Set([
  'cuenta',
  'agrego_usuario',
  'modifico_usuario',
  'token',
  'certificado_contrasena',
])
const COL_LABELS: Record<string, string> = Object.fromEntries(
  [{ key: 'codigo', label: 'Codigo' }, ...ALL_COLUMNS].map((c) => [c.key, c.label])
)

function flagLabel(value: number): string {
  return value === 1 ? 'Si' : 'No'
}

function textOrEmpty(value: string | null | undefined): string {
  return value ?? ''
}

function secretMask(value: string | null | undefined): string {
  return value ? '••••••••' : ''
}

function formatCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('\n') || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function exportCsv(rows: Gface[], colPrefs: ColPref[]) {
  const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
    .filter((k) => !NEVER_EXPORT.has(k))
  const headers = keys.map((k) => COL_LABELS[k] ?? k)
  const lines = [
    headers.join(','),
    ...rows.map((r) => keys.map((k) => formatCsvCell(r[k as keyof Gface])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gface-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function ViewField({ label, value, locked = false }: { label: string; value?: string | null | number; locked?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
        <span className="block font-medium" style={{ fontSize: 'var(--ui-viewfield-value)', color: locked ? '#b4bec9' : 'var(--foreground)' }}>{value || ''}</span>
      </div>
    </div>
  )
}

function SegmentCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="col-span-2 grid gap-1.5">
      <div className="flex items-center gap-2">
        <div className="h-4 w-0.5 rounded-full bg-primary/40" />
        <span className="font-semibold uppercase tracking-wider text-primary" style={{ fontSize: 'var(--ui-section-divider)' }}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        {children}
      </div>
    </div>
  )
}

function FlagBadge({ value }: { value: number }) {
  return value === 1
    ? <Badge variant="secondary" className="font-normal bg-green-100 text-green-700">Si</Badge>
    : <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">No</Badge>
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
                const next = new Set(active)
                if (checked) next.add(v)
                else next.delete(v)
                onChange(next)
              }} />
              <span className="truncate">{v || '(vacio)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

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

function buildForm(row: Gface): GfaceForm {
  return {
    empresa: row.empresa,
    proyecto: row.proyecto,
    codigo: row.codigo,
    nombre: row.nombre,
    requestor: textOrEmpty(row.requestor),
    entity: textOrEmpty(row.entity),
    user_name: textOrEmpty(row.user_name),
    token: textOrEmpty(row.token),
    web_service: textOrEmpty(row.web_service),
    web_service_documento: textOrEmpty(row.web_service_documento),
    certificado_post: textOrEmpty(row.certificado_post),
    certificado_ruta: textOrEmpty(row.certificado_ruta),
    certificado_nombre: textOrEmpty(row.certificado_nombre),
    certificado_contrasena: textOrEmpty(row.certificado_contrasena),
    correo_envio: textOrEmpty(row.correo_envio),
    correo_copia: textOrEmpty(row.correo_copia),
    primera_firma: row.primera_firma === 1 ? 1 : 0,
    validar_identificacion: row.validar_identificacion === 1 ? 1 : 0,
  }
}

interface Props {
  initialData: Gface[]
  empresas: Empresa[]
  proyectos: Proyecto[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}

export function GfaceClient({
  initialData, empresas, proyectos,
  puedeAgregar, puedeModificar, puedeEliminar, userId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<Gface | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Gface | null>(null)
  const [auditTarget, setAuditTarget] = useState<Gface | null>(null)
  const [form, setForm] = useState<GfaceForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Gface[] | null>(null)

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.codigo, e.nombre])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [`${p.empresa}-${p.codigo}`, p.nombre])), [proyectos])
  const proyectosPorEmpresa = useMemo(
    () => proyectos.filter((p) => p.empresa === form.empresa),
    [proyectos, form.empresa],
  )

  const uniqueEmpresaNames = useMemo(() => [...new Set(initialData.map((r) => empresaMap.get(r.empresa) ?? String(r.empresa)))].sort(), [initialData, empresaMap])
  const uniqueProyectoNames = useMemo(() => [...new Set(initialData.map((r) => proyectoMap.get(`${r.empresa}-${r.proyecto}`) ?? String(r.proyecto)))].sort(), [initialData, proyectoMap])
  const uniqueText = useMemo(() => {
    const keys = ['nombre', 'requestor', 'entity', 'user_name', 'web_service', 'web_service_documento', 'certificado_post', 'certificado_ruta', 'certificado_nombre', 'correo_envio', 'correo_copia'] as const
    const out: Record<string, string[]> = {}
    for (const key of keys) {
      out[key] = [...new Set(initialData.map((r) => textOrEmpty(r[key])).filter(Boolean))].sort()
    }
    return out
  }, [initialData])
  const uniquePrimera = useMemo(() => [...new Set(initialData.map((r) => flagLabel(r.primera_firma)))].sort(), [initialData])
  const uniqueValidar = useMemo(() => [...new Set(initialData.map((r) => flagLabel(r.validar_identificacion)))].sort(), [initialData])

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const updated = { ...prev }
      if (next.size === 0) delete updated[col]
      else updated[col] = next
      return updated
    })
  }

  const afterSearch = useMemo(() => initialData.filter((row) => {
    const q = search.toLowerCase()
    return !q ||
      row.nombre.toLowerCase().includes(q) ||
      String(row.codigo).includes(q) ||
      textOrEmpty(row.requestor).toLowerCase().includes(q) ||
      textOrEmpty(row.entity).toLowerCase().includes(q) ||
      textOrEmpty(row.user_name).toLowerCase().includes(q) ||
      textOrEmpty(row.correo_envio).toLowerCase().includes(q) ||
      textOrEmpty(row.correo_copia).toLowerCase().includes(q) ||
      textOrEmpty(row.web_service).toLowerCase().includes(q)
  }), [initialData, search])

  const filtered = useMemo(() => afterSearch.filter((row) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa') return vals.has(String(row.empresa))
      if (col === 'proyecto') return vals.has(`${row.empresa}-${row.proyecto}`)
      if (col === 'primera_firma') return vals.has(flagLabel(row.primera_firma))
      if (col === 'validar_identificacion') return vals.has(flagLabel(row.validar_identificacion))
      return vals.has(textOrEmpty(row[col as keyof Gface] as string | null))
    })
  ), [afterSearch, colFilters])

  const hasActiveFilters = Object.keys(colFilters).length > 0

  const STORAGE_KEY = `gface_cols_v1_${userId}`
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
  }, [filtered, cursorIdx])

  useEffect(() => { setCursorIdx(null) }, [search, colFilters])

  function f(key: keyof GfaceForm, value: string | number) {
    const v = typeof value === 'string' && !SKIP_KEYS.has(key)
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const first = proyectos.find((p) => p.empresa === Number(value))
        next.proyecto = first?.codigo ?? 0
      }
      return next
    })
  }

  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    setSimilarWarning(null)
    const firstEmpresa = empresas[0]?.codigo ?? 0
    const firstProyecto = proyectos.find((p) => p.empresa === firstEmpresa)?.codigo ?? 0
    setForm({ ...EMPTY_FORM, empresa: firstEmpresa, proyecto: firstProyecto })
    setDialogOpen(true)
  }

  function openView(row: Gface) {
    setViewTarget(row)
    setForm(buildForm(row))
    setIsEditing(false)
    setSimilarWarning(null)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      setForm(buildForm(viewTarget))
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteGface(deleteTarget.empresa, deleteTarget.proyecto, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Certificador eliminado.')
        setDialogOpen(false)
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return }
    if (!form.empresa) { toast.error('La empresa es requerida.'); return }
    if (!form.proyecto) { toast.error('El proyecto es requerido.'); return }
    const correoEnvio = textOrEmpty(form.correo_envio).trim()
    const correoCopia = textOrEmpty(form.correo_copia).trim()
    if ((correoEnvio && !EMAIL_RE.test(correoEnvio)) || (correoCopia && !EMAIL_RE.test(correoCopia))) {
      toast.error('El correo electrónico no tiene un formato válido.')
      return
    }

    if (viewTarget && JSON.stringify(form) === JSON.stringify(buildForm(viewTarget))) {
      setDialogOpen(false)
      return
    }

    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((row) =>
      row.empresa === form.empresa && row.proyecto === form.proyecto &&
      (viewTarget ? row.codigo !== viewTarget.codigo : true)
    )
    const similar = candidates.filter(
      (row) => row.nombre && jaroWinkler(normalizedInput, toDbString(row.nombre)) >= 0.85
    )
    if (similar.length > 0) { setSimilarWarning(similar); return }

    doSave()
  }

  function doSave() {
    const lastModified = viewTarget?.modifico_fecha ?? undefined
    startTransition(async () => {
      const result = viewTarget
        ? await updateGface(viewTarget.empresa, viewTarget.proyecto, viewTarget.codigo, form, lastModified)
        : await createGface(form)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Certificador actualizado.' : 'Certificador creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  const iconBadgeBg = isEditing && viewTarget ? 'bg-amber-100' : 'bg-gray-100'
  const iconEl = isEditing && viewTarget
    ? <Pencil className="h-5 w-5 text-amber-600" />
    : isEditing
      ? <Plus className="h-5 w-5 text-gray-600" />
      : <ShieldCheck className="h-5 w-5 text-gray-600" />

  const dialogTitle = isEditing && !viewTarget
    ? 'Nuevo GFACE'
    : isEditing
      ? 'Editar GFACE'
      : (viewTarget?.nombre ?? '')

  const dialogSubtitle = viewTarget
    ? `${empresaMap.get(viewTarget.empresa) ?? ''} / ${proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? ''}`
    : undefined

  function filterValues(key: string): string[] {
    if (key === 'empresa') return uniqueEmpresaNames
    if (key === 'proyecto') return uniqueProyectoNames
    if (key === 'primera_firma') return uniquePrimera
    if (key === 'validar_identificacion') return uniqueValidar
    return uniqueText[key] ?? []
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* -- Header -- */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gray-100 p-2.5">
            <ShieldCheck className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">GFACE</h1>
            <p className="text-sm text-muted-foreground">Administra el catalogo de certificadores de documentos electronicos</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          disabled={!puedeAgregar || proyectos.length === 0}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo GFACE
        </Button>
      </div>

      {/* -- Advertencia -- */}
      {proyectos.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay proyectos disponibles. Crea un proyecto antes de agregar certificadores.
        </div>
      )}

      {/* -- Busqueda + toolbar -- */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input variant="l-border"
            placeholder="Buscar certificadores..."
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

      {/* -- Tabla -- */}
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
                    values={filterValues(col.key)}
                    active={
                      col.key === 'empresa' ? new Set([...(colFilters['empresa'] ?? new Set())].map((k) => empresaMap.get(Number(k)) ?? k)) :
                      col.key === 'proyecto' ? new Set([...(colFilters['proyecto'] ?? new Set())].map((k) => proyectoMap.get(k) ?? k)) :
                      colFilters[col.key] ?? new Set()
                    }
                    onChange={(vals) => {
                      if (col.key === 'empresa') {
                        const byLabel = new Map(empresas.map((e) => [e.nombre, String(e.codigo)]))
                        setColFilter('empresa', new Set([...vals].map((l) => byLabel.get(l) ?? l)))
                      } else if (col.key === 'proyecto') {
                        const byLabel = new Map(proyectos.map((p) => [p.nombre, `${p.empresa}-${p.codigo}`]))
                        setColFilter('proyecto', new Set([...vals].map((l) => byLabel.get(l) ?? l)))
                      } else {
                        setColFilter(col.key, vals)
                      }
                    }}
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
                    ? 'No se encontraron certificadores con ese criterio.'
                    : 'Todavia no hay certificadores. Haz clic en "Nuevo GFACE" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${row.empresa}-${row.proyecto}-${row.codigo}`}
                    className={`group cursor-pointer transition-colors ${isActive ? 'bg-gray-50 dark:bg-gray-950/30' : 'hover:bg-muted/40'}`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(row)}
                  >
                    <TableCell className={`sticky left-0 z-10 w-20 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-gray-50 dark:bg-gray-950/30 border-l-[3px] border-l-gray-600 text-gray-700 dark:text-gray-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {row.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'empresa':
                          return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(row.empresa) ?? row.empresa}</TableCell>
                        case 'proyecto':
                          return <TableCell key="proyecto" className="text-muted-foreground">{proyectoMap.get(`${row.empresa}-${row.proyecto}`) ?? row.proyecto}</TableCell>
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{row.nombre}</TableCell>
                        case 'primera_firma':
                          return <TableCell key="primera_firma"><FlagBadge value={row.primera_firma} /></TableCell>
                        case 'validar_identificacion':
                          return <TableCell key="validar_identificacion"><FlagBadge value={row.validar_identificacion} /></TableCell>
                        default:
                          return (
                            <TableCell key={col.key} className="text-muted-foreground">
                              {textOrEmpty(row[col.key as keyof Gface] as string | null)}
                            </TableCell>
                          )
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 w-12 transition-colors ${isActive ? 'bg-gray-50 dark:bg-gray-950/30' : 'bg-card group-hover:bg-muted/40'}`}>
                      <button
                        type="button"
                        onClick={() => openView(row)}
                        title={puedeModificar ? 'Ver / Editar' : 'Ver'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} certificador{filtered.length !== 1 ? 'es' : ''}</p>

      {/* -- Dialogo Ver / Crear / Editar -- */}
      <Dialog
        modal={false}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && (similarWarning !== null || deleteTarget !== null || auditTarget !== null)) return
          setDialogOpen(open)
          if (!open) { setIsEditing(false); if (hadConflict) { setHadConflict(false); router.refresh() } }
        }}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[64rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-2 bg-gradient-to-br from-gray-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${iconBadgeBg}`}>{iconEl}</div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {dialogTitle}
                </DialogTitle>
                {viewTarget && dialogSubtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {dialogSubtitle}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-0.5 flex flex-col flex-1 min-h-0">
            <div className="shrink-0 w-full"><TabsList variant="line" className="">
              <TabsTrigger value="general" className="gap-1.5 px-3 rounded-none bg-transparent border-b-2 border-b-transparent after:hidden data-active:border-b-primary data-active:text-primary">
                <MapPin className="h-3.5 w-3.5" /> General
              </TabsTrigger>
            </TabsList></div>

            <TabsContent value="general" className="mt-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
              {!isEditing && viewTarget ? (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="IDENTIFICACION">
                      <div className="col-span-2">
                        <ViewField locked label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? String(viewTarget.empresa)} />
                      </div>
                      <div className="col-span-2">
                        <ViewField label="Proyecto" value={proyectoMap.get(`${viewTarget.empresa}-${viewTarget.proyecto}`) ?? String(viewTarget.proyecto)} />
                      </div>
                      <div className="col-span-2">
                        <ViewField locked label="Codigo" value={String(viewTarget.codigo)} />
                      </div>
                    </SegmentCard>
                    <SegmentCard label="GENERAL">
                      <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>
                      <ViewField label="Requestor" value={viewTarget.requestor} />
                      <ViewField label="Entidad" value={viewTarget.entity} />
                      <ViewField label="Usuario" value={viewTarget.user_name} />
                      <ViewField label="Token" value={secretMask(viewTarget.token)} />
                    </SegmentCard>
                  </div>

                  <div className="w-px self-stretch bg-primary/30" />

                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="SERVICIO">
                      <div className="col-span-2"><ViewField label="Servicio Web" value={viewTarget.web_service} /></div>
                      <div className="col-span-2"><ViewField label="Servicio Web de Documento" value={viewTarget.web_service_documento} /></div>
                    </SegmentCard>
                    <SegmentCard label="CERTIFICADO">
                      <div className="col-span-2"><ViewField label="Certificado Post" value={viewTarget.certificado_post} /></div>
                      <div className="col-span-2"><ViewField label="Ruta del Certificado" value={viewTarget.certificado_ruta} /></div>
                      <ViewField label="Nombre del Certificado" value={viewTarget.certificado_nombre} />
                      <ViewField label="Contrasena del Certificado" value={secretMask(viewTarget.certificado_contrasena)} />
                    </SegmentCard>
                    <SegmentCard label="CORREO">
                      <ViewField label="Correo de Envio" value={viewTarget.correo_envio} />
                      <ViewField label="Correo Copia" value={viewTarget.correo_copia} />
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox checked={viewTarget.primera_firma === 1} disabled />
                        <span className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Primera Firma</span>
                      </div>
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox checked={viewTarget.validar_identificacion === 1} disabled />
                        <span className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Validar Identificacion</span>
                      </div>
                    </SegmentCard>
                  </div>
                </div>
              ) : (
                <div className="flex gap-6 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="IDENTIFICACION">
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="empresa" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Empresa *</Label>
                        <Select
                          value={form.empresa ? String(form.empresa) : ''}
                          onValueChange={(v) => f('empresa', Number(v))}
                          disabled={!!viewTarget}
                        >
                          <SelectTrigger variant="l-border" id="empresa" className="w-full">
                            <SelectValue placeholder="Selecciona empresa">
                              {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {empresas.map((e) => (
                              <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="proyecto" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Proyecto *</Label>
                        <Select
                          value={form.proyecto ? String(form.proyecto) : ''}
                          onValueChange={(v) => f('proyecto', Number(v))}
                          disabled={!!viewTarget || !form.empresa}
                        >
                          <SelectTrigger variant="l-border" id="proyecto" className="w-full">
                            <SelectValue placeholder="Selecciona proyecto">
                              {(v: string) => v ? (proyectoMap.get(`${form.empresa}-${Number(v)}`) ?? v) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {proyectosPorEmpresa.map((p) => (
                              <SelectItem key={p.codigo} value={String(p.codigo)}>{p.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </SegmentCard>
                    <SegmentCard label="GENERAL">
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="nombre" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Nombre *</Label>
                        <Input variant="l-border" id="nombre" value={form.nombre} maxLength={100} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del certificador" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="requestor" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Requestor</Label>
                        <Input variant="l-border" id="requestor" value={textOrEmpty(form.requestor)} maxLength={50} onChange={(e) => f('requestor', e.target.value)} placeholder="Requestor" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="entity" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Entidad</Label>
                        <Input variant="l-border" id="entity" value={textOrEmpty(form.entity)} maxLength={25} onChange={(e) => f('entity', e.target.value)} placeholder="Entidad" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="user_name" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Usuario</Label>
                        <Input variant="l-border" id="user_name" value={textOrEmpty(form.user_name)} maxLength={25} onChange={(e) => f('user_name', e.target.value)} placeholder="Usuario" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="token" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Token</Label>
                        <Input variant="l-border" id="token" type="password" autoComplete="new-password" value={textOrEmpty(form.token)} maxLength={50} onChange={(e) => f('token', e.target.value)} placeholder="Token" />
                      </div>
                    </SegmentCard>
                  </div>

                  <div className="w-px self-stretch bg-primary/30" />

                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SegmentCard label="SERVICIO">
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="web_service" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Servicio Web</Label>
                        <Input variant="l-border" id="web_service" value={textOrEmpty(form.web_service)} maxLength={100} onChange={(e) => f('web_service', e.target.value)} placeholder="Url del servicio web" />
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="web_service_documento" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Servicio Web de Documento</Label>
                        <Input variant="l-border" id="web_service_documento" value={textOrEmpty(form.web_service_documento)} maxLength={100} onChange={(e) => f('web_service_documento', e.target.value)} placeholder="Url del servicio de documento" />
                      </div>
                    </SegmentCard>
                    <SegmentCard label="CERTIFICADO">
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="certificado_post" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Certificado Post</Label>
                        <Input variant="l-border" id="certificado_post" value={textOrEmpty(form.certificado_post)} maxLength={100} onChange={(e) => f('certificado_post', e.target.value)} placeholder="Url de publicacion del certificado" />
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label htmlFor="certificado_ruta" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Ruta del Certificado</Label>
                        <Input variant="l-border" id="certificado_ruta" value={textOrEmpty(form.certificado_ruta)} maxLength={100} onChange={(e) => f('certificado_ruta', e.target.value)} placeholder="Ruta del certificado" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="certificado_nombre" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Nombre del Certificado</Label>
                        <Input variant="l-border" id="certificado_nombre" value={textOrEmpty(form.certificado_nombre)} maxLength={50} onChange={(e) => f('certificado_nombre', e.target.value)} placeholder="Nombre del archivo" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="certificado_contrasena" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Contrasena del Certificado</Label>
                        <Input variant="l-border" id="certificado_contrasena" type="password" autoComplete="new-password" value={textOrEmpty(form.certificado_contrasena)} maxLength={25} onChange={(e) => f('certificado_contrasena', e.target.value)} placeholder="Contrasena" />
                      </div>
                    </SegmentCard>
                    <SegmentCard label="CORREO">
                      <div className="grid gap-1">
                        <Label htmlFor="correo_envio" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Correo de Envio</Label>
                        <Input variant="l-border" id="correo_envio" type="email" value={textOrEmpty(form.correo_envio)} maxLength={50} onChange={(e) => f('correo_envio', e.target.value)} placeholder="Correo@ejemplo.com" />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="correo_copia" className={LABEL_CLASS} style={{ fontSize: 'var(--ui-form-label)' }}>Correo Copia</Label>
                        <Input variant="l-border" id="correo_copia" type="email" value={textOrEmpty(form.correo_copia)} maxLength={50} onChange={(e) => f('correo_copia', e.target.value)} placeholder="Correo@ejemplo.com" />
                      </div>
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox
                          id="primera_firma"
                          checked={form.primera_firma === 1}
                          onCheckedChange={(checked) => f('primera_firma', checked ? 1 : 0)}
                        />
                        <Label htmlFor="primera_firma" className={`${LABEL_CLASS} cursor-pointer`} style={{ fontSize: 'var(--ui-form-label)' }}>Primera Firma</Label>
                      </div>
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox
                          id="validar_identificacion"
                          checked={form.validar_identificacion === 1}
                          onCheckedChange={(checked) => f('validar_identificacion', checked ? 1 : 0)}
                        />
                        <Label htmlFor="validar_identificacion" className={`${LABEL_CLASS} cursor-pointer`} style={{ fontSize: 'var(--ui-form-label)' }}>Validar Identificacion</Label>
                      </div>
                    </SegmentCard>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 shrink-0">
            {!isEditing && viewTarget ? (
              <div className="flex w-full items-center gap-1">
                <Button variant="ghost" size="sm" className="hover:bg-gray-50 dark:hover:bg-gray-950/30" onClick={() => setAuditTarget(viewTarget)}>
                  <History className="mr-1.5 h-3.5 w-3.5" /> Historial
                </Button>
                {puedeEliminar && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(viewTarget)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
                {puedeModificar && (
                  <Button variant="ghost" size="sm" className="hover:bg-gray-50 dark:hover:bg-gray-950/30" onClick={startEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                )}
              </div>
            ) : viewTarget ? (
              <div className="flex w-full justify-end gap-2">
                <Button variant="ghost" size="sm" className="hover:bg-gray-50 dark:hover:bg-gray-950/30" onClick={cancelEdit} disabled={isPending}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button variant="ghost" size="sm" className="hover:bg-gray-50 dark:hover:bg-gray-950/30" onClick={handleSave} disabled={isPending}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> {isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            ) : (
              <div className="flex w-full justify-end">
                <Button variant="ghost" size="sm" className="hover:bg-gray-50 dark:hover:bg-gray-950/30" onClick={handleSave} disabled={isPending}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> {isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Nombres similares -- */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => { if (!o) setSimilarWarning(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <div className="mb-2">
                Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} certificador
                {similarWarning && similarWarning.length > 1 ? 'es' : ''} con un nombre muy parecido:
              </div>
              <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                {similarWarning?.map((row) => (
                  <li key={`${row.empresa}-${row.proyecto}-${row.codigo}`}>{row.nombre}</li>
                ))}
              </ul>
              <div>¿Es realmente un certificador diferente y desea continuar?</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSimilarWarning(null); doSave() }}>
              Si, es diferente — Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -- Confirmar eliminacion -- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar certificador?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Esta accion no se puede deshacer. Se eliminara permanentemente el certificador{' '}
              <strong>{deleteTarget?.nombre}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -- Historial -- */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => { if (!o) setAuditTarget(null) }}
          tabla="t_gface"
          cuenta={auditTarget.cuenta}
          registroId={{ empresa: auditTarget.empresa, proyecto: auditTarget.proyecto, codigo: auditTarget.codigo }}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
