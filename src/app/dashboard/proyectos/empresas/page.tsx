import { getEmpresas } from '@/app/actions/empresas'
import { getPaises, getDepartamentos, getMunicipios } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { EmpresasClient } from './_client'

export default async function EmpresasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, paises, departamentos, municipios, permisos] = await Promise.all([
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] }),
    getPaises().catch((e: Error) => { console.error('getPaises:', e.message); return [] }),
    getDepartamentos().catch((e: Error) => { console.error('getDepartamentos:', e.message); return [] }),
    getMunicipios().catch((e: Error) => { console.error('getMunicipios:', e.message); return [] }),
    getPermisosDetalle(PERMISOS.EMP_CAT).catch((e: Error) => { console.error('getPermisosDetalle:', e.message); return { consultar: false, agregar: false, modificar: false, eliminar: false } }),
  ])

  return (
    <EmpresasClient
      initialData={data}
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
