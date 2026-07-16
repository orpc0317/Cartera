import { getSeriesRecibos }                          from '@/app/actions/series-recibos'
import { getCobradores }                             from '@/app/actions/cobradores'
import { getProyectoMonedas, getProyectosUsuario }   from '@/app/actions/proyectos'
import { getTasasCambio }                            from '@/app/actions/tasas-cambio'
import { getEmpresasUsuario }                        from '@/app/actions/empresas'
import { getFases }                                  from '@/app/actions/fases'
import { getBancos }                                 from '@/app/actions/bancos'
import { getCuentasBancarias }                       from '@/app/actions/cuentas-bancarias'
import { getPermisosDetalle }                        from '@/app/actions/permisos'
import { PERMISOS }                                  from '@/lib/permisos'
import { PagoCuotasClient }                          from './_client'

export default async function PagoCuotasPage() {
  const [
    seriesRecibo, cobradores, proyectoMonedas, tasasCambio,
    empresas, proyectos, fases, bancos, cuentasBancarias, permisos,
  ] = await Promise.all([
    getSeriesRecibos().catch((e: Error)     => { console.error('getSeriesRecibos:', e.message);     return [] as Awaited<ReturnType<typeof getSeriesRecibos>> }),
    getCobradores().catch((e: Error)        => { console.error('getCobradores:', e.message);        return [] as Awaited<ReturnType<typeof getCobradores>> }),
    getProyectoMonedas().catch((e: Error)   => { console.error('getProyectoMonedas:', e.message);   return [] as Awaited<ReturnType<typeof getProyectoMonedas>> }),
    getTasasCambio().catch((e: Error)       => { console.error('getTasasCambio:', e.message);       return [] as Awaited<ReturnType<typeof getTasasCambio>> }),
    getEmpresasUsuario().catch((e: Error)   => { console.error('getEmpresasUsuario:', e.message);   return [] as Awaited<ReturnType<typeof getEmpresasUsuario>> }),
    getProyectosUsuario().catch((e: Error)  => { console.error('getProyectosUsuario:', e.message);  return [] as Awaited<ReturnType<typeof getProyectosUsuario>> }),
    getFases().catch((e: Error)             => { console.error('getFases:', e.message);             return [] as Awaited<ReturnType<typeof getFases>> }),
    getBancos().catch((e: Error)            => { console.error('getBancos:', e.message);            return [] as Awaited<ReturnType<typeof getBancos>> }),
    getCuentasBancarias().catch((e: Error)  => { console.error('getCuentasBancarias:', e.message);  return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getPermisosDetalle(PERMISOS.PAG_CUO).catch(() => ({ consultar: true, agregar: true, modificar: true, eliminar: true })),
  ])

  return (
    <PagoCuotasClient
      seriesRecibo={seriesRecibo}
      cobradores={cobradores}
      proyectoMonedas={proyectoMonedas}
      tasasCambio={tasasCambio}
      empresas={empresas}
      proyectos={proyectos}
      fases={fases}
      bancos={bancos}
      cuentasBancarias={cuentasBancarias}
      puedeAgregar={permisos.agregar}
    />
  )
}
