import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  Grid3x3,
  HandCoins,
  Home,
  IdCard,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Network,
  Receipt,
  ReceiptText,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'

export type MenuItem = {
  indice: string
  nombre: string
  href: string | null
  descripcion: string
  grupo: string
  comingSoon: boolean
  orden: number
}

export type MenuModulo = {
  id: string
  nombre: string
  orden: number
  items: MenuItem[]
}

export type PantallaMenu = {
  indice: string
  menu_array: string
  nombre: string
  mantenimiento: number
}

type Presentacion = {
  href: string
  descripcion: string
  grupo: string
  orden: number
  icon: LucideIcon
  accent: string
}

type Proximamente = {
  id: string
  modulo: string
  grupo: string
  nombre: string
  descripcion: string
  orden: number
  icon: LucideIcon
  accent: string
}

const GRUPO_ORDEN = ['Catálogos', 'Operaciones', 'Consultas', 'General']

const MODULO_ORDEN = [
  'Proyectos',
  'Bancos',
  'Promesas',
  'Cuentas Cobrar',
  'Generales',
  'Dashboard',
  'Mapa',
]

const PRESENTACION: Record<string, Presentacion> = {
  'EMP.CAT': {
    href: '/dashboard/proyectos/empresas',
    descripcion: 'Registra y administra las empresas lotificadoras',
    grupo: 'Catálogos',
    orden: 10,
    icon: Building2,
    accent: 'bg-emerald-100 text-emerald-600',
  },
  'PRO.CAT': {
    href: '/dashboard/proyectos/proyectos',
    descripcion: 'Gestiona los proyectos de lotificación por empresa',
    grupo: 'Catálogos',
    orden: 20,
    icon: FolderKanban,
    accent: 'bg-sky-100 text-sky-600',
  },
  'FAS.CAT': {
    href: '/dashboard/proyectos/fases',
    descripcion: 'Organiza las fases o etapas de cada proyecto',
    grupo: 'Catálogos',
    orden: 30,
    icon: Layers,
    accent: 'bg-violet-100 text-violet-600',
  },
  'MAN.CAT': {
    href: '/dashboard/proyectos/manzanas',
    descripcion: 'Administra las manzanas dentro de cada fase',
    grupo: 'Catálogos',
    orden: 40,
    icon: Grid3x3,
    accent: 'bg-amber-100 text-amber-600',
  },
  'LOT.CAT': {
    href: '/dashboard/proyectos/lotes',
    descripcion: 'Consulta la disponibilidad y el estado de cada lote',
    grupo: 'Catálogos',
    orden: 50,
    icon: MapPin,
    accent: 'bg-rose-100 text-rose-600',
  },
  'BAN.CAT': {
    href: '/dashboard/bancos/bancos',
    descripcion: 'Catálogo de bancos de la cuenta',
    grupo: 'Catálogos',
    orden: 10,
    icon: Landmark,
    accent: 'bg-teal-100 text-teal-600',
  },
  'CUE.BAN': {
    href: '/dashboard/bancos/cuentas-bancarias',
    descripcion: 'Cuentas bancarias donde se depositan los cobros',
    grupo: 'Catálogos',
    orden: 20,
    icon: CreditCard,
    accent: 'bg-cyan-100 text-cyan-600',
  },
  'TSC.CAT': {
    href: '/dashboard/bancos/tasas-cambio',
    descripcion: 'Tipos de cambio usados al registrar cobros',
    grupo: 'Operaciones',
    orden: 10,
    icon: ArrowLeftRight,
    accent: 'bg-teal-100 text-teal-600',
  },
  'DEP.BAN': {
    href: '/dashboard/bancos/operaciones/depositar-pagos',
    descripcion: 'Deposita en el banco los pagos recibidos',
    grupo: 'Operaciones',
    orden: 20,
    icon: CircleDollarSign,
    accent: 'bg-pink-100 text-pink-600',
  },
  'TRX.BAN': {
    href: '/dashboard/bancos/operaciones/transacciones',
    descripcion: 'Movimientos de las cuentas bancarias',
    grupo: 'Operaciones',
    orden: 30,
    icon: ScrollText,
    accent: 'bg-fuchsia-100 text-fuchsia-600',
  },
  'CLI.CAT': {
    href: '/dashboard/promesas/clientes',
    descripcion: 'Compradores de lotes de la cuenta',
    grupo: 'Catálogos',
    orden: 10,
    icon: Users,
    accent: 'bg-indigo-100 text-indigo-600',
  },
  'SUP.CAT': {
    href: '/dashboard/promesas/supervisores',
    descripcion: 'Supervisores de la fuerza de ventas',
    grupo: 'Catálogos',
    orden: 20,
    icon: UserCog,
    accent: 'bg-purple-100 text-purple-600',
  },
  'COO.CAT': {
    href: '/dashboard/promesas/coordinadores',
    descripcion: 'Coordinadores asignados a cada supervisor',
    grupo: 'Catálogos',
    orden: 30,
    icon: Network,
    accent: 'bg-blue-100 text-blue-600',
  },
  'VEN.CAT': {
    href: '/dashboard/promesas/vendedores',
    descripcion: 'Vendedores que registran reservas y promesas',
    grupo: 'Catálogos',
    orden: 40,
    icon: UserCheck,
    accent: 'bg-lime-100 text-lime-600',
  },
  'COB.CAT': {
    href: '/dashboard/promesas/cobradores',
    descripcion: 'Cobradores que reciben los pagos',
    grupo: 'Catálogos',
    orden: 50,
    icon: Banknote,
    accent: 'bg-orange-100 text-orange-600',
  },
  'RES.OPE': {
    href: '/dashboard/promesas/reservas',
    descripcion: 'Aparta un lote antes de formalizar la promesa',
    grupo: 'Operaciones',
    orden: 10,
    icon: ClipboardList,
    accent: 'bg-primary/10 text-primary',
  },
  'PRE.OPE': {
    href: '/dashboard/promesas/promesas',
    descripcion: 'Promesas de compraventa y su plan de pagos',
    grupo: 'Operaciones',
    orden: 20,
    icon: FileSignature,
    accent: 'bg-zinc-100 text-zinc-600',
  },
  'SER.REC': {
    href: '/dashboard/cuentas-cobrar/series-recibos',
    descripcion: 'Series de recibos de caja',
    grupo: 'Catálogos',
    orden: 10,
    icon: Receipt,
    accent: 'bg-green-100 text-green-600',
  },
  'TIN.CAT': {
    href: '/dashboard/cuentas-cobrar/tipos-ingresos',
    descripcion: 'Clasifica los ingresos que se cobran',
    grupo: 'Catálogos',
    orden: 20,
    icon: Tags,
    accent: 'bg-yellow-100 text-yellow-600',
  },
  'PAG.CUO': {
    href: '/dashboard/cuentas-cobrar/operaciones/pago-cuotas',
    descripcion: 'Registra el pago de cuotas de una promesa',
    grupo: 'Operaciones',
    orden: 10,
    icon: HandCoins,
    accent: 'bg-red-100 text-red-600',
  },
  'PAG.MAN': {
    href: '/dashboard/cuentas-cobrar/operaciones/pagos',
    descripcion: 'Consulta y da mantenimiento a los pagos',
    grupo: 'Operaciones',
    orden: 20,
    icon: ReceiptText,
    accent: 'bg-stone-100 text-stone-600',
  },
  'TDO.CAT': {
    href: '/dashboard/generales/tipos-documento',
    descripcion: 'Tipos de documento de identidad',
    grupo: 'Catálogos',
    orden: 10,
    icon: IdCard,
    accent: 'bg-slate-100 text-slate-600',
  },
  'GFA.CAT': {
    href: '/dashboard/generales/gface',
    descripcion: 'Configuración del facturador electrónico',
    grupo: 'Catálogos',
    orden: 20,
    icon: ShieldCheck,
    accent: 'bg-gray-100 text-gray-600',
  },
  'DASH.KPI': {
    href: '/dashboard/kpis',
    descripcion: 'Indicadores generales de la cuenta',
    grupo: 'General',
    orden: 10,
    icon: LayoutDashboard,
    accent: 'bg-primary/10 text-primary',
  },
}

const PROXIMAMENTE: Proximamente[] = [
  {
    id: 'soon-balance',
    modulo: 'Promesas',
    grupo: 'Consultas',
    nombre: 'Balance',
    descripcion: 'Estado de cuenta de las promesas',
    orden: 10,
    icon: Scale,
    accent: 'bg-muted text-muted-foreground',
  },
  {
    id: 'soon-consultas',
    modulo: 'Cuentas Cobrar',
    grupo: 'Consultas',
    nombre: 'Consultas',
    descripcion: 'Consultas de cuentas por cobrar',
    orden: 10,
    icon: BarChart3,
    accent: 'bg-muted text-muted-foreground',
  },
  {
    id: 'soon-mapa',
    modulo: 'Mapa',
    grupo: 'General',
    nombre: 'Mapa',
    descripcion: 'Ubicación de los lotes en el proyecto',
    orden: 10,
    icon: MapIcon,
    accent: 'bg-muted text-muted-foreground',
  },
]

const ICONOS_MODULO: Record<string, LucideIcon> = {
  Proyectos: FolderKanban,
  Bancos: Landmark,
  Promesas: FileText,
  'Cuentas Cobrar': BookOpen,
  Generales: Settings,
  Dashboard: LayoutDashboard,
  Mapa: MapIcon,
  Inicio: Home,
}

export function normalizar(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function slugModulo(nombre: string): string {
  return normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function iconoModulo(nombre: string): LucideIcon {
  const clave = Object.keys(ICONOS_MODULO).find((item) => normalizar(item) === normalizar(nombre))
  return (clave && ICONOS_MODULO[clave]) || LayoutGrid
}

export function estiloItem(indice: string): { icon: LucideIcon; accent: string } {
  const pantalla = PRESENTACION[indice]
  if (pantalla) return { icon: pantalla.icon, accent: pantalla.accent }
  const pronto = PROXIMAMENTE.find((item) => item.id === indice)
  if (pronto) return { icon: pronto.icon, accent: pronto.accent }
  return { icon: LayoutGrid, accent: 'bg-primary/10 text-primary' }
}

function rangoGrupo(grupo: string): number {
  const indice = GRUPO_ORDEN.indexOf(grupo)
  return indice === -1 ? GRUPO_ORDEN.length : indice
}

function ordenModulo(nombre: string): number {
  const indice = MODULO_ORDEN.findIndex((item) => normalizar(item) === normalizar(nombre))
  return indice === -1 ? 1000 : indice
}

function moduloHabilitado(nombre: string, habilitados: Set<string> | null): boolean {
  if (!habilitados) return true
  return habilitados.has(normalizar(nombre))
}

export function construirMenu(input: {
  pantallas: PantallaMenu[]
  indicesConsultar: Set<string> | null
  modulosCuenta: string[]
}): MenuModulo[] {
  const habilitados = input.modulosCuenta.length > 0
    ? new Set(input.modulosCuenta.map((nombre) => normalizar(nombre)))
    : null

  const porModulo = new Map<string, MenuItem[]>()

  for (const pantalla of input.pantallas) {
    const indice = pantalla.indice?.trim()
    const modulo = pantalla.menu_array?.trim()
    if (!indice || !modulo || indice === 'DASH.HOM') continue
    if (input.indicesConsultar && !input.indicesConsultar.has(indice)) continue
    if (!moduloHabilitado(modulo, habilitados)) continue

    const meta = PRESENTACION[indice]
    const lista = porModulo.get(modulo) ?? []
    lista.push({
      indice,
      nombre: pantalla.nombre?.trim() || indice,
      href: meta?.href ?? null,
      descripcion: meta?.descripcion ?? '',
      grupo: meta?.grupo ?? (Number(pantalla.mantenimiento) === 1 ? 'Catálogos' : 'Operaciones'),
      comingSoon: false,
      orden: meta?.orden ?? 1000,
    })
    porModulo.set(modulo, lista)
  }

  for (const pronto of PROXIMAMENTE) {
    if (!moduloHabilitado(pronto.modulo, habilitados)) continue
    const lista = porModulo.get(pronto.modulo) ?? []
    lista.push({
      indice: pronto.id,
      nombre: pronto.nombre,
      href: null,
      descripcion: pronto.descripcion,
      grupo: pronto.grupo,
      comingSoon: true,
      orden: pronto.orden,
    })
    porModulo.set(pronto.modulo, lista)
  }

  const modulos: MenuModulo[] = []
  for (const [nombre, items] of porModulo) {
    items.sort((a, b) => {
      const grupo = rangoGrupo(a.grupo) - rangoGrupo(b.grupo)
      if (grupo !== 0) return grupo
      if (a.orden !== b.orden) return a.orden - b.orden
      return a.nombre.localeCompare(b.nombre, 'es')
    })
    modulos.push({
      id: slugModulo(nombre),
      nombre,
      orden: ordenModulo(nombre),
      items,
    })
  }

  modulos.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
  return modulos
}

export function gruposDe(items: MenuItem[]): { nombre: string; items: MenuItem[] }[] {
  const grupos = new Map<string, MenuItem[]>()
  for (const item of items) {
    const lista = grupos.get(item.grupo) ?? []
    lista.push(item)
    grupos.set(item.grupo, lista)
  }
  return [...grupos.entries()].map(([nombre, lista]) => ({ nombre, items: lista }))
}
