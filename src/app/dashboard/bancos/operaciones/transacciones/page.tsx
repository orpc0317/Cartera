import { getTransaccionesBancarias } from '@/app/actions/transacciones-bancarias'
import { getCuentasBancarias } from '@/app/actions/cuentas-bancarias'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getBancos } from '@/app/actions/bancos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS, PERMISOS_CERRADOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { TransaccionesBancariasClient } from './_client'

export default async function TransaccionesBancariasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const fecha = new Date()
  fecha.setUTCDate(fecha.getUTCDate() - 30)
  const fechaDesde = fecha.toISOString().slice(0, 10)

  const [data, empresas, proyectos, cuentasBancarias, bancos, permisos] = await Promise.all([
    getTransaccionesBancarias({ fechaDesde }).catch((e: Error) => { console.error('getTransaccionesBancarias:', e.message); return { data: [], limitReached: false } as Awaited<ReturnType<typeof getTransaccionesBancarias>> }),
    getEmpresasUsuario().catch((e: Error)          => { console.error('getEmpresasUsuario:', e.message);          return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error)          => { console.error('getProyectosUsuario:', e.message);         return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getCuentasBancarias().catch((e: Error)          => { console.error('getCuentasBancarias:', e.message);         return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getBancos().catch((e: Error)                    => { console.error('getBancos:', e.message);                   return [] as Awaited<ReturnType<typeof getBancos>> }),
    getPermisosDetalle(PERMISOS.TRX_BAN).catch((e: Error) => { console.error('getPermisosDetalle:', e.message); return PERMISOS_CERRADOS }),
  ])

  return (
    <TransaccionesBancariasClient
      initialData={data.data}
      initialLimitReached={data.limitReached}
      initialFechaDesde={fechaDesde}
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
