import { getCobradores } from '@/app/actions/cobradores'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { CobradoresClient } from './_client'

export default async function CobradoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, permisos] = await Promise.all([
    getCobradores().catch((e: Error) => { console.error('getCobradores:', e.message); return [] as Awaited<ReturnType<typeof getCobradores>> }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Awaited<ReturnType<typeof getEmpresas>> }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Awaited<ReturnType<typeof getProyectos>> }),
    getPermisosDetalle(PERMISOS.COB_CAT),
  ])

  return (
    <CobradoresClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
