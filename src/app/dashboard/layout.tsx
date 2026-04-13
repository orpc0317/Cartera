import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { getPermisosUsuario } from '@/app/actions/permisos'

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

  const meta = user.app_metadata as Record<string, string>
  const cuentaActiva = meta?.cuenta_activa
  const userEmail = user.email

  const permisos = await getPermisosUsuario()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar fijo */}
      <AppSidebar
        cuentaActiva={cuentaActiva}
        userEmail={userEmail}
        permisos={permisos}
      />

      {/* Contenido principal */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
