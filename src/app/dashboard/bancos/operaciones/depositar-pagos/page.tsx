import { getEmpresasUsuario }  from '@/app/actions/empresas'
import { getProyectosUsuario } from '@/app/actions/proyectos'
import { getCuentasBancarias } from '@/app/actions/cuentas-bancarias'
import { getSeriesRecibos }    from '@/app/actions/series-recibos'
import { getBancos }           from '@/app/actions/bancos'
import { getPermisosDetalle }  from '@/app/actions/permisos'
import { PERMISOS, PERMISOS_CERRADOS } from '@/lib/permisos'
import { DepositarPagosClient } from './_client'

export default async function DepositarPagosPage() {
  const [empresas, proyectos, cuentasBancarias, seriesRecibo, bancos, permisos] = await Promise.all([
    getEmpresasUsuario().catch((e: Error) => { console.error('getEmpresasUsuario:', e.message); return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error) => { console.error('getProyectosUsuario:', e.message); return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getCuentasBancarias().catch((e: Error) => { console.error('getCuentasBancarias:', e.message); return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getSeriesRecibos().catch((e: Error) => { console.error('getSeriesRecibos:', e.message); return [] as Awaited<ReturnType<typeof getSeriesRecibos>> }),
    getBancos().catch((e: Error) => { console.error('getBancos:', e.message); return [] as Awaited<ReturnType<typeof getBancos>> }),
    getPermisosDetalle(PERMISOS.DEP_BAN).catch((e: Error) => { console.error('getPermisosDetalle:', e.message); return PERMISOS_CERRADOS }),
  ])

  return (
    <DepositarPagosClient
      empresas={empresas}
      proyectos={proyectos}
      cuentasBancarias={cuentasBancarias}
      seriesRecibo={seriesRecibo}
      bancos={bancos}
      puedeAgregar={permisos.agregar}
    />
  )
}
