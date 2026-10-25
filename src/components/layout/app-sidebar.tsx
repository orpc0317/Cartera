'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  Check,
  Home,
  LogOut,
  MapPin,
  Settings,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { logout, switchCuenta, type Cuenta } from '@/app/actions/auth'
import { iconoModulo, type MenuModulo } from '@/lib/navigation'

function moduloActivo(modulo: MenuModulo, pathname: string, hash: string): boolean {
  if (hash === `#${modulo.id}` && (pathname === '/dashboard/home' || pathname === '/dashboard')) {
    return true
  }
  return modulo.items.some((item) => {
    if (!item.href) return false
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  })
}

export function AppSidebar({
  cuentaActiva,
  cuentas,
  userEmail,
  menu,
}: {
  cuentaActiva?: string
  cuentas: Cuenta[]
  userEmail?: string
  menu: MenuModulo[]
}) {
  const pathname = usePathname()
  const [switching, setSwitching] = useState(false)
  const [hash, setHash] = useState('')

  useEffect(() => {
    const leer = () => setHash(window.location.hash)
    leer()
    window.addEventListener('hashchange', leer)
    return () => window.removeEventListener('hashchange', leer)
  }, [pathname])

  const inicioActivo = (pathname === '/dashboard/home' || pathname === '/dashboard') && !hash
  const nombreCuenta = cuentas.find((cuenta) => cuenta.cuenta === cuentaActiva)?.nombre ?? cuentaActiva

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-64">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-3 py-4 md:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
          <MapPin className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="text-sm font-semibold text-sidebar-accent-foreground">Cartera</p>
          <p className="text-[11px] text-sidebar-foreground/40">Gestión de Lotificaciones</p>
        </div>
      </div>

      {cuentaActiva && (
        nombreCuenta && cuentas.length <= 1 ? (
          <div className="mx-3 mt-3 hidden rounded-lg bg-sidebar-accent/60 px-3 py-2 md:block">
            <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              Cuenta
            </p>
            <p className="truncate text-xs font-semibold text-sidebar-primary">{nombreCuenta}</p>
          </div>
        ) : (
          <div className="mx-3 mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="flex w-full items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2 transition-colors hover:bg-sidebar-accent"
                    disabled={switching}
                  />
                }
              >
                <div className="hidden min-w-0 flex-1 md:block">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                    Cuenta
                  </p>
                  <p className="truncate text-xs font-semibold text-sidebar-primary">{nombreCuenta}</p>
                </div>
                <ArrowLeftRight className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start" className="w-52">
                <DropdownMenuLabel>Cambiar cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {cuentas.map((cuenta) => (
                  <DropdownMenuItem
                    key={cuenta.cuenta}
                    disabled={cuenta.cuenta === cuentaActiva || switching}
                    onClick={async () => {
                      if (cuenta.cuenta === cuentaActiva) return
                      setSwitching(true)
                      const result = await switchCuenta(cuenta.cuenta)
                      if (!result.error) {
                        const channel = new BroadcastChannel('cartera-cuenta')
                        channel.postMessage({ type: 'cuenta-changed' })
                        channel.close()
                        window.location.href = '/dashboard/home'
                      } else {
                        setSwitching(false)
                      }
                    }}
                  >
                    {cuenta.cuenta === cuentaActiva ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {cuenta.nombre}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/home"
            title="Inicio"
            onClick={() => {
              if (window.location.pathname === '/dashboard/home' && window.location.hash) {
                window.history.pushState(null, '', '/dashboard/home')
                window.dispatchEvent(new HashChangeEvent('hashchange'))
              }
            }}
          >
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                inicioActivo
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Home className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Inicio</span>
            </div>
          </Link>

          {menu.map((modulo) => {
            const Icono = iconoModulo(modulo.nombre)
            const activo = moduloActivo(modulo, pathname, hash)
            return (
              <Link key={modulo.id} href={`/dashboard/home#${modulo.id}`} title={modulo.nombre}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    activo
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icono className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{modulo.nombre}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button title="Configuraciones" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent" />
            }
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
              {userEmail?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <p className="hidden flex-1 truncate text-left text-xs text-sidebar-foreground/50 md:block">{userEmail}</p>
            <Settings className="hidden h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 md:block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" sideOffset={6}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Configuraciones</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout()}
            >
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
