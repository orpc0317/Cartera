import { getLotes, getReservas } from '@/app/actions/lotes'
import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getClientes } from '@/app/actions/clientes'
import { getVendedores } from '@/app/actions/vendedores'
import { getCobradores } from '@/app/actions/cobradores'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { LotesClient } from './_client'

export default async function LotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, manzanas, fases, proyectos, empresas, reservas, clientes, vendedores, cobradores, permisos] = await Promise.all([
    getLotes().catch((e: Error)        => { console.error('getLotes:', e.message);        return [] as Awaited<ReturnType<typeof getLotes>>        }),
    getManzanas().catch((e: Error)     => { console.error('getManzanas:', e.message);     return [] as Awaited<ReturnType<typeof getManzanas>>     }),
    getFases().catch((e: Error)        => { console.error('getFases:', e.message);        return [] as Awaited<ReturnType<typeof getFases>>        }),
    getProyectos().catch((e: Error)    => { console.error('getProyectos:', e.message);    return [] as Awaited<ReturnType<typeof getProyectos>>    }),
    getEmpresas().catch((e: Error)     => { console.error('getEmpresas:', e.message);     return [] as Awaited<ReturnType<typeof getEmpresas>>     }),
    getReservas().catch((e: Error)     => { console.error('getReservas:', e.message);     return [] as Awaited<ReturnType<typeof getReservas>>     }),
    getClientes().catch((e: Error)     => { console.error('getClientes:', e.message);     return [] as Awaited<ReturnType<typeof getClientes>>     }),
    getVendedores().catch((e: Error)   => { console.error('getVendedores:', e.message);   return [] as Awaited<ReturnType<typeof getVendedores>>   }),
    getCobradores().catch((e: Error)   => { console.error('getCobradores:', e.message);   return [] as Awaited<ReturnType<typeof getCobradores>>   }),
    getPermisosDetalle(PERMISOS.LOT_CAT),
  ])

  return (
    <LotesClient
      initialData={data}
      manzanas={manzanas}
      fases={fases}
      proyectos={proyectos}
      empresas={empresas}
      reservas={reservas}
      clientes={clientes}
      vendedores={vendedores}
      cobradores={cobradores}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
