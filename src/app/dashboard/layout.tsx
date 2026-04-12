import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

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

  const cuentaActiva = (user.app_metadata as Record<string, string>)?.cuenta_activa

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
          <span className="font-semibold tracking-tight">Cartera</span>
          <div className="flex items-center gap-4">
            {cuentaActiva && (
              <span className="text-sm text-muted-foreground">{cuentaActiva}</span>
            )}
            <form action={logout}>
              <Button variant="outline" size="sm" type="submit">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  )
}
