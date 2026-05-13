import { getLotes } from '@/app/actions/lotes'
import { getManzanas } from '@/app/actions/manzanas'
import { getFases } from '@/app/actions/fases'
import { getProyectos } from '@/app/actions/proyectos'
import { getEmpresas } from '@/app/actions/empresas'
import { getMonedas } from '@/app/actions/geo'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { LotesClient } from './_client'

export default async function LotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [data, manzanas, fases, proyectos, empresas, monedas, permisos] = await Promise.all([
    getLotes().catch((e: Error)      => { console.error('getLotes:', e.message);      return [] as Awaited<ReturnType<typeof getLotes>>      }),
    getManzanas().catch((e: Error)   => { console.error('getManzanas:', e.message);   return [] as Awaited<ReturnType<typeof getManzanas>>   }),
    getFases().catch((e: Error)      => { console.error('getFases:', e.message);      return [] as Awaited<ReturnType<typeof getFases>>      }),
    getProyectos().catch((e: Error)  => { console.error('getProyectos:', e.message);  return [] as Awaited<ReturnType<typeof getProyectos>>  }),
    getEmpresas().catch((e: Error)   => { console.error('getEmpresas:', e.message);   return [] as Awaited<ReturnType<typeof getEmpresas>>   }),
    getMonedas().catch((e: Error)    => { console.error('getMonedas:', e.message);    return [] as Awaited<ReturnType<typeof getMonedas>>    }),
    getPermisosDetalle(PERMISOS.LOT_CAT),
  ])

  return (
    <LotesClient
      initialData={data}
      manzanas={manzanas}
      fases={fases}
      proyectos={proyectos}
      empresas={empresas}
      monedas={monedas}
      puedeAgregar={permisos.agregar}
      puedeModificar={permisos.modificar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
