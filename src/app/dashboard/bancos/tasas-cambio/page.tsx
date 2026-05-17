import { getTasasCambio } from '@/app/actions/tasas-cambio'
import { getEmpresas } from '@/app/actions/empresas'
import { getProyectos, getProyectoMonedas } from '@/app/actions/proyectos'
import { getPermisosDetalle } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import TasasCambioClient from './_client'
import type { TasaCambio } from '@/lib/types/tasas-cambio'
import type { Empresa, Proyecto, ProyectoMoneda } from '@/lib/types/proyectos'

export default async function TasasCambioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tasas, empresas, proyectos, proyectoMonedas, permisos] = await Promise.all([
    getTasasCambio().catch((e: Error) => { console.error('getTasasCambio:', e.message); return [] as TasaCambio[] }),
    getEmpresas().catch((e: Error) => { console.error('getEmpresas:', e.message); return [] as Empresa[] }),
    getProyectos().catch((e: Error) => { console.error('getProyectos:', e.message); return [] as Proyecto[] }),
    getProyectoMonedas().catch((e: Error) => { console.error('getProyectoMonedas:', e.message); return [] as ProyectoMoneda[] }),
    getPermisosDetalle(PERMISOS.TSC_CAT),
  ])

  return (
    <TasasCambioClient
      tasas={tasas}
      empresas={empresas}
      proyectos={proyectos}
      proyectoMonedas={proyectoMonedas}
      puedeAgregar={permisos.agregar}
      puedeEliminar={permisos.eliminar}
      userId={user?.id ?? ''}
    />
  )
}
