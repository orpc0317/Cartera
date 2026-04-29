import { getCoordinadores } from '@/app/actions/coordinadores'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getSupervisores } from '@/app/actions/supervisores'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import type { Coordinador } from '@/lib/types/proyectos'
import { CoordinadoresClient } from './_client'

export default async function CoordinadoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, supervisores, permisos] = await Promise.all([
    getCoordinadores().catch((e: Error) => { console.error('getCoordinadores:', e.message); return [] as Coordinador[] }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] }),
    getSupervisores().catch((e: Error) => { console.error('getSupervisores:', e.message); return [] }),
    getPermisosDetalle(PERMISOS.COO_CAT),
  ])

  return (
    <CoordinadoresClient
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
