'use server'

import { clienteDatos } from '@/lib/supabase/datos'
import { getCuentaActiva, exigirProyecto } from '@/app/actions/permisos'
import type { PromesaOtro } from '@/lib/types/promesa-otros'

// ─── Lectura ───────────────────────────────────────────────────────────────

export async function getPromesaOtros(
  empresa: number,
  proyecto: number,
  promesa: number,
): Promise<PromesaOtro[]> {
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return []
  const cuenta = await getCuentaActiva()
  const admin = await clienteDatos()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_promesa_otros')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', promesa)
    .order('secuencia')
  if (error) throw new Error(error.message)
  return (data ?? []) as PromesaOtro[]
}
