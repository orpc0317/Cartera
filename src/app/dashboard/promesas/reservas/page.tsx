import { getLotesDisponibles } from '@/app/actions/lotes'
import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getClientes } from '@/app/actions/clientes'
import { getBancos } from '@/app/actions/bancos'
import { getCuentasBancarias } from '@/app/actions/cuentas-bancarias'
import { getVendedores } from '@/app/actions/vendedores'
import { getCobradores } from '@/app/actions/cobradores'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { ReservasClient } from './_client'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [lotesDisponibles, manzanas, fases, proyectos, empresas, clientes, bancos, cuentasBancarias, vendedores, cobradores, permisos] = await Promise.all([
    getLotesDisponibles().catch((e: Error) => { console.error('getLotesDisponibles:', e.message); return [] as Awaited<ReturnType<typeof getLotesDisponibles>> }),
    getManzanas().catch((e: Error)         => { console.error('getManzanas:', e.message);         return [] as Awaited<ReturnType<typeof getManzanas>>         }),
    getFases().catch((e: Error)            => { console.error('getFases:', e.message);            return [] as Awaited<ReturnType<typeof getFases>>            }),
    getProyectos().catch((e: Error)        => { console.error('getProyectos:', e.message);        return [] as Awaited<ReturnType<typeof getProyectos>>        }),
    getEmpresas().catch((e: Error)         => { console.error('getEmpresas:', e.message);         return [] as Awaited<ReturnType<typeof getEmpresas>>         }),
    getClientes().catch((e: Error)         => { console.error('getClientes:', e.message);         return [] as Awaited<ReturnType<typeof getClientes>>         }),
    getBancos().catch((e: Error)           => { console.error('getBancos:', e.message);           return [] as Awaited<ReturnType<typeof getBancos>>           }),
    getCuentasBancarias().catch((e: Error) => { console.error('getCuentasBancarias:', e.message); return [] as Awaited<ReturnType<typeof getCuentasBancarias>> }),
    getVendedores().catch((e: Error)       => { console.error('getVendedores:', e.message);       return [] as Awaited<ReturnType<typeof getVendedores>>       }),
    getCobradores().catch((e: Error)       => { console.error('getCobradores:', e.message);       return [] as Awaited<ReturnType<typeof getCobradores>>       }),
    getPermisosDetalle(PERMISOS.RES_OPE),
  ])

  return (
    <ReservasClient
      lotesDisponibles={lotesDisponibles}
      manzanas={manzanas}
      fases={fases}
      proyectos={proyectos}
      empresas={empresas}
      clientes={clientes}
      bancos={bancos}
      cuentasBancarias={cuentasBancarias}
      vendedores={vendedores}
      cobradores={cobradores}
      puedeAgregar={permisos.agregar}
      userId={user?.id ?? ''}
    />
  )
}
