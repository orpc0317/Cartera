'use client'

import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Eye, Plus, FolderKanban, Search, History, ChevronDown, ChevronUp, X, Settings2, Trash2, Upload, ImageIcon, AlertCircle } from 'lucide-react'
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
import type { Empresa, Proyecto, ProyectoForm } from '@/lib/types/proyectos'
import type { Pais, Departamento, Municipio } from '@/app/actions/geo'
import { CountrySelect } from '@/components/ui/country-select'

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
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  )
}

// ─── Monedas ─────────────────────────────────────────────────────────────
const CURRENCIES: { iso: string; name: string; flagIso: string }[] = [
  { iso: 'ARS', name: 'Peso Argentino',       flagIso: 'AR' },
  { iso: 'BOB', name: 'Boliviano',             flagIso: 'BO' },
  { iso: 'BRL', name: 'Real Brasileño',        flagIso: 'BR' },
  { iso: 'CAD', name: 'Dólar Canadiense',      flagIso: 'CA' },
  { iso: 'CLP', name: 'Peso Chileno',          flagIso: 'CL' },
  { iso: 'COP', name: 'Peso Colombiano',       flagIso: 'CO' },
  { iso: 'CRC', name: 'Colón Costarricense',   flagIso: 'CR' },
  { iso: 'CUP', name: 'Peso Cubano',           flagIso: 'CU' },
  { iso: 'DOP', name: 'Peso Dominicano',       flagIso: 'DO' },
  { iso: 'EUR', name: 'Euro',                  flagIso: 'EU' },
  { iso: 'GBP', name: 'Libra Esterlina',       flagIso: 'GB' },
  { iso: 'GTQ', name: 'Quetzal Guatemalteco',  flagIso: 'GT' },
  { iso: 'HNL', name: 'Lempira Hondureño',     flagIso: 'HN' },
  { iso: 'MXN', name: 'Peso Mexicano',         flagIso: 'MX' },
  { iso: 'NIO', name: 'Córdoba Nicaragüense',  flagIso: 'NI' },
  { iso: 'PAB', name: 'Balboa Panameño',       flagIso: 'PA' },
  { iso: 'PEN', name: 'Sol Peruano',           flagIso: 'PE' },
  { iso: 'PYG', name: 'Guaraní Paraguayo',     flagIso: 'PY' },
  { iso: 'SVC', name: 'Colón Salvadoreño',     flagIso: 'SV' },
  { iso: 'USD', name: 'Dólar Estadounidense',  flagIso: 'US' },
  { iso: 'UYU', name: 'Peso Uruguayo',         flagIso: 'UY' },
  { iso: 'VES', name: 'Bolívar Venezolano',    flagIso: 'VE' },
]

const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.iso, c]))

// País ISO → moneda ISO (países con moneda propia 1:1 + países con euro)
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(CURRENCIES.filter((c) => c.flagIso !== 'EU').map((c) => [c.flagIso, c.iso])),
  DE: 'EUR', ES: 'EUR', FR: 'EUR', IT: 'EUR', PT: 'EUR',
}

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
  { key: 'nombre',       label: 'Nombre',      defaultVisible: true  },
  { key: 'empresa',      label: 'Empresa',     defaultVisible: true  },
  { key: 'pais',         label: 'País',        defaultVisible: true  },
  { key: 'departamento', label: 'Departamento', defaultVisible: false },
  { key: 'municipio',    label: 'Municipio',   defaultVisible: false },
  { key: 'telefono1',    label: 'Teléfono',    defaultVisible: false },
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
  pais: '',
  departamento: '',
  municipio: '',
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
  paises,
  departamentos,
  municipios,
  userId,
}: {
  initialData: Proyecto[]
  empresas: Empresa[]
  paises: Pais[]
  departamentos: Departamento[]
  municipios: Municipio[]
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
      p.pais?.toLowerCase().includes(q) ||
      p.departamento?.toLowerCase().includes(q) ||
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
    const pCode = proyecto.pais ?? ''
    const dCode = proyecto.departamento ?? ''
    return {
      paisCodigo: pCode,
      deptoCodigo: dCode,
      form: {
        empresa: proyecto.empresa,
        codigo: proyecto.codigo,
        nombre: proyecto.nombre,
        moneda: proyecto.moneda ?? 'GTQ',
        pais: pCode,
        departamento: dCode,
        municipio: proyecto.municipio ?? '',
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
    const defIso = paises.find((p) => p.nombre === (empresas[0]?.pais ?? ''))?.codigo ?? ''
    const defMoneda = COUNTRY_TO_CURRENCY[defIso] ?? 'GTQ'
    setForm({ ...EMPTY_FORM, empresa: empresas[0]?.codigo ?? 0, moneda: defMoneda })
    setPaisCodigo('')
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
    setForm((prev) => ({ ...prev, [key]: value }))
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
    if (!form.pais.trim()) { toast.error('El país es requerido.'); return }
    if (!form.departamento.trim()) { toast.error('El departamento es requerido.'); return }
    if (!form.municipio.trim()) { toast.error('El municipio es requerido.'); return }
    if (!tel1Local.trim()) { toast.error('El teléfono 1 es requerido.'); return }
    if (form.mora_automatica === 1) {
      if (tipoCalculo === 0 && !form.interes_mora) { toast.error('El porcentaje de mora es requerido.'); return }
      if (tipoCalculo === 1 && !form.fijo_mora) { toast.error('El monto de mora es requerido.'); return }
      if (!form.dias_gracia) { toast.error('Los días de gracia son requeridos.'); return }
    }
    if (logoError) { toast.error('Corrige el error en el logo antes de guardar.'); return }
    startTransition(async () => {
      let payload = { ...form }
      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        const up = await uploadProjectLogo(fd)
        if (up.error) { toast.error(up.error); return }
        payload = { ...payload, logo_url: up.url ?? '' }
      }
      const result = viewTarget
        ? await updateProyecto(viewTarget.empresa, viewTarget.codigo, payload, viewTarget.modifico_fecha ?? undefined)
        : await createProyecto(payload)

      if (result.error) {
        toast.error(result.error)
        setHadConflict(true)
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
              Administra los proyectos de lotificación
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={empresas.length === 0}>
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
              <TableHead className="sticky left-0 z-20 w-20 bg-muted/30">Código</TableHead>
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
                      #{proyecto.codigo}
                    </TableCell>
                    {visibleCols.map((col) => {
                      switch (col.key) {
                        case 'nombre':
                          return <TableCell key="nombre" className="font-medium">{proyecto.nombre}</TableCell>
                        case 'empresa':
                          return <TableCell key="empresa" className="text-muted-foreground">{empresaMap.get(proyecto.empresa) ?? `#${proyecto.empresa}`}</TableCell>
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
                            Ver / Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAuditTarget(proyecto)}>
                            <History className="mr-2 h-3.5 w-3.5" />
                            Historial
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(proyecto)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Eliminar
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
          if (!open) {
            setIsEditing(false)
            if (hadConflict) { setHadConflict(false); router.refresh() }
          }
        }}
        modal={false}
      >
        <DialogContent className="flex flex-col w-[90vw] sm:max-w-[36rem] h-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing && !viewTarget
                ? <><Plus className="h-4 w-4 text-muted-foreground" /> Nuevo Proyecto</>
                : isEditing
                ? <><Pencil className="h-4 w-4 text-muted-foreground" /> Editar Proyecto</>
                : <><Eye className="h-4 w-4 text-muted-foreground" /> {viewTarget?.nombre}</>}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="mora">Parámetros</TabsTrigger>
            </TabsList>

            {/* ── Tab General ── */}
            <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto overflow-x-auto pr-1">
              {!isEditing && viewTarget ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div className="col-span-2"><ViewField label="Nombre" value={viewTarget.nombre} /></div>
                  <ViewField label="Empresa" value={empresaMap.get(viewTarget.empresa) ?? `#${viewTarget.empresa}`} />
                  <ViewField label="País" value={paises.find((p) => p.codigo === viewTarget.pais)?.nombre ?? viewTarget.pais} />
                  <ViewField label="Departamento" value={departamentos.find((d) => d.codigo === viewTarget.departamento)?.nombre ?? viewTarget.departamento} />
                  <ViewField label="Municipio" value={municipios.find((m) => m.codigo === viewTarget.municipio)?.nombre ?? viewTarget.municipio} />
                  <div className="col-span-2"><ViewField label="Dirección" value={viewTarget.direccion} /></div>
                  <ViewField label="Código Postal" value={viewTarget.codigo_postal} />
                  <ViewField label="Teléfono 1" value={viewTarget.telefono1} />
                  <ViewField label="Teléfono 2" value={viewTarget.telefono2} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="empresa">Empresa *</Label>
                    <Select value={String(form.empresa)} onValueChange={(v) => f('empresa', Number(v))}>
                      <SelectTrigger id="empresa">
                        <SelectValue placeholder="Selecciona una empresa">
                          {(v: string) => v ? (empresaMap.get(Number(v)) ?? v) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e) => <SelectItem key={e.codigo} value={String(e.codigo)}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="nombre">Nombre Proyecto *</Label>
                    <Input id="nombre" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Nombre del proyecto" />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="direccion_p">Dirección *</Label>
                    <Input id="direccion_p" value={form.direccion} onChange={(e) => f('direccion', e.target.value)} placeholder="Dirección del proyecto" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>País *</Label>
                    <CountrySelect paises={paises} value={paisCodigo}
                      onChange={(codigo, _nombre) => {
                        setPaisCodigo(codigo); setDeptoCodigo('')
                        const autoMoneda = COUNTRY_TO_CURRENCY[codigo] ?? form.moneda
                        setForm((prev) => ({ ...prev, pais: codigo, departamento: '', municipio: '', moneda: autoMoneda }))
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="departamento_p">Departamento *</Label>
                    <select id="departamento_p" title="Departamento" value={deptoCodigo} disabled={!paisCodigo}
                      onChange={(e) => { const v = e.target.value; setDeptoCodigo(v); setForm((prev) => ({ ...prev, departamento: v, municipio: '' })) }}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">{paisCodigo ? 'Seleccionar departamento' : 'Primero selecciona un país'}</option>
                      {deptosFiltrados.map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="municipio_p">Municipio *</Label>
                    <select id="municipio_p" title="Municipio"
                      value={form.municipio}
                      disabled={!deptoCodigo}
                      onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, municipio: v })) }}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-0 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">{deptoCodigo ? 'Seleccionar municipio' : 'Primero selecciona un departamento'}</option>
                      {municipiosFiltrados.map((m) => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="codigo_postal_p">Código Postal</Label>
                    <Input id="codigo_postal_p" value={form.codigo_postal} onChange={(e) => f('codigo_postal', e.target.value)} placeholder="Ej: 01001" />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label>Teléfono 1 *</Label>
                    <PhoneField
                      iso={tel1Iso}
                      local={tel1Local}
                      onIsoChange={(v) => { setTel1Iso(v); f('telefono1', v && DIAL_CODES[v] ? `+${DIAL_CODES[v]}${tel1Local}` : tel1Local) }}
                      onLocalChange={(v) => { setTel1Local(v); f('telefono1', tel1Iso && DIAL_CODES[tel1Iso] ? `+${DIAL_CODES[tel1Iso]}${v}` : v) }}
                      placeholder="Número local"
                    />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label>Teléfono 2</Label>
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
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mora Automática</span>
                    <span className="text-sm font-medium">{viewTarget.mora_automatica ? 'Sí' : 'No'}</span>
                  </div>
                  {!!viewTarget.mora_automatica && (
                    <ViewField label="Forma Cálculo" value={viewTarget.forma_mora === 1 ? 'Diario' : 'Mensual'} />
                  )}
                  {!!viewTarget.mora_automatica && (
                    <ViewField label="Tipo Cálculo" value={tipoCalculo === 1 ? 'Valor Fijo' : 'Tasa'} />
                  )}
                  <ViewField label="Días de Gracia" value={String(viewTarget.dias_gracia ?? 0)} />
                  <ViewField label="Días Afectos" value={(viewTarget.dias_afectos ?? 0) === 1 ? 'Un Mes' : 'Todos Los Días'} />
                  {tipoCalculo === 0 && <ViewField label="% Mora" value={String(viewTarget.interes_mora ?? 0)} />}
                  {tipoCalculo === 1 && <ViewField label="Monto Mora" value={String(viewTarget.fijo_mora ?? 0)} />}
                  <ViewField label="Mora Mínima" value={formatMora(viewTarget.minimo_mora ?? 0)} />
                  <ViewField label="Mora Enganche" value={viewTarget.mora_enganche ? 'Sí' : 'No'} />
                  <ViewField label="Mínimo Abono Capital" value={String(viewTarget.minimo_abono_capital ?? 0)} />
                  <div className="col-span-2 flex items-center gap-3 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Otros Parámetros</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  <ViewField label="Moneda" value={(() => { const c = CURRENCY_MAP.get(viewTarget.moneda ?? ''); return c ? `${c.iso} — ${c.name}` : viewTarget.moneda })()} />
                  <ViewField label="Promesa Vencida" value={viewTarget.promesa_vencida ? 'Sí' : 'No'} />
                  {viewTarget.logo_url ? (
                    <div className="col-span-2 space-y-1">
                      <span className="text-xs text-muted-foreground">Logo</span>
                      <div className="mt-0.5">
                        <img src={viewTarget.logo_url} alt="Logo del proyecto"
                          className="max-h-20 max-w-[200px] rounded border border-border object-contain bg-white p-1" />
                      </div>
                    </div>
                  ) : (
                    <ViewField label="Logo" value="Sin logo" />
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-2 py-1">
                    <Checkbox
                      id="mora_automatica"
                      checked={form.mora_automatica === 1}
                      onCheckedChange={(checked: boolean) => f('mora_automatica', checked ? 1 : 0)}
                    />
                    <Label htmlFor="mora_automatica" className="cursor-pointer">Mora Automática</Label>
                  </div>
                  <div className="col-span-2 grid grid-cols-[1fr_minmax(10rem,1fr)_1fr_1fr] gap-6">
                    <div className="grid gap-1.5">
                      <Label htmlFor="forma_mora" className={`whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>Forma Cálculo</Label>
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
                      <Label htmlFor="tipo_calculo" className={`whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>Tipo Cálculo</Label>
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
                        <Label htmlFor="interes_mora" className={`whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>{form.mora_automatica === 1 ? '% Mora *' : '% Mora'}</Label>
                        <Input id="interes_mora" type="number" step="0.01" value={form.interes_mora} onChange={(e) => f('interes_mora', Number(e.target.value))} disabled={form.mora_automatica !== 1} />
                      </div>
                    ) : (
                      <div className="grid gap-1.5">
                        <Label htmlFor="fijo_mora" className={`whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>{form.mora_automatica === 1 ? 'Monto Mora *' : 'Monto Mora'}</Label>
                        <Input id="fijo_mora" type="number" step="0.01" value={form.fijo_mora} onChange={(e) => f('fijo_mora', Number(e.target.value))} disabled={form.mora_automatica !== 1} />
                      </div>
                    )}
                    <div className="grid gap-1.5">
                      <Label htmlFor="dias_gracia" className={`whitespace-nowrap${form.mora_automatica !== 1 ? ' text-muted-foreground' : ''}`}>{form.mora_automatica === 1 ? 'Días Gracia *' : 'Días Gracia'}</Label>
                      <Input id="dias_gracia" type="number" value={form.dias_gracia} onChange={(e) => f('dias_gracia', Number(e.target.value))} disabled={form.mora_automatica !== 1} />
                    </div>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                    <div className="grid gap-1.5">
                      <Label htmlFor="dias_afectos">Días Afectos</Label>
                      <Select value={String(form.dias_afectos ?? 0)} onValueChange={(v) => f('dias_afectos', Number(v))}>
                        <SelectTrigger id="dias_afectos" className="w-full"><SelectValue>{(v: string) => v === '1' ? 'Un Mes' : 'Todos Los Días'}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Todos Los Días</SelectItem>
                          <SelectItem value="1">Un Mes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="minimo_mora">Mora Mínima</Label>
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
                      <Label htmlFor="mora_enganche" className="cursor-pointer">Mora Enganche</Label>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-3 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abono Capital</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  <div className="grid gap-1.5 w-3/4"><Label htmlFor="minimo_abono">Mínimo Abono Capital</Label><Input id="minimo_abono" type="number" step="0.01" value={form.minimo_abono_capital} onChange={(e) => f('minimo_abono_capital', Number(e.target.value))} /></div>
                  <div className="col-span-2 flex items-center gap-3 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Otros Parámetros</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  <div className="col-span-2 flex items-end gap-4">
                    <div className="grid gap-1.5 w-72">
                      <Label>Moneda *</Label>
                      <Select value={form.moneda} onValueChange={(v) => f('moneda', v ?? 'GTQ')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar moneda">
                            {(v: string) => {
                              const c = CURRENCY_MAP.get(v)
                              return c ? (
                                <span className="flex items-center gap-2">
                                  <img src={`https://flagcdn.com/w20/${c.flagIso.toLowerCase()}.png`} alt={c.flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                  <span>{c.iso} — {c.name}</span>
                                </span>
                              ) : null
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.iso} value={c.iso}>
                              <span className="flex items-center gap-2">
                                <img src={`https://flagcdn.com/w20/${c.flagIso.toLowerCase()}.png`} alt={c.flagIso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                                {c.iso} — {c.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id="promesa_vencida"
                        checked={form.promesa_vencida === 1}
                        onCheckedChange={(checked: boolean) => f('promesa_vencida', checked ? 1 : 0)}
                      />
                      <Label htmlFor="promesa_vencida" className="cursor-pointer">Promesa Vencida</Label>
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
                <Button onClick={startEdit} className="gap-2">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
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
