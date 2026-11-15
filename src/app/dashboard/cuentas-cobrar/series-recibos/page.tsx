import { getSeriesRecibos, getSeriesFactura } from '@/app/actions/series-recibos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS, PERMISOS_CERRADOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { SeriesRecibosClient } from './_client'

export default async function SeriesRecibosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, seriesFactura, permisos] = await Promise.all([
    getSeriesRecibos().catch((e: Error) => { console.error('getSeriesRecibos:', e.message); return [] as Awaited<ReturnType<typeof getSeriesRecibos>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getSeriesFactura().catch((e: Error) => { console.error('getSeriesFactura:', e.message); return [] as Awaited<ReturnType<typeof getSeriesFactura>> }),
    getPermisosDetalle(PERMISOS.SER_REC).catch((e: Error) => { console.error('getPermisosDetalle:', e.message); return PERMISOS_CERRADOS }),
  ])

  return (
    <SeriesRecibosClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      seriesFactura={seriesFactura}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
