import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cuentaActiva = (user?.app_metadata as Record<string, string>)?.cuenta_activa

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {cuentaActiva && (
        <p className="text-muted-foreground">
          Cuenta activa: <span className="font-medium text-foreground">{cuentaActiva}</span>
        </p>
      )}
    </div>
  )
}
