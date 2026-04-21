import { getVendedores } from '@/app/actions/vendedores'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getSupervisores } from '@/app/actions/supervisores'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { VendedoresClient } from './_client'

export default async function VendedoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, supervisores, permisos] = await Promise.all([
    getVendedores().catch((e: Error) => { console.error('getVendedores:', e.message); return [] as Awaited<ReturnType<typeof getVendedores>> }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Awaited<ReturnType<typeof getEmpresas>> }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Awaited<ReturnType<typeof getProyectos>> }),
    getSupervisores().catch((e: Error) => { console.error('getSupervisores:', e.message); return [] as Awaited<ReturnType<typeof getSupervisores>> }),
    getPermisosDetalle(PERMISOS.VEN_CAT),
  ])

  return (
    <VendedoresClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      supervisores={supervisores}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
