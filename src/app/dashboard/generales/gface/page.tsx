import { getGfaces } from '@/app/actions/gface'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { GfaceClient } from './_client'

export default async function GfacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [gfaces, empresas, proyectos, permisos] = await Promise.all([
    getGfaces().catch((e: Error) => { console.error('getGfaces:', e.message); return [] as Awaited<ReturnType<typeof getGfaces>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getPermisosDetalle(PERMISOS.GFA_CAT).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <GfaceClient
      initialData={gfaces}
      empresas={empresas}
      proyectos={proyectos}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
