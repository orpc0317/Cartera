import { getBancos } from '@/app/actions/bancos'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { BancosClient } from './_client'

export default async function BancosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Awaited<ReturnType<typeof getBancos>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let permisos = { consultar: true, agregar: true, modificar: true, eliminar: true }
  try {
    ;[data, empresas, proyectos, permisos] = await Promise.all([
      getBancos(), getEmpresas(), getProyectos(), getPermisosDetalle(PERMISOS.BAN_CAT),
    ])
  } catch {
    // schema not yet exposed
  }
  return (
    <BancosClient
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
