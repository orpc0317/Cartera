import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { createClient } from '@/lib/supabase/server'
import { FasesClient } from './_client'

export default async function FasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Awaited<ReturnType<typeof getFases>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  try {
    ;[data, proyectos, empresas] = await Promise.all([
      getFases(), getProyectos(), getEmpresas(),
    ])
  } catch {
    // schema not yet exposed
  }
  return <FasesClient initialData={data} proyectos={proyectos} empresas={empresas} userId={user?.id ?? ''} />
}
