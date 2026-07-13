import { getTiposDocumento } from '@/app/actions/tipos-documento'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { TiposDocumentoClient } from './_client'

export default async function TiposDocumentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tiposDocumento, empresas, proyectos, permisos] = await Promise.all([
    getTiposDocumento().catch((e: Error) => { console.error('getTiposDocumento:', e.message); return [] as Awaited<ReturnType<typeof getTiposDocumento>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getPermisosDetalle(PERMISOS.TDO_CAT).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <TiposDocumentoClient
      initialData={tiposDocumento}
      empresas={empresas}
      proyectos={proyectos}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
