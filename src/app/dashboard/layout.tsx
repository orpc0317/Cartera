import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { CuentaChangeListener } from '@/components/layout/cuenta-change-listener'
import { getCuentaActiva } from '@/app/actions/permisos'
import { getCuentasDelUsuario } from '@/app/actions/auth'
import { getMenuPrincipal } from '@/app/actions/menu'
import type { MenuModulo } from '@/lib/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const userEmail = user.email
  const [cuentaActiva, cuentas, menu] = await Promise.all([
    getCuentaActiva(),
    getCuentasDelUsuario(user.id),
    getMenuPrincipal().catch((e: Error) => {
      console.error('getMenuPrincipal:', e.message)
      return [] as MenuModulo[]
    }),
  ])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CuentaChangeListener />
      {/* Sidebar fijo */}
      <AppSidebar
        cuentaActiva={cuentaActiva}
        cuentas={cuentas}
        userEmail={userEmail}
        menu={menu}
      />

      {/* Contenido principal */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
