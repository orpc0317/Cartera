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

  const [data, fases, proyectos, empresas, lotes, permisos] = await Promise.all([
    getManzanas().catch((e: Error) => { console.error('getManzanas:', e.message); return [] as Awaited<ReturnType<typeof getManzanas>> }),
    getFases().catch((e: Error) => { console.error('getFases:', e.message); return [] as Awaited<ReturnType<typeof getFases>> }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Awaited<ReturnType<typeof getProyectos>> }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Awaited<ReturnType<typeof getEmpresas>> }),
    getLotes().catch((e: Error) => { console.error('getLotes:', e.message); return [] as Awaited<ReturnType<typeof getLotes>> }),
    getPermisosDetalle(PERMISOS.MAN_CAT).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])
  return <ManzanasClient initialData={data} fases={fases} proyectos={proyectos} empresas={empresas} lotes={lotes} puedeEliminar={permisos.eliminar} userId={user?.id ?? ''} />
}
