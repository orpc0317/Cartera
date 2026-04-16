import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getPaises, getDepartamentos, getMunicipios } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { EmpresasClient } from './_client'

export default async function EmpresasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, proyectos, paises, departamentos, municipios, permisos] = await Promise.all([
    getEmpresas().catch(() => []),
    getProyectos().catch(() => []),
    getPaises().catch((e: Error) => { console.error(e.message); return [] }),
    getDepartamentos().catch((e: Error) => { console.error(e.message); return [] }),
    getMunicipios().catch((e: Error) => { console.error(e.message); return [] }),
    getPermisosDetalle(PERMISOS.EMP_CAT),
  ])

  return (
    <EmpresasClient
      initialData={data}
      proyectos={proyectos}
      paises={paises}
      departamentos={departamentos}
      municipios={municipios}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
