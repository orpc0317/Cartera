import { getTiposIngresos } from '@/app/actions/tipos-ingresos'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getMonedas } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { createClient } from '@/lib/supabase/server'
import { PERMISOS } from '@/lib/permisos'
import { TiposIngresosClient } from './_client'

export default async function TiposIngresosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tiposIngresos, empresas, proyectos, monedas, permisos] = await Promise.all([
    getTiposIngresos().catch((e: Error) => { console.error('getTiposIngresos:', e.message); return [] }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] }),
    getMonedas().catch((e: Error) => { console.error('getMonedas:', e.message); return [] }),
    getPermisosDetalle(PERMISOS.TIN_CAT),
  ])

  return (
    <TiposIngresosClient
      initialData={tiposIngresos}
      empresas={empresas}
      proyectos={proyectos}
      monedas={monedas}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
