import { getSupervisores } from '@/app/actions/supervisores'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { SupervisoresClient } from './_client'

export default async function SupervisoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, permisos] = await Promise.all([
    getSupervisores().catch((e: Error) => { console.error('getSupervisores:', e.message); return [] as Awaited<ReturnType<typeof getSupervisores>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getPermisosDetalle(PERMISOS.SUP_CAT),
  ])

  return (
    <SupervisoresClient
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
