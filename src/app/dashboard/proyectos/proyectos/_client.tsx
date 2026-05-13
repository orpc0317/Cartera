'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Eye, Plus, FolderKanban, Search, History, ChevronDown, ChevronUp, X, Settings2, Trash2, Upload, ImageIcon, AlertCircle, MapPin, SlidersHorizontal, Download } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import {
  createProyecto, updateProyecto, deleteProyecto, uploadProjectLogo,
} from '@/app/actions/proyectos'
import { AuditLogDialog } from '@/components/ui/audit-log-dialog'
import type { Empresa, Proyecto, ProyectoForm, Fase, Moneda } from '@/lib/types/proyectos'
import type { Pais, Departamento, Municipio } from '@/app/actions/geo'
import { CountrySelect } from '@/components/ui/country-select'
import { jaroWinkler, toDbString } from '@/lib/utils'

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
            <button type="button" onClick={() => onChange(new Set())}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-0.5">
      <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">{label}</span>
      <span className="block text-[13px] font-medium text-foreground">{value || ''}</span>
    </div>
  )
}

// ─── Monedas ─────────────────────────────────────────────────────────────
const CURRENCY_FLAG_MAP = new Map<string, string>([
  ['ARS', 'ar'], ['BOB', 'bo'], ['BRL', 'br'], ['CAD', 'ca'],
  ['CLP', 'cl'], ['COP', 'co'], ['CRC', 'cr'], ['CUP', 'cu'],
  ['DOP', 'do'], ['EUR', 'eu'], ['GBP', 'gb'], ['GTQ', 'gt'],
  ['HNL', 'hn'], ['MXN', 'mx'], ['NIO', 'ni'], ['PAB', 'pa'],
  ['PEN', 'pe'], ['PYG', 'py'], ['SVC', 'sv'], ['USD', 'us'],
  ['UYU', 'uy'], ['VES', 've'],
])

// ─── Códigos de marcación telefónica ─────────────────────────────────────
const PHONE_COUNTRIES: { iso: string; code: string; name: string }[] = [
  { iso: 'AR', code: '54',  name: 'Argentina' },
  { iso: 'BO', code: '591', name: 'Bolivia' },
  { iso: 'BR', code: '55',  name: 'Brasil' },
  { iso: 'CA', code: '1',   name: 'Canadá' },
  { iso: 'CL', code: '56',  name: 'Chile' },
  { iso: 'CO', code: '57',  name: 'Colombia' },
  { iso: 'CR', code: '506', name: 'Costa Rica' },
  { iso: 'CU', code: '53',  name: 'Cuba' },
  { iso: 'DE', code: '49',  name: 'Alemania' },
  { iso: 'DO', code: '1',   name: 'Rep. Dominicana' },
  { iso: 'EC', code: '593', name: 'Ecuador' },
  { iso: 'ES', code: '34',  name: 'España' },
  { iso: 'FR', code: '33',  name: 'Francia' },
  { iso: 'GB', code: '44',  name: 'Reino Unido' },
  { iso: 'GT', code: '502', name: 'Guatemala' },
  { iso: 'HN', code: '504', name: 'Honduras' },
  { iso: 'IT', code: '39',  name: 'Italia' },
  { iso: 'MX', code: '52',  name: 'México' },
  { iso: 'NI', code: '505', name: 'Nicaragua' },
  { iso: 'PA', code: '507', name: 'Panamá' },
  { iso: 'PE', code: '51',  name: 'Perú' },
  { iso: 'PT', code: '351', name: 'Portugal' },
  { iso: 'PY', code: '595', name: 'Paraguay' },
  { iso: 'SV', code: '503', name: 'El Salvador' },
  { iso: 'US', code: '1',   name: 'Estados Unidos' },
  { iso: 'UY', code: '598', name: 'Uruguay' },
  { iso: 'VE', code: '58',  name: 'Venezuela' },
]

const DIAL_CODES: Record<string, string> = Object.fromEntries(PHONE_COUNTRIES.map((c) => [c.iso, c.code]))

function splitPhone(value: string): { iso: string; local: string } {
  if (!value.startsWith('+')) return { iso: '', local: value }
  const sorted = PHONE_COUNTRIES.slice().sort((a, b) => b.code.length - a.code.length)
  for (const { iso, code } of sorted) {
    const prefix = `+${code}`
    if (value === prefix) return { iso, local: '' }
    // Legacy format with space/dash, and E.164 without separator
    if (value.startsWith(`${prefix} `) || value.startsWith(`${prefix}-`)) {
      return { iso, local: value.slice(prefix.length).replace(/^[\s-]/, '') }
    }
    if (value.startsWith(prefix)) {
      return { iso, local: value.slice(prefix.length) }
    }
  }
  return { iso: '', local: value }
}

function PhoneField({
  iso, local, onIsoChange, onLocalChange, placeholder,
}: {
  iso: string; local: string
  onIsoChange: (iso: string) => void; onLocalChange: (local: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex gap-2">
      <Select value={iso} onValueChange={(v: string | null) => onIsoChange(v ?? '')}>
        <SelectTrigger className="w-[110px] shrink-0 px-2">
          <SelectValue placeholder="País">
            {(v: string) => v && DIAL_CODES[v] ? (
              <span className="flex items-center gap-1">
                <img src={`https://flagcdn.com/w20/${v.toLowerCase()}.png`} alt={v} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                <span>+{DIAL_CODES[v]}</span>
              </span>
            ) : <span className="text-muted-foreground text-xs">País</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.iso} value={c.iso}>
              <span className="flex items-center gap-2">
                <img src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`} alt={c.iso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                +{c.code} — {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input className="flex-1" value={local} onChange={(e) => onLocalChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

type ColDef = { key: string; label: string; defaultVisible: boolean }
type ColPref = { key: string; visible: boolean }

const ALL_COLUMNS: ColDef[] = [
  { key: 'empresa',      label: 'Empresa',     defaultVisible: true  },
  { key: 'nombre',       label: 'Nombre',      defaultVisible: true  },
  { key: 'direccion_pais',         label: 'Pais',        defaultVisible: true  },
  { key: 'direccion_departamento', label: 'Departamento', defaultVisible: false },
  { key: 'direccion_municipio',    label: 'Municipio',   defaultVisible: false },
  { key: 'telefono1',    label: 'Telefono',    defaultVisible: false },
]

const DEFAULT_PREFS: ColPref[] = ALL_COLUMNS.map((c) => ({ key: c.key, visible: c.defaultVisible }))

// ─── CSV Export ──────────────────────────────────────────────────────────────
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
                  title="Subir columna" className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={i === prefs.length - 1} onClick={() => onMove(pref.key, 1)}
                  title="Bajar columna" className="text-muted-foreground hover:text-foreground disabled:opacity-25">
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

const formatMora = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_FORM: ProyectoForm = {
  empresa: 0,
  codigo: 0,
  nombre: '',
  moneda: 'GTQ',
  direccion_pais: '',
  direccion_departamento: '',
  direccion_municipio: '',
  direccion: '',
  codigo_postal: '',
  telefono1: '',
  telefono2: '',
  mora_automatica: 0,
  fijar_parametros_mora: 0,
  forma_mora: 0,
  interes_mora: 0,
  fijo_mora: 0,
  mora_enganche: 0,
  dias_gracia: 0,
  dias_afectos: 0,
  inicio_calculo_mora: '1900-01-01',
  calcular_mora_antes: 0,
  minimo_mora: 0,
  minimo_abono_capital: 0,
  inicio_abono_capital_estricto: '1900-01-01',
  promesa_vencida: 0,
  logo_url: '',
}

// ─── Logo helpers ──────────────────────────────────────────────────────────

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_MIN_DIM = 200
const LOGO_MAX_DIM = 4000

async function validateLogoFile(file: File): Promise<string | null> {
  const allowed = LOGO_ACCEPT.split(',')
  if (!allowed.includes(file.type)) return 'Formato no permitido. Use PNG, JPG, WebP o SVG.'
  if (file.size > LOGO_MAX_BYTES) return `El archivo supera el tamaño máximo de 5 MB.`
  if (file.type === 'image/svg+xml') return null // SVG: skip dimension check
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width < LOGO_MIN_DIM || img.height < LOGO_MIN_DIM)
        resolve(`Dimensiones mínimas ${LOGO_MIN_DIM}×${LOGO_MIN_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else if (img.width > LOGO_MAX_DIM || img.height > LOGO_MAX_DIM)
        resolve(`Dimensiones máximas ${LOGO_MAX_DIM}×${LOGO_MAX_DIM}px. La imagen tiene ${img.width}×${img.height}px.`)
      else resolve(null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('No se pudo leer la imagen.') }
    img.src = url
  })
}

function LogoUploadField({
  displayUrl, fileName, onFileSelect, onRemove, error, disabled,
}: {
  displayUrl: string
  fileName: string
  onFileSelect: (file: File) => void
  onRemove: () => void
  error: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  return (
    <div className="space-y-1.5">
      <Label>Logo</Label>
      {displayUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
          <img src={displayUrl} alt="Logo" className="h-14 w-14 shrink-0 rounded object-contain bg-white border border-border" />
          <div className="min-w-0 flex-1">
            {fileName && <p className="truncate text-xs font-medium">{fileName}</p>}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB · mín. {LOGO_MIN_DIM}×{LOGO_MIN_DIM}px</p>
          </div>
          {!disabled && (
            <div className="flex gap-1 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}
                className="h-7 px-2 text-xs">Cambiar</Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <span className="text-muted-foreground">Haz clic o arrastra una imagen</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB · mín. {LOGO_MIN_DIM}×{LOGO_MIN_DIM}px</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={LOGO_ACCEPT} aria-label="Seleccionar logo" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = '' }} />
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────

export function ProyectosClient({
  initialData,
  empresas,
  fases,
  paises,
  departamentos,
  municipios,
  monedas,
  puedeAgregar,
  puedeModificar,
  puedeEliminar,
  userId,
}: {
  initialData: Proyecto[]
  empresas: Empresa[]
  fases: Fase[]
  paises: Pais[]
  departamentos: Departamento[]
  municipios: Municipio[]
  monedas: Moneda[]
  puedeAgregar: boolean
  puedeModificar: boolean
  puedeEliminar: boolean
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hadConflict, setHadConflict] = useState(false)
  const [viewTarget, setViewTarget] = useState<Proyecto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proyecto | null>(null)
  const [auditTarget, setAuditTarget] = useState<Proyecto | null>(null)
  const [form, setForm] = useState<ProyectoForm>(EMPTY_FORM)
  const [similarWarning, setSimilarWarning] = useState<Proyecto[] | null>(null)
  const [colFilters, setColFilters] = useState<ColFilters>({})

  // Códigos para cascada (no van al form, solo filtran)
  const [paisCodigo, setPaisCodigo] = useState('')
  const [deptoCodigo, setDeptoCodigo] = useState('')

  // Tipo de cálculo de mora (0=Tasa, 1=Valor Fijo) — solo UI, no va a BD
  const [tipoCalculo, setTipoCalculo] = useState(0)
  // Cadena de visualización para Mora Mínima (miles + 2 decimales)
  const [minMoraStr, setMinMoraStr] = useState('0.00')

  // Estado para los campos de teléfono (separados en país + número local)
  const [tel1Iso, setTel1Iso] = useState('')
  const [tel1Local, setTel1Local] = useState('')
  const [tel2Iso, setTel2Iso] = useState('')
  const [tel2Local, setTel2Local] = useState('')

  // Estado para el logo del proyecto
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
  const [logoError, setLogoError] = useState('')

  const deptosFiltrados = departamentos.filter((d) => d.pais === paisCodigo)
  const municipiosFiltrados = municipios.filter(
    (m) => m.pais === paisCodigo && m.departamento === deptoCodigo
  )

  const empresaMap = useMemo(
    () => new Map(empresas.map((e) => [e.codigo, e.nombre])),
    [empresas]
  )

  // País ISO → moneda ISO, restringido a monedas en t_moneda
  const countryToCurrency = useMemo(() => ({
    ...Object.fromEntries(
      monedas
        .filter((m) => m.codigo !== 'EUR')
        .flatMap((m) => {
          const flag = CURRENCY_FLAG_MAP.get(m.codigo)
          return flag ? [[flag.toUpperCase(), m.codigo] as [string, string]] : []
        })
    ),
    ...(monedas.some((m) => m.codigo === 'EUR') ? { DE: 'EUR', ES: 'EUR', FR: 'EUR', IT: 'EUR', PT: 'EUR' } : {}),
  }), [monedas])

  function setColFilter(col: string, next: Set<string>) {
    setColFilters((prev) => {
      const updated = { ...prev }
      if (next.size === 0) delete updated[col]
      else updated[col] = next
      return updated
    })
  }

  const uniqueEmpresaNames = useMemo(
    () => [...new Set(initialData.map((p) => empresaMap.get(p.empresa) ?? ''))].sort(),
    [initialData, empresaMap]
  )

  const uniqueVals = (key: keyof Proyecto) =>
    [...new Set(initialData.map((p) => String(p[key] ?? '')))].sort()

  const afterSearch = initialData.filter((p) => {
    const q = search.toLowerCase()
    return !q ||
      p.nombre?.toLowerCase().includes(q) ||
      (empresaMap.get(p.empresa) ?? '').toLowerCase().includes(q) ||
      p.direccion_pais?.toLowerCase().includes(q) ||
      p.direccion_departamento?.toLowerCase().includes(q) ||
      String(p.codigo).includes(q)
  })

  const filtered = afterSearch.filter((p) =>
    Object.entries(colFilters).every(([col, vals]) => {
      if (col === 'empresa') return vals.has(empresaMap.get(p.empresa) ?? '')
      return vals.has(String(p[col as keyof Proyecto] ?? ''))
    })
  )

  const hasActiveFilters = Object.keys(colFilters).length > 0

  // Column prefs (localStorage)
  const STORAGE_KEY = `proyectos_cols_v1_${userId}`
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

  // Keyboard navigation
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

  function buildFormFromProyecto(proyecto: Proyecto) {
    const pCode = proyecto.direccion_pais ?? ''
    const dCode = proyecto.direccion_departamento ?? ''
    return {
      paisCodigo: pCode,
      deptoCodigo: dCode,
      form: {
        empresa: proyecto.empresa,
        codigo: proyecto.codigo,
        nombre: proyecto.nombre,
        moneda: proyecto.moneda ?? 'GTQ',
        direccion_pais: pCode,
        direccion_departamento: dCode,
        direccion_municipio: proyecto.direccion_municipio ?? '',
        direccion: proyecto.direccion ?? '',
        codigo_postal: proyecto.codigo_postal ?? '',
        telefono1: proyecto.telefono1 ?? '',
        telefono2: proyecto.telefono2 ?? '',
        mora_automatica: proyecto.mora_automatica ?? 0,
        fijar_parametros_mora: proyecto.fijar_parametros_mora ?? 0,
        forma_mora: proyecto.forma_mora ?? 0,
        interes_mora: proyecto.interes_mora ?? 0,
        fijo_mora: proyecto.fijo_mora ?? 0,
        mora_enganche: proyecto.mora_enganche ?? 0,
        dias_gracia: proyecto.dias_gracia ?? 0,
        dias_afectos: proyecto.dias_afectos ?? 0,
        inicio_calculo_mora: proyecto.inicio_calculo_mora ?? '',
        calcular_mora_antes: proyecto.calcular_mora_antes ?? 0,
        minimo_mora: proyecto.minimo_mora ?? 0,
        minimo_abono_capital: proyecto.minimo_abono_capital ?? 0,
        inicio_abono_capital_estricto: proyecto.inicio_abono_capital_estricto ?? '',
        promesa_vencida: proyecto.promesa_vencida ?? 0,
        logo_url: proyecto.logo_url ?? '',
      } satisfies ProyectoForm,
    }
  }

  function openCreate() {
    setViewTarget(null)
    setIsEditing(true)
    const defIso = empresas[0]?.direccion_pais ?? ''
    const defMoneda = countryToCurrency[defIso] ?? 'GTQ'
    setForm({ ...EMPTY_FORM, empresa: empresas[0]?.codigo ?? 0, moneda: defMoneda, direccion_pais: defIso })
    setPaisCodigo(defIso)
    setDeptoCodigo('')
    setTel1Iso(defIso); setTel1Local('')
    setTel2Iso(defIso); setTel2Local('')
    setTipoCalculo(0)
    setMinMoraStr('0.00')
    setLogoFile(null); setLogoPreviewUrl(''); setLogoError('')
    setDialogOpen(true)
  }

  function openView(proyecto: Proyecto) {
    const { form: f, paisCodigo: pc, deptoCodigo: dc } = buildFormFromProyecto(proyecto)
    const { iso: iso1, local: local1 } = splitPhone(proyecto.telefono1 ?? '')
    const { iso: iso2, local: local2 } = splitPhone(proyecto.telefono2 ?? '')
    const fallbackIso = pc || (paises.find((p) => p.nombre === (empresas.find((e) => e.codigo === proyecto.empresa)?.pais ?? ''))?.codigo ?? '')
    setTel1Iso(iso1 || fallbackIso); setTel1Local(local1)
    setTel2Iso(iso2 || fallbackIso); setTel2Local(local2)
    setViewTarget(proyecto)
    setForm(f)
    setPaisCodigo(pc)
    setDeptoCodigo(dc)
    setTipoCalculo((proyecto.fijo_mora ?? 0) > 0 ? 1 : 0)
    setMinMoraStr(formatMora(proyecto.minimo_mora ?? 0))
    setLogoFile(null); setLogoPreviewUrl(''); setLogoError('')
    setIsEditing(false)
    setDialogOpen(true)
  }

  function startEdit() { setIsEditing(true) }

  function cancelEdit() {
    if (viewTarget) {
      const { form: f, paisCodigo: pc, deptoCodigo: dc } = buildFormFromProyecto(viewTarget)
      const { iso: iso1, local: local1 } = splitPhone(viewTarget.telefono1 ?? '')
      const { iso: iso2, local: local2 } = splitPhone(viewTarget.telefono2 ?? '')
      const fallbackIso = pc || (paises.find((p) => p.nombre === (empresas.find((e) => e.codigo === viewTarget.empresa)?.pais ?? ''))?.codigo ?? '')
      setTel1Iso(iso1 || fallbackIso); setTel1Local(local1)
      setTel2Iso(iso2 || fallbackIso); setTel2Local(local2)
      setForm(f)
      setPaisCodigo(pc)
      setDeptoCodigo(dc)
      setTipoCalculo((viewTarget.fijo_mora ?? 0) > 0 ? 1 : 0)
      setMinMoraStr(formatMora(viewTarget.minimo_mora ?? 0))
      setLogoFile(null); setLogoPreviewUrl(''); setLogoError('')
      setIsEditing(false)
    } else {
      setDialogOpen(false)
    }
  }

  function f(key: keyof ProyectoForm, value: string | number) {
    const v = typeof value === 'string' && key !== 'direccion_pais' && key !== 'direccion_departamento' && key !== 'direccion_municipio' && key !== 'moneda'
      ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      : value
    setForm((prev) => {
      const next = { ...prev, [key]: v }
      if (key === 'empresa') {
        const emp = empresas.find((e) => e.codigo === Number(value))
        const iso = emp?.direccion_pais ?? ''
        next.direccion_pais = iso; next.direccion_departamento = ''; next.direccion_municipio = ''
        next.moneda = countryToCurrency[iso] ?? 'GTQ'
        setPaisCodigo(iso); setDeptoCodigo('')
        if (!next.telefono1) { setTel1Iso(iso); setTel1Local('') }
        if (!next.telefono2) { setTel2Iso(iso); setTel2Local('') }
      }
      return next
    })
  }

  const handleLogoSelect = useCallback(async (file: File) => {
    const err = await validateLogoFile(file)
    if (err) { setLogoError(err); return }
    setLogoError('')
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    const url = URL.createObjectURL(file)
    setLogoFile(file)
    setLogoPreviewUrl(url)
  }, [logoPreviewUrl])

  const handleLogoRemove = useCallback(() => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    setLogoFile(null); setLogoPreviewUrl('')
    setLogoError('')
    setForm((prev) => ({ ...prev, logo_url: '' }))
  }, [logoPreviewUrl])

  function handleSave() {
    if (!form.empresa) { toast.error('Debes seleccionar una empresa.'); return }
    if (!form.nombre.trim()) { toast.error('El nombre del proyecto es requerido.'); return }
    if (!form.moneda.trim()) { toast.error('La moneda es requerida.'); return }
    if (!form.direccion.trim()) { toast.error('La dirección es requerida.'); return }
    if (!form.direccion_pais.trim()) { toast.error('El país es requerido.'); return }
    if (!form.direccion_departamento.trim()) { toast.error('El departamento es requerido.'); return }
    if (!form.direccion_municipio.trim()) { toast.error('El municipio es requerido.'); return }
    if (!tel1Local.trim()) { toast.error('El teléfono 1 es requerido.'); return }
    if (form.mora_automatica === 1) {
      if (tipoCalculo === 0 && !form.interes_mora) { toast.error('El porcentaje de mora es requerido.'); return }
      if (tipoCalculo === 1 && !form.fijo_mora) { toast.error('El monto de mora es requerido.'); return }
      if (form.dias_gracia < 0) { toast.error('Los días de gracia deben ser 0 o mayor.'); return }
    }
    if (logoError) { toast.error('Corrige el error en el logo antes de guardar.'); return }

    // Verificar similitud de nombre (umbral 0.85) contra proyectos de la misma empresa
    const normalizedInput = toDbString(form.nombre)
    const candidates = initialData.filter((p) =>
      p.empresa === form.empresa && (viewTarget ? p.codigo !== viewTarget.codigo : true)
    )
    const similar = candidates.filter(
      (p) => p.nombre && jaroWinkler(normalizedInput, toDbString(p.nombre)) >= 0.85
    )
    if (similar.length > 0) {
      setSimilarWarning(similar)
      return
    }

    doSave()
  }

  function doSave() {
    startTransition(async () => {
      let payload = { ...form }
      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        const up = await uploadProjectLogo(fd, viewTarget?.logo_url ?? undefined)
        if (up.error) { toast.error(up.error); return }
        payload = { ...payload, logo_url: up.url ?? '' }
      }
      const result = viewTarget
        ? await updateProyecto(viewTarget.empresa, viewTarget.codigo, payload, viewTarget.modifico_fecha ?? undefined)
        : await createProyecto(payload)

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes('modificado')) setHadConflict(true)
      } else {
        setHadConflict(false)
        toast.success(viewTarget ? 'Proyecto actualizado.' : 'Proyecto creado.')
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteProyecto(deleteTarget.empresa, deleteTarget.codigo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Proyecto eliminado.')
        router.refresh()
      }
      setDeleteTarget(null)
    })
  }

  function exportCsv() {
    const keys = ['codigo', ...colPrefs.filter((c) => c.visible).map((c) => c.key)]
      .filter((k) => !NEVER_EXPORT.has(k))
    const headers = keys.map((k) => COL_LABELS[k] ?? k)
    const lines = [
      headers.join(','),
      ...filtered.map((p) => keys.map((k) => {
        switch (k) {
          case 'empresa': return formatCsvCell(empresaMap.get(p.empresa) ?? '')
          case 'direccion_pais': return formatCsvCell(paises.find((x) => x.codigo === p.direccion_pais)?.nombre ?? p.direccion_pais ?? '')
          case 'direccion_departamento': return formatCsvCell(departamentos.find((d) => d.codigo === p.direccion_departamento)?.nombre ?? p.direccion_departamento ?? '')
          case 'direccion_municipio': return formatCsvCell(municipios.find((m) => m.codigo === p.direccion_municipio)?.nombre ?? p.direccion_municipio ?? '')
          default: return formatCsvCell(p[k as keyof Proyecto])
        }
      }).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proyectos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-100 p-2.5">
            <FolderKanban className="h-5 w-5 text-sky-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Proyectos</h1>
            <p className="text-sm text-muted-foreground">
              Administra los proyectos de lotificacion
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={empresas.length === 0 || !puedeAgregar}>
          <Plus className="h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {empresas.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Primero debes crear al menos una empresa antes de agregar proyectos.
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar proyectos..."
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
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30"><span className="text-xs font-medium text-muted-foreground">Codigo</span></TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={ALL_COLUMNS.find((c) => c.key === col.key)!.label}
                    values={col.key === 'empresa' ? uniqueEmpresaNames : uniqueVals(col.key as keyof Proyecto)}
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
                    ? 'No se encontraron proyectos con ese criterio.'
                    : 'Todavía no hay proyectos. Haz clic en "Nuevo Proyecto" para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((proyecto, rowIdx) => {
                const isActive = cursorIdx === rowIdx
                return (
                  <TableRow
                    key={`${proyecto.empresa}-${proyecto.codigo}`}
                    className={`group cursor-pointer transition-colors ${
                      isActive ? 'bg-sky-50 dark:bg-sky-950/30' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setCursorIdx(rowIdx)}
                    onDoubleClick={() => openView(proyecto)}
                  >
                    <TableCell className={`sticky left-0 z-10 font-mono text-xs transition-colors ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-950/30 border-l-[3px] border-l-sky-600 text-sky-700 dark:text-sky-400 font-semibold'
                        : 'bg-card text-muted-foreground group-hover:bg-muted/40'
                    }`}>
                      {proyecto.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{proyecto.nombre}</TableCell>
                        case 'empresa':
                          return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(proyecto.empresa) ?? `#${proyecto.empresa}`}</TableCell>
                        case 'direccion_pais': {
                          const p = paises.find((x) => x.codigo === proyecto.direccion_pais)
                          return (
                            <TableCell key="direccion_pais" className="text-muted-foreground">
                              {p ? (
                                <span className="flex items-center gap-1.5">
                                  <img src={`https://flagcdn.com/w20/${p.codigo.toLowerCase()}.png`} alt={p.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  {p.nombre}
                                </span>
                              ) : (proyecto.direccion_pais ?? '—')}
                            </TableCell>
                          )
                        }
                        case 'direccion_departamento':
                          return <TableCell key="direccion_departamento" className="text-muted-foreground">{departamentos.find((d) => d.codigo === proyecto.direccion_departamento)?.nombre ?? proyecto.direccion_departamento ?? '—'}</TableCell>
                        case 'direccion_municipio':
                          return <TableCell key="direccion_municipio" className="text-muted-foreground">{municipios.find((m) => m.codigo === proyecto.direccion_municipio)?.nombre ?? proyecto.direccion_municipio ?? '—'}</TableCell>
                        default:
                          return <TableCell key={col.key} className="text-muted-foreground">{(proyecto[col.key as keyof Proyecto] as string) || '—'}</TableCell>
                      }
                    })}
                    <TableCell className={`sticky right-0 z-10 transition-colors ${
                      isActive ? 'bg-sky-50 dark:bg-sky-950/30' : 'bg-card group-hover:bg-muted/40'
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
                          <DropdownMenuItem onClick={() => openView(proyecto)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            {puedeModificar ? 'Ver / Editar' : 'Ver'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(proyecto)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {puedeEliminar && !fases.some((f) => f.empresa === proyecto.empresa && f.proyecto === proyecto.codigo) && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(proyecto)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Eliminar
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
          if (!open && similarWarning) return   // no cerrar mientras el aviso de nombres similares está activo
          setDialogOpen(open)
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
        modal={false}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="-mx-4 -mt-4 px-5 pt-4 pb-3 bg-gradient-to-br from-sky-50/70 to-transparent border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div className={`shrink-0 rounded-xl p-2 ${
                isEditing && !viewTarget ? 'bg-sky-100' : isEditing ? 'bg-amber-100' : 'bg-sky-100'
              }`}>
                {isEditing && !viewTarget
                  ? <Plus className="h-5 w-5 text-sky-600" />
                  : isEditing
                  ? <Pencil className="h-5 w-5 text-amber-600" />
                  : <FolderKanban className="h-5 w-5 text-sky-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {isEditing && !viewTarget ? 'Nuevo Proyecto' : isEditing ? 'Editar Proyecto' : viewTarget?.nombre}
                </DialogTitle>
                {viewTarget && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {empresaMap.get(viewTarget.empresa) ?? ''}
                    <span className="font-mono ml-1.5 text-muted-foreground/60">· {viewTarget.codigo}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="mora" className="gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Parámetros
              </TabsTrigger>
            </TabsList>

            {/* ── Tab General ── */}
            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-auto pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Identificacion</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2"><ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} /></div>
                  <div className="col-span-1"><ViewField label="Codigo" value={String(viewTarget.codigo)} /></div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">General</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2"><ViewField label="Nombre Proyecto" value={viewTarget.nombre} /></div>
                  <div className="col-span-2"><ViewField label="Direccion" value={viewTarget.direccion} /></div>
                  {(() => {
                    const p = paises.find((x) => x.codigo === viewTarget.direccion_pais)
                    return (
                      <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
                        <span className="block text-[10px] font-bold tracking-widest text-muted-foreground/55">Pais</span>
                        {p ? (
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <img src={`https://flagcdn.com/w20/${p.codigo.toLowerCase()}.png`} alt={p.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                            {p.nombre}
                          </span>
                        ) : <span className="text-sm font-medium">{viewTarget.direccion_pais ?? '—'}</span>}
                      </div>
                    )
                  })()}
                  <ViewField label="Departamento" value={departamentos.find((d) => d.codigo === viewTarget.direccion_departamento)?.nombre ?? viewTarget.direccion_departamento} />
                  <ViewField label="Municipio" value={municipios.find((m) => m.codigo === viewTarget.direccion_municipio)?.nombre ?? viewTarget.direccion_municipio} />
                  <ViewField label="Codigo postal" value={viewTarget.codigo_postal} />
                  <ViewField label="Telefono 1" value={viewTarget.telefono1} />
                  <ViewField label="Telefono 2" value={viewTarget.telefono2} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Identificacion</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="empresa" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Empresa *</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))} disabled={!!viewTarget}>
                      <SelectTrigger id="empresa" className="w-full">
                        <SelectValue placeholder="Selecciona una empresa">
                          {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {viewTarget && (
                    <div className="col-span-1"><ViewField label="Codigo" value={String(viewTarget.codigo)} /></div>
                  )}
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">General</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="nombre" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Nombre Proyecto *</Label>
                    <Input id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del proyecto" />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="direccion_p" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Direccion *</Label>
                    <Input id="direccion_p" value={form.direccion} onChange={(e) => f('direccion', e.target.value)} placeholder="Dirección del proyecto" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Pais *</Label>
                    <CountrySelect paises={paises} value={paisCodigo}
                      onChange={(codigo, _nombre) => {
                        setPaisCodigo(codigo); setDeptoCodigo('')
                        const autoMoneda = countryToCurrency[codigo] ?? form.moneda
                        setForm((prev) => ({ ...prev, direccion_pais: codigo, direccion_departamento: '', direccion_municipio: '', moneda: autoMoneda }))
                      }}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="departamento_p" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Departamento *</Label>
                    <select id="departamento_p" title="Departamento" value={deptoCodigo} disabled={!paisCodigo}
                      onChange={(e) => { const v = e.target.value; setDeptoCodigo(v); setForm((prev) => ({ ...prev, direccion_departamento: v, direccion_municipio: '' })) }}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">{paisCodigo ? 'Seleccionar departamento' : 'Primero selecciona un país'}</option>
                      {deptosFiltrados.map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="municipio_p" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Municipio *</Label>
                    <select id="municipio_p" title="Municipio"
                      value={form.direccion_municipio}
                      disabled={!deptoCodigo}
                      onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, direccion_municipio: v })) }}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">{deptoCodigo ? 'Seleccionar municipio' : 'Primero selecciona un departamento'}</option>
                      {municipiosFiltrados.map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="codigo_postal_p" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Codigo postal</Label>
                    <Input id="codigo_postal_p" value={form.codigo_postal} onChange={(e) => f('codigo_postal', e.target.value)} placeholder="Ej: 01001" />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Telefono 1 *</Label>
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
                </div>
              )}
            </TabsContent>

            {/* ── Tab Mora ── */}
            <TabsContent value="mora" className="mt-4 flex-1 overflow-y-auto overflow-x-auto pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Mora</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  {/* Mora Automática — checkbox */}
                  <div className="col-span-2 flex items-center gap-2 py-1">
                    <Checkbox checked={!!viewTarget.mora_automatica} disabled />
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Mora Automática</span>
                  </div>
                  {/* Forma Cálculo + Tipo Cálculo + % Mora|Monto Mora + Días Gracia */}
                  <div className="col-span-2 grid grid-cols-4 gap-3">
                    <ViewField label="Forma Calculo" value={viewTarget.forma_mora === 1 ? 'Diario' : 'Mensual'} />
                    <ViewField label="Tipo Calculo" value={tipoCalculo === 1 ? 'Valor Fijo' : 'Tasa'} />
                    {tipoCalculo === 0
                      ? <ViewField label="% Mora" value={formatMora(viewTarget.interes_mora ?? 0)} />
                      : <ViewField label="Monto Mora" value={formatMora(viewTarget.fijo_mora ?? 0)} />}
                    <ViewField label="Dias Gracia" value={String(viewTarget.dias_gracia ?? 0)} />
                  </div>
                  <ViewField label="Dias Afectos" value={(viewTarget.dias_afectos ?? 0) === 1 ? 'Un Mes' : 'Todos Los Dias'} />
                  <ViewField label="Mora Minima" value={formatMora(viewTarget.minimo_mora ?? 0)} />
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox checked={!!viewTarget.mora_enganche} disabled />
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Mora Enganche</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Abono Capital</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <ViewField label="Minimo Abono Capital" value={formatMora(viewTarget.minimo_abono_capital ?? 0)} />
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Otros Parámetros</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    {(() => {
                      const flag = CURRENCY_FLAG_MAP.get(viewTarget.moneda ?? '')
                      return (
                        <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-1">
                          <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">Moneda</span>
                          {flag ? (
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              <img src={`https://flagcdn.com/w20/${flag}.png`} alt={viewTarget.moneda ?? ''} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                              {viewTarget.moneda}
                            </span>
                          ) : <span className="text-sm font-medium">{viewTarget.moneda ?? '—'}</span>}
                        </div>
                      )
                    })()}
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox checked={!!viewTarget.promesa_vencida} disabled />
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Promesa Vencida</span>
                    </div>
                  </div>
                  {viewTarget.logo_url ? (
                    <div className="col-span-2 rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5 space-y-2">
                      <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground/70">Logo</span>
                      <img src={viewTarget.logo_url} alt="Logo del proyecto"
                        className="max-h-20 max-w-[200px] rounded border border-border object-contain bg-white p-1" />
                    </div>
                  ) : (
                    <ViewField label="Logo" value="Sin logo" />
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Mora</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 py-1">
                    <Checkbox
                      id="mora_automatica"
                      checked={form.mora_automatica === 1}
                      onCheckedChange={(checked: boolean) => f('mora_automatica', checked ? 1 : 0)}
                    />
                    <Label htmlFor="mora_automatica" className="text-[11px] font-semibold tracking-wider text-muted-foreground cursor-pointer">Mora Automatica</Label>
                  </div>
                  <div className="col-span-2 grid grid-cols-[1fr_minmax(10rem,1fr)_1fr_1fr] gap-6">
                    <div className="grid gap-1.5">
                      <Label htmlFor="forma_mora" className={`text-[11px] font-semibold tracking-wider whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>Forma Calculo</Label>
                      <div className="w-full">
                        <Select
                          value={String(form.forma_mora)}
                          onValueChange={(v) => f('forma_mora', Number(v))}
                          disabled={form.mora_automatica !== 1}
                        >
                          <SelectTrigger id="forma_mora" className="w-full">
                            <SelectValue>
                              {(v: string) => v === '1' ? 'Diario' : 'Mensual'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Mensual</SelectItem>
                            <SelectItem value="1">Diario</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="tipo_calculo" className={`text-[11px] font-semibold tracking-wider whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>Tipo Calculo</Label>
                      <div className="w-full">
                        <Select
                          value={String(tipoCalculo)}
                          onValueChange={(v) => {
                            const next = Number(v)
                            setTipoCalculo(next)
                            if (next === 0) f('fijo_mora', 0)
                            else f('interes_mora', 0)
                          }}
                          disabled={form.mora_automatica !== 1}
                        >
                          <SelectTrigger id="tipo_calculo" className="w-full">
                            <SelectValue>
                              {(v: string) => v === '1' ? 'Valor Fijo' : 'Tasa'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Tasa</SelectItem>
                            <SelectItem value="1">Valor Fijo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {tipoCalculo === 0 ? (
                      <div className="grid gap-1.5">
                        <Label htmlFor="interes_mora" className={`text-[11px] font-semibold tracking-wider whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>{form.mora_automatica === 1 ? '% Mora *' : '% Mora'}</Label>
                        <Input id="interes_mora" type="number" step="0.01" value={form.interes_mora} onChange={(e) => f('interes_mora', Number(e.target.value))} disabled={form.mora_automatica !== 1} />
                      </div>
                    ) : (
                      <div className="grid gap-1.5">
                        <Label htmlFor="fijo_mora" className={`text-[11px] font-semibold tracking-wider whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>{form.mora_automatica === 1 ? 'Monto Mora *' : 'Monto Mora'}</Label>
                        <Input id="fijo_mora" type="number" step="0.01" value={form.fijo_mora} onChange={(e) => f('fijo_mora', Number(e.target.value))} disabled={form.mora_automatica !== 1} />
                      </div>
                    )}
                    <div className="grid gap-1.5">
                      <Label htmlFor="dias_gracia" className={`text-[11px] font-semibold tracking-wider whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>{form.mora_automatica === 1 ? 'Dias Gracia *' : 'Dias Gracia'}</Label>
                      <Input id="dias_gracia" type="number" value={form.dias_gracia} onChange={(e) => f('dias_gracia', Number(e.target.value))} disabled={form.mora_automatica !== 1} />
                    </div>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                    <div className="grid gap-1">
                      <Label htmlFor="dias_afectos" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Dias Afectos</Label>
                      <Select value={String(form.dias_afectos ?? 0)} onValueChange={(v) => f('dias_afectos', Number(v))}>
                        <SelectTrigger id="dias_afectos" className="w-full"><SelectValue>{(v: string) => v === '1' ? 'Un Mes' : 'Todos Los Días'}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Todos Los Días</SelectItem>
                          <SelectItem value="1">Un Mes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="minimo_mora" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Mora Minima</Label>
                      <Input
                        id="minimo_mora"
                        type="text"
                        inputMode="decimal"
                        value={minMoraStr}
                        onChange={(e) => {
                          setMinMoraStr(e.target.value)
                          const parsed = parseFloat(e.target.value.replace(/,/g, ''))
                          if (!isNaN(parsed)) f('minimo_mora', parsed)
                        }}
                        onBlur={() => setMinMoraStr(formatMora(form.minimo_mora))}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id="mora_enganche"
                        checked={form.mora_enganche === 1}
                        onCheckedChange={(checked: boolean) => f('mora_enganche', checked ? 1 : 0)}
                      />
                      <Label htmlFor="mora_enganche" className="text-[11px] font-semibold tracking-wider text-muted-foreground cursor-pointer">Mora Enganche</Label>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Abono Capital</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="grid gap-1 w-3/4"><Label htmlFor="minimo_abono" className="text-[11px] font-semibold tracking-wider text-muted-foreground">Minimo Abono Capital</Label><Input id="minimo_abono" type="number" step="0.01" value={form.minimo_abono_capital} onChange={(e) => f('minimo_abono_capital', Number(e.target.value))} /></div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <div className="h-4 w-0.5 rounded-full bg-primary/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Otros Parámetros</span>
                    <div className="flex-1 border-t border-primary/30" />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                    <div className="grid gap-1">
                      <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground">Moneda *</Label>
                      <Select value={form.moneda} onValueChange={(v) => f('moneda', v ?? 'GTQ')}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar moneda">
                            {(v: string) => {
                              const flag = CURRENCY_FLAG_MAP.get(v)
                              return flag ? (
                                <span className="flex items-center gap-2">
                                  <img src={`https://flagcdn.com/w20/${flag}.png`} alt={v} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  <span>{v}</span>
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
                                <span className="flex items-center gap-2">
                                  {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} alt={m.codigo} width={20} height={14} className="object-cover rounded-sm shrink-0" />}
                                  {m.codigo}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id="promesa_vencida"
                        checked={form.promesa_vencida === 1}
                        onCheckedChange={(checked: boolean) => f('promesa_vencida', checked ? 1 : 0)}
                      />
                      <Label htmlFor="promesa_vencida" className="text-[11px] font-semibold tracking-wider text-muted-foreground cursor-pointer">Promesa Vencida</Label>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <LogoUploadField
                      displayUrl={logoPreviewUrl || form.logo_url || ''}
                      fileName={logoFile?.name ?? ''}
                      onFileSelect={handleLogoSelect}
                      onRemove={handleLogoRemove}
                      error={logoError}
                    />
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

      {/* Similar name warning */}
      <AlertDialog open={!!similarWarning} onOpenChange={(o) => !o && setSimilarWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nombres similares encontrados</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <div className="mb-2">
                Ya existe{similarWarning && similarWarning.length > 1 ? 'n' : ''} {similarWarning?.length} proyecto
                {similarWarning && similarWarning.length > 1 ? 's' : ''} con un nombre muy parecido:
              </div>
              <ul className="mb-3 space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                {similarWarning?.map((p) => (
                  <li key={p.codigo}>{p.nombre}</li>
                ))}
              </ul>
              <div>¿Es realmente un proyecto diferente y desea continuar?</div>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              Esta acción eliminará permanentemente{' '}
              <strong>{deleteTarget?.nombre}</strong>. Esta operación no se puede deshacer.
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

      {/* Audit Log */}
      {auditTarget && (
        <AuditLogDialog
          open={!!auditTarget}
          onOpenChange={(o) => !o && setAuditTarget(null)}
          tabla="t_proyecto"
          cuenta={auditTarget.cuenta}
          codigo={auditTarget.codigo}
          titulo={auditTarget.nombre}
        />
      )}
    </div>
  )
}
