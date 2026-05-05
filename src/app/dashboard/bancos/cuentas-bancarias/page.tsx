import { getCuentasBancarias, getMonedas } from '@/app/actions/cuentas-bancarias'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos } from '@/app/actions/proyectos'
import { getBancos } from '@/app/actions/bancos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { CuentasBancariasClient } from './_client'

export default async function CuentasBancariasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, empresas, proyectos, bancos, monedas, permisos] = await Promise.all([
    getCuentasBancarias().catch((e: Error) => { console.error('getCuentasBancarias:', e.message); return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Awaited<ReturnType<typeof getEmpresas>> }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Awaited<ReturnType<typeof getProyectos>> }),
    getBancos().catch((e: Error) => { console.error('getBancos:', e.message); return [] as Awaited<ReturnType<typeof getBancos>> }),
    getMonedas().catch((e: Error) => { console.error('getMonedas:', e.message); return [] as Awaited<ReturnType<typeof getMonedas>> }),
    getPermisosDetalle(PERMISOS.CUE_BAN).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <CuentasBancariasClient
      initialData={data}
      empresas={empresas}
      proyectos={proyectos}
      bancos={bancos}
      monedas={monedas}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
