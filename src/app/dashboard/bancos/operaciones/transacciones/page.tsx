import { getTransaccionesBancarias } from '@/app/actions/transacciones-bancarias'
import { getCuentasBancarias } from '@/app/actions/cuentas-bancarias'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getBancos } from '@/app/actions/bancos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { TransaccionesBancariasClient } from './_client'

export default async function TransaccionesBancariasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, cuentasBancarias, bancos, permisos] = await Promise.all([
    getTransaccionesBancarias().catch((e: Error) => { console.error('getTransaccionesBancarias:', e.message); return [] as Awaited<ReturnType<typeof getTransaccionesBancarias>> }),
    getEmpresasUsuario().catch((e: Error)          => { console.error('getEmpresasUsuario:', e.message);          return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error)          => { console.error('getProyectosUsuario:', e.message);         return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getCuentasBancarias().catch((e: Error)          => { console.error('getCuentasBancarias:', e.message);         return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getBancos().catch((e: Error)                    => { console.error('getBancos:', e.message);                   return [] as Awaited<ReturnType<typeof getBancos>> }),
    getPermisosDetalle(PERMISOS.TRX_BAN).catch(() => ({ consultar: true, agregar: false, modificar: false, eliminar: false })),
  ])

  return (
    <TransaccionesBancariasClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      cuentasBancarias={cuentasBancarias}
      bancos={bancos}
      puedeAnular={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
