import { getTiposIngresos } from '@/app/actions/tipos-ingresos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario, getProyectoMonedas } from '@/app/actions/proyectos'
import { getMonedas } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { createClient } from '@/lib/supabase/server'
import { PERMISOS } from '@/lib/permisos'
import { TiposIngresosClient } from './_client'

export default async function TiposIngresosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tiposIngresos, empresas, proyectos, monedas, proyectoMonedas, permisos] = await Promise.all([
    getTiposIngresos().catch((e: Error) => { console.error('getTiposIngresos:', e.message); return [] }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] }),
    getMonedas().catch((e: Error) => { console.error('getMonedas:', e.message); return [] }),
    getProyectoMonedas().catch((e: Error) => { console.error('getProyectoMonedas:', e.message); return [] }),
    getPermisosDetalle(PERMISOS.TIN_CAT),
  ])

  return (
    <TiposIngresosClient
      initialData={tiposIngresos}
      empresas={empresas}
      proyectos={proyectos}
      monedas={monedas}
      proyectoMonedas={proyectoMonedas}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
