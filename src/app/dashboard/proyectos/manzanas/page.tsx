import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getLotes } from '@/app/actions/lotes'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { ManzanasClient } from './_client'

export default async function ManzanasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Awaited<ReturnType<typeof getManzanas>> = []
  let fases: Awaited<ReturnType<typeof getFases>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  let lotes: Awaited<ReturnType<typeof getLotes>> = []
  let permisos = { consultar: true, agregar: true, modificar: true, eliminar: true }
  try {
    ;[data, fases, proyectos, empresas, lotes, permisos] = await Promise.all([
      getManzanas(), getFases(), getProyectos(), getEmpresas(), getLotes(), getPermisosDetalle(PERMISOS.MAN_CAT),
    ])
  } catch {
    // schema not yet exposed
  }
  return <ManzanasClient initialData={data} fases={fases} proyectos={proyectos} empresas={empresas} lotes={lotes} puedeEliminar={permisos.eliminar} userId={user?.id ?? ''} />
}
