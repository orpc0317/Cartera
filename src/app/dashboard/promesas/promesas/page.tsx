import { getPromesas } from '@/app/actions/promesas'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getFases } from '@/app/actions/fases'
import { getManzanas } from '@/app/actions/manzanas'
import { getLotes } from '@/app/actions/lotes'
import { getClientes } from '@/app/actions/clientes'
import { getVendedores } from '@/app/actions/vendedores'
import { getTiposDocumento } from '@/app/actions/tipos-documento'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { createClient } from '@/lib/supabase/server'
import { PERMISOS } from '@/lib/permisos'
import { PromesasClient } from './_client'

export default async function PromesasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [promesas, empresas, proyectos, fases, manzanas, lotes, clientes, vendedores, tiposDocumento, permisos] = await Promise.all([
    getPromesas().catch((e: Error) => { console.error('getPromesas:', e.message); return [] }),
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] }),
    getFases().catch((e: Error) => { console.error('getFases:', e.message); return [] }),
    getManzanas().catch((e: Error) => { console.error('getManzanas:', e.message); return [] }),
    getLotes().catch((e: Error) => { console.error('getLotes:', e.message); return [] }),
    getClientes().catch((e: Error) => { console.error('getClientes:', e.message); return [] }),
    getVendedores().catch((e: Error) => { console.error('getVendedores:', e.message); return [] }),
    getTiposDocumento().catch((e: Error) => { console.error('getTiposDocumento:', e.message); return [] }),
    getPermisosDetalle(PERMISOS.PRE_OPE),
  ])

  return (
    <PromesasClient
      initialData={promesas}
      empresas={empresas}
      proyectos={proyectos}
      fases={fases}
      manzanas={manzanas}
      lotes={lotes}
      clientes={clientes}
      vendedores={vendedores}
      tiposDocumento={tiposDocumento}
      userId={user?.id ?? ''}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
    />
  )
}
