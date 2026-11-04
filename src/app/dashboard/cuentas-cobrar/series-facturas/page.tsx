import { getSeriesFacturas } from '@/app/actions/series-facturas'
import { getGfaces } from '@/app/actions/gface'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { SeriesFacturasClient } from './_client'

export default async function SeriesFacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, gfaces, permisos] = await Promise.all([
    getSeriesFacturas().catch((e: Error) => { console.error('getSeriesFacturas:', e.message); return [] as Awaited<ReturnType<typeof getSeriesFacturas>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getGfaces().catch((e: Error) => { console.error('getGfaces:', e.message); return [] as Awaited<ReturnType<typeof getGfaces>> }),
    getPermisosDetalle(PERMISOS.SER_FAC).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <SeriesFacturasClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      gfaces={gfaces}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
