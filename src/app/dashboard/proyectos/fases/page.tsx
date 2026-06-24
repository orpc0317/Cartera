import { getFases } from '@/app/actions/fases'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { FasesClient } from './_client'

export default async function FasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [fases, empresas, proyectos, permisos] = await Promise.all([
    getFases().catch((e: Error) => { console.error('getFases:', e.message); return [] as Awaited<ReturnType<typeof getFases>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getPermisosDetalle(PERMISOS.FAS_CAT).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <FasesClient
      initialData={fases}
      empresas={empresas}
      proyectos={proyectos}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
