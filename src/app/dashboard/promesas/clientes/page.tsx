import { getClientes } from '@/app/actions/clientes'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getPaises, getDepartamentos, getMunicipios } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { ClientesClient } from './_client'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, paises, departamentos, municipios, permisos] = await Promise.all([
    getClientes().catch((e: Error) => { console.error('getClientes:', e.message); return [] as Awaited<ReturnType<typeof getClientes>> }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Awaited<ReturnType<typeof getEmpresas>> }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Awaited<ReturnType<typeof getProyectos>> }),
    getPaises().catch((e: Error) => { console.error('getPaises:', e.message); return [] as Awaited<ReturnType<typeof getPaises>> }),
    getDepartamentos().catch((e: Error) => { console.error('getDepartamentos:', e.message); return [] as Awaited<ReturnType<typeof getDepartamentos>> }),
    getMunicipios().catch((e: Error) => { console.error('getMunicipios:', e.message); return [] as Awaited<ReturnType<typeof getMunicipios>> }),
    getPermisosDetalle(PERMISOS.CLI_CAT),
  ])

  return (
    <ClientesClient
      initialData={data}
      empresas={empresas}
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
