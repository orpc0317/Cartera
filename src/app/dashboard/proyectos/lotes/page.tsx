import { getLotes } from '@/app/actions/lotes'
import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { createClient } from '@/lib/supabase/server'
import { LotesClient } from './_client'

export default async function LotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Awaited<ReturnType<typeof getLotes>> = []
  let manzanas: Awaited<ReturnType<typeof getManzanas>> = []
  let fases: Awaited<ReturnType<typeof getFases>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  try {
    ;[data, manzanas, fases, proyectos, empresas] = await Promise.all([
      getLotes(), getManzanas(), getFases(), getProyectos(), getEmpresas(),
    ])
  } catch {
    // schema not yet exposed
  }
  return (
    <LotesClient
      initialData={data}
      manzanas={manzanas}
      fases={fases}
      proyectos={proyectos}
      empresas={empresas}
      userId={user?.id ?? ''}
    />
  )
}
