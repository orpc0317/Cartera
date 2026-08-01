import { getRecibosCaja } from '@/app/actions/pagos'
import { getEmpresasUsuario } from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getClientes } from '@/app/actions/clientes'
import { getCobradores } from '@/app/actions/cobradores'
import { getBancos } from '@/app/actions/bancos'
import { getCuentasBancarias } from '@/app/actions/cuentas-bancarias'
import { getSeriesRecibos } from '@/app/actions/series-recibos'
import { createClient } from '@/lib/supabase/server'
import { PagosClient } from './_client'

export default async function PagosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Default explicito: recibos grabados hoy (agrego_fecha). Se manda como si el
  // usuario ya lo hubiera tecleado en el panel de filtros (mismo valor que el
  // cliente precarga en su estado inicial) — evita traer el historico completo
  // en la primera carga de una tabla que puede acumular cientos de miles de filas.
  const hoy = new Date().toISOString().slice(0, 10)

  const [
    recibos, empresas, proyectos, clientes, cobradores, bancos, cuentasBancarias, seriesRecibos,
  ] = await Promise.all([
    getRecibosCaja({ agregoDesde: hoy }).catch((e: Error)  => { console.error('getRecibosCaja:', e.message);          return { data: [], limitReached: false } as Awaited<ReturnType<typeof getRecibosCaja>> }),
    getEmpresasUsuario().catch((e: Error)         => { console.error('getEmpresasUsuario:', e.message);      return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error)        => { console.error('getProyectosUsuario:', e.message);     return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getClientes().catch((e: Error)                => { console.error('getClientes:', e.message);            return [] as Awaited<ReturnType<typeof getClientes>> }),
    getCobradores().catch((e: Error)               => { console.error('getCobradores:', e.message);          return [] as Awaited<ReturnType<typeof getCobradores>> }),
    getBancos().catch((e: Error)                   => { console.error('getBancos:', e.message);              return [] as Awaited<ReturnType<typeof getBancos>> }),
    getCuentasBancarias().catch((e: Error)         => { console.error('getCuentasBancarias:', e.message);    return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getSeriesRecibos().catch((e: Error)            => { console.error('getSeriesRecibos:', e.message);       return [] as Awaited<ReturnType<typeof getSeriesRecibos>> }),
  ])

  return (
    <PagosClient
      initialData={recibos.data}
      initialLimitReached={recibos.limitReached}
      empresas={empresas}
      proyectos={proyectos}
      clientes={clientes}
      cobradores={cobradores}
      bancos={bancos}
      cuentasBancarias={cuentasBancarias}
      seriesRecibos={seriesRecibos}
      userId={user?.id ?? ''}
    />
  )
}
