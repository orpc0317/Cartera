'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Layers,
  Grid3x3,
  MapPin,
  Users,
  UserCog,
  UserCheck,
  Banknote,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronRight,
  LogOut,
  Map,
  Home,
  Landmark,
  CreditCard,
  ClipboardList,
  Network,
  Scale,
  Receipt,
  BookOpen,
  Tags,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { logout } from '@/app/actions/auth'
import { PERMISOS } from '@/lib/permisos'

// ─── Tipos ─────────────────────────────────────────────────────────────────

type NavChild = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  separator?: string   // Encabezado de sección mostrado encima de este item
  comingSoon?: boolean
}

type NavItem = {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavChild[]
  comingSoon?: boolean
  permiso?: string  // Si está definido, solo se muestra si el usuario tiene este permiso
}

// ─── Estructura de navegación ──────────────────────────────────────────────

const NAV: NavItem[] = [
  {
    label: 'Inicio',
    href: '/dashboard/home',
    icon: Home,
  },
  {
    label: 'Dashboard KPIs',
    href: '/dashboard/kpis',
    icon: LayoutDashboard,
    permiso: PERMISOS.DASH_KPI,
  },
  {
    label: 'Proyectos',
    icon: FolderKanban,
    children: [
      { label: 'Empresas',  href: '/dashboard/proyectos/empresas',  icon: Building2 },
      { label: 'Proyectos', href: '/dashboard/proyectos/proyectos', icon: FolderKanban },
      { label: 'Fases',     href: '/dashboard/proyectos/fases',     icon: Layers },
      { label: 'Manzanas',  href: '/dashboard/proyectos/manzanas',  icon: Grid3x3 },
      { label: 'Lotes',     href: '/dashboard/proyectos/lotes',     icon: MapPin },
    ],
  },
  {
    label: 'Bancos',
    icon: Landmark,
    children: [
      { label: 'Bancos',           href: '/dashboard/bancos/bancos',  icon: Landmark },
      { label: 'Cuentas Bancarias', href: '/dashboard/bancos/cuentas-bancarias', icon: CreditCard },
    ],
  },
  {
    label: 'Promesas',
    icon: FileText,
    children: [
      { label: 'Clientes',     href: '/dashboard/promesas/clientes',     icon: Users,          separator: 'Catálogos' },
      { label: 'Supervisores',  href: '/dashboard/promesas/supervisores',  icon: UserCog },
      { label: 'Coordinadores', href: '/dashboard/promesas/coordinadores', icon: Network },
      { label: 'Vendedores',    href: '/dashboard/promesas/vendedores',    icon: UserCheck },
      { label: 'Cobradores',   href: '/dashboard/promesas/cobradores',   icon: Banknote },
      { label: 'Reservas',     href: '/dashboard/promesas/reservas',     icon: ClipboardList,  separator: 'Operaciones' },
      { label: 'Balance',      href: '#',                                icon: Scale,          separator: 'Consultas', comingSoon: true },
    ],
  },
  {
    label: 'Cuentas Cobrar',
    icon: BookOpen,
    children: [
      { label: 'Serie Recibos',    href: '/dashboard/cuentas-cobrar/series-recibos',   icon: Receipt,       separator: 'Catalogo' },
      { label: 'Tipos Ingresos',   href: '/dashboard/cuentas-cobrar/tipos-ingresos',   icon: Tags },
      { label: 'Operaciones',      href: '#', icon: ClipboardList, separator: 'Operaciones', comingSoon: true },
      { label: 'Consultas',        href: '#', icon: BarChart3,     separator: 'Consultas',   comingSoon: true },
    ],
  },
  {
    label: 'Mapa',
    href: '#',
    icon: Map,
    comingSoon: true,
  },
]

// ─── Componente item de navegación ─────────────────────────────────────────

function NavGroup({ item, cuentaActiva }: { item: NavItem; cuentaActiva?: string }) {
  const pathname = usePathname()

  const isChildActive = item.children?.some((c) => pathname.startsWith(c.href))
  const isActive = item.href ? pathname === item.href : isChildActive

  const [open, setOpen] = useState(isChildActive ?? false)

  if (item.href && !item.children) {
    return (
      <Link href={item.href}>
        <motion.div
          whileHover={{ x: 2 }}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </motion.div>
      </Link>
    )
  }

  return (
    <div>
      <motion.button
        whileHover={{ x: 2 }}
        onClick={() => !item.comingSoon && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isChildActive
            ? 'text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          item.comingSoon && 'cursor-default opacity-50'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {item.comingSoon ? (
          <span className="rounded-full bg-sidebar-border px-1.5 py-0.5 text-[10px] text-sidebar-foreground/40">
            pronto
          </span>
        ) : open ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        )}
      </motion.button>

      <AnimatePresence initial={false}>
        {open && item.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 ml-3 border-l border-sidebar-border pl-3">
              {item.children.map((child) => {
                const childActive = pathname.startsWith(child.href) && child.href !== '#'
                return (
                  <div key={child.label}>
                    {child.separator && (
                      <p className="mt-2 mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">
                        {child.separator}
                      </p>
                    )}
                    {child.comingSoon ? (
                      <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm opacity-40 cursor-default">
                        <child.icon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60" />
                        <span className="text-sidebar-foreground/60">{child.label}</span>
                        <span className="ml-auto rounded-full bg-sidebar-border px-1.5 py-0.5 text-[10px] text-sidebar-foreground/40">pronto</span>
                      </div>
                    ) : (
                      <Link href={child.href}>
                        <motion.div
                          whileHover={{ x: 2 }}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                            childActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm'
                              : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          {child.label}
                        </motion.div>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Sidebar principal ─────────────────────────────────────────────────────

export function AppSidebar({
  cuentaActiva,
  userEmail,
  permisos,
}: {
  cuentaActiva?: string
  userEmail?: string
  permisos: string[]
}) {
  const visibleNav = NAV.filter(
    (item) => !item.permiso || permisos.includes(item.permiso)
  )
  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
          <MapPin className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-accent-foreground">Cartera</p>
          <p className="text-[11px] text-sidebar-foreground/40">Gestión de Lotificaciones</p>
        </div>
      </div>

      {/* Cuenta activa */}
      {cuentaActiva && (
        <div className="mx-3 mt-3 rounded-lg bg-sidebar-accent/60 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            Cuenta
          </p>
          <p className="truncate text-xs font-semibold text-sidebar-primary">{cuentaActiva}</p>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {visibleNav.map((item) => (
            <NavGroup key={item.label} item={item} cuentaActiva={cuentaActiva} />
          ))}
        </div>
      </nav>

      {/* Footer: usuario + logout */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
            {userEmail?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <p className="flex-1 truncate text-xs text-sidebar-foreground/50">{userEmail}</p>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-destructive"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
