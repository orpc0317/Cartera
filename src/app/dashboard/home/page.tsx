import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Building2, FolderKanban, MapPin, Layers,
  Grid3x3, ArrowRight, Home,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const ACCESOS = [
  {
    label:  'Empresas',
    desc:   'Registra y administra las empresas lotificadoras',
    href:   '/dashboard/proyectos/empresas',
    icon:   Building2,
    color:  'bg-emerald-100 text-emerald-700',
  },
  {
    label:  'Proyectos',
    desc:   'Gestiona los proyectos de lotificación por empresa',
    href:   '/dashboard/proyectos/proyectos',
    icon:   FolderKanban,
    color:  'bg-sky-100 text-sky-700',
  },
  {
    label:  'Fases',
    desc:   'Organiza las fases o etapas de cada proyecto',
    href:   '/dashboard/proyectos/fases',
    icon:   Layers,
    color:  'bg-violet-100 text-violet-700',
  },
  {
    label:  'Manzanas',
    desc:   'Administra las manzanas dentro de cada fase',
    href:   '/dashboard/proyectos/manzanas',
    icon:   Grid3x3,
    color:  'bg-rose-100 text-rose-700',
  },
  {
    label:  'Lotes',
    desc:   'Catálogo de lotes — disponibilidad y estado de promesas',
    href:   '/dashboard/proyectos/lotes',
    icon:   MapPin,
    color:  'bg-amber-100 text-amber-700',
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const meta = user?.app_metadata as Record<string, string> | undefined
  const cuentaActiva = meta?.cuenta_activa ?? ''

  // Saludo según hora del día
  const hour = new Date().getHours()
  const saludo =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Home className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {saludo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Bienvenido a{' '}
            <span className="font-medium text-foreground">{cuentaActiva}</span>
            {' '}— ¿qué necesitas hacer hoy?
          </p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACCESOS.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="group cursor-pointer border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`shrink-0 rounded-xl p-3 ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      {item.desc}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
