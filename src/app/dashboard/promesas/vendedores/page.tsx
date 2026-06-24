import { getVendedores } from '@/app/actions/vendedores'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getCoordinadores } from '@/app/actions/coordinadores'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { VendedoresClient } from './_client'

export default async function VendedoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, coordinadores, permisos] = await Promise.all([
    getVendedores().catch((e: Error) => { console.error('getVendedores:', e.message); return [] as Awaited<ReturnType<typeof getVendedores>> }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getCoordinadores().catch((e: Error) => { console.error('getCoordinadores:', e.message); return [] as Awaited<ReturnType<typeof getCoordinadores>> }),
    getPermisosDetalle(PERMISOS.VEN_CAT),
  ])

  return (
    <VendedoresClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      coordinadores={coordinadores}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
