import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getManzanas } from '@/app/actions/manzanas'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { FasesClient } from './_client'

export default async function FasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Awaited<ReturnType<typeof getFases>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  let manzanas: Awaited<ReturnType<typeof getManzanas>> = []
  let permisos = { consultar: true, agregar: true, modificar: true, eliminar: true }
  try {
    ;[data, proyectos, empresas, manzanas, permisos] = await Promise.all([
      getFases(), getProyectos(), getEmpresas(), getManzanas(), getPermisosDetalle(PERMISOS.FAS_CAT),
    ])
  } catch {
    // schema not yet exposed
  }
  return <FasesClient initialData={data} proyectos={proyectos} empresas={empresas} manzanas={manzanas} puedeEliminar={permisos.eliminar} userId={user?.id ?? ''} />
}
