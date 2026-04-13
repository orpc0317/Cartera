import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FolderKanban, MapPin, Layers, BarChart3 } from 'lucide-react'
import { getPermisosUsuario } from '@/app/actions/permisos'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

async function getMetrics(cuentaActiva: string) {
  const admin = createAdminClient()
  const [empresas, proyectos, fases, lotes] = await Promise.all([
    admin.schema('cartera').from('t_empresa').select('codigo', { count: 'exact', head: true }).eq('cuenta', cuentaActiva),
    admin.schema('cartera').from('t_proyecto').select('codigo', { count: 'exact', head: true }).eq('cuenta', cuentaActiva),
    admin.schema('cartera').from('t_fase').select('codigo', { count: 'exact', head: true }).eq('cuenta', cuentaActiva),
    admin.schema('cartera').from('t_lote').select('codigo', { count: 'exact', head: true }).eq('cuenta', cuentaActiva),
  ])
  return {
    empresas: empresas.count ?? 0,
    proyectos: proyectos.count ?? 0,
    fases: fases.count ?? 0,
    lotes: lotes.count ?? 0,
  }
}

export default async function KpisPage() {
  // Guard: verificar permiso antes de mostrar
  const permisos = await getPermisosUsuario()
  if (!tienePermiso(permisos, PERMISOS.DASH_KPI)) {
    redirect('/dashboard/home')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cuentaActiva = (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
  const metrics = await getMetrics(cuentaActiva)

  const cards = [
    {
      title: 'Empresas',
      value: metrics.empresas,
      icon: Building2,
      description: 'Empresas registradas',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Proyectos',
      value: metrics.proyectos,
      icon: FolderKanban,
      description: 'Proyectos activos',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      title: 'Fases',
      value: metrics.fases,
      icon: Layers,
      description: 'Fases en proyectos',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      title: 'Lotes',
      value: metrics.lotes,
      icon: MapPin,
      description: 'Lotes registrados',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Indicadores generales de{' '}
            <span className="font-medium text-foreground">{cuentaActiva}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Resumen general
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Card
              key={card.title}
              className="border-border/60 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  {card.value.toLocaleString('es-GT')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
