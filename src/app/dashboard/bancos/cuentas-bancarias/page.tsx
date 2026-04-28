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

  let data: Awaited<ReturnType<typeof getCuentasBancarias>> = []
  let empresas: Awaited<ReturnType<typeof getEmpresas>> = []
  let proyectos: Awaited<ReturnType<typeof getProyectos>> = []
  let bancos: Awaited<ReturnType<typeof getBancos>> = []
  let monedas: Awaited<ReturnType<typeof getMonedas>> = []
  let permisos = { consultar: true, agregar: true, modificar: true, eliminar: true }

  try {
    ;[data, empresas, proyectos, bancos, monedas, permisos] = await Promise.all([
      getCuentasBancarias(),
      getEmpresas(),
      getProyectos(),
      getBancos(),
      getMonedas(),
      getPermisosDetalle(PERMISOS.CUE_BAN),
    ])
  } catch {
    // schema not yet exposed
  }

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
