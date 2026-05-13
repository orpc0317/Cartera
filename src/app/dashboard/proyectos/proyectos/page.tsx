import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getFases } from '@/app/actions/fases'
import { getPaises, getDepartamentos, getMunicipios, getMonedas } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { ProyectosClient } from './_client'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, fases, paises, departamentos, municipios, monedas, permisos] = await Promise.all([
    getProyectos().catch(() => []),
    getEmpresas().catch(() => []),
    getFases().catch(() => []),
    getPaises().catch((e: Error) => { console.error(e.message); return [] }),
    getDepartamentos().catch((e: Error) => { console.error(e.message); return [] }),
    getMunicipios().catch((e: Error) => { console.error(e.message); return [] }),
    getMonedas().catch((e: Error) => { console.error('getMonedas:', e.message); return [] }),
    getPermisosDetalle(PERMISOS.PRO_CAT),
  ])
  return (
    <ProyectosClient
      initialData={data}
      empresas={empresas}
      fases={fases}
      paises={paises}
      departamentos={departamentos}
      municipios={municipios}
      monedas={monedas}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
