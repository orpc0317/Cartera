import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { ManzanasClient } from './_client'

export default async function ManzanasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [manzanas, fases, proyectos, empresas, permisos] = await Promise.all([
    getManzanas().catch((e: Error) => { console.error('getManzanas:', e.message); return [] as Awaited<ReturnType<typeof getManzanas>> }),
    getFases().catch((e: Error) => { console.error('getFases:', e.message); return [] as Awaited<ReturnType<typeof getFases>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getPermisosDetalle(PERMISOS.MAN_CAT).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <ManzanasClient
      manzanas={manzanas}
      fases={fases}
      proyectos={proyectos}
      empresas={empresas}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
