import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getPaises, getDepartamentos, getMunicipios } from '@/app/actions/geo'
import { createClient } from '@/lib/supabase/server'
import { ProyectosClient } from './_client'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, paises, departamentos, municipios] = await Promise.all([
    getProyectos().catch(() => []),
    getEmpresas().catch(() => []),
    getPaises().catch((e: Error) => { console.error(e.message); return [] }),
    getDepartamentos().catch((e: Error) => { console.error(e.message); return [] }),
    getMunicipios().catch((e: Error) => { console.error(e.message); return [] }),
  ])
  return (
    <ProyectosClient
      initialData={data}
      empresas={empresas}
      paises={paises}
      departamentos={departamentos}
      municipios={municipios}
      userId={user?.id ?? ''}
    />
  )
}
