import { getSeriesRecibos, getSeriesFactura } from '@/app/actions/series-recibos'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { SeriesRecibosClient } from './_client'

export default async function SeriesRecibosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, seriesFactura, permisos] = await Promise.all([
    getSeriesRecibos().catch((e: Error) => { console.error('getSeriesRecibos:', e.message); return [] as Awaited<ReturnType<typeof getSeriesRecibos>> }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Awaited<ReturnType<typeof getEmpresas>> }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Awaited<ReturnType<typeof getProyectos>> }),
    getSeriesFactura().catch((e: Error) => { console.error('getSeriesFactura:', e.message); return [] as Awaited<ReturnType<typeof getSeriesFactura>> }),
    getPermisosDetalle(PERMISOS.SER_REC).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
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
