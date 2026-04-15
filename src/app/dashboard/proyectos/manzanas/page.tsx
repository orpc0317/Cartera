import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { createClient } from '@/lib/supabase/server'
import { ManzanasClient } from './_client'

export default async function ManzanasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Awaited<ReturnType<typeof getManzanas>> = []
  let fases: Awaited<ReturnType<typeof getFases>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  try {
    ;[data, fases, proyectos, empresas] = await Promise.all([
      getManzanas(), getFases(), getProyectos(), getEmpresas(),
    ])
  } catch {
    // schema not yet exposed
  }
  return <ManzanasClient initialData={data} fases={fases} proyectos={proyectos} empresas={empresas} userId={user?.id ?? ''} />
}
