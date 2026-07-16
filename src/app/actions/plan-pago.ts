'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCuentaActiva } from '@/app/actions/permisos'
import type { PlanPagoCuota, PlanOtroCuota, PlanOtroColumna, PlanPagoData } from '@/lib/types/plan-pago'

// ─── Lectura ───────────────────────────────────────────────────────────────

export async function getPlanPago(
  empresa: number,
  proyecto: number,
  promesa: number,
): Promise<PlanPagoData> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()

  const [cuotasRes, promesaOtrosRes] = await Promise.all([
    admin
      .schema('cartera')
      .from('t_plan_pago')
      .select('tipo_cuota, cuota, fecha, capital, capital_pagado, interes, interes_pagado, mora, mora_pagado, estado, fecha_modifico')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('promesa', promesa)
      .order('tipo_cuota')
      .order('cuota'),
    admin
      .schema('cartera')
      .from('t_promesa_otros')
      .select('secuencia, tipo_otros')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('promesa', promesa)
      .order('secuencia'),
  ])
  if (cuotasRes.error) throw new Error(cuotasRes.error.message)
  if (promesaOtrosRes.error) throw new Error(promesaOtrosRes.error.message)

  const promesaOtros = promesaOtrosRes.data ?? []
  const cuotas = (cuotasRes.data ?? []) as PlanPagoCuota[]

  if (promesaOtros.length === 0) {
    return { cuotas, otrosColumnas: [], otros: [] }
  }

  const secuenciaToTipo = new Map(promesaOtros.map((r) => [r.secuencia, r.tipo_otros]))
  const tiposOtros = [...new Set(promesaOtros.map((r) => r.tipo_otros))]

  const [tipoIngresoRes, planOtrosRes] = await Promise.all([
    admin
      .schema('cartera')
      .from('t_tipo_ingreso')
      .select('codigo, etiqueta')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .in('codigo', tiposOtros),
    admin
      .schema('cartera')
      .from('t_plan_otros')
      .select('tipo_cuota, cuota, secuencia, monto, monto_pagado')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('promesa', promesa),
  ])
  if (tipoIngresoRes.error) throw new Error(tipoIngresoRes.error.message)
  if (planOtrosRes.error) throw new Error(planOtrosRes.error.message)

  const etiquetaMap = new Map((tipoIngresoRes.data ?? []).map((t) => [t.codigo, t.etiqueta]))

  const otros: PlanOtroCuota[] = (planOtrosRes.data ?? []).map((r) => ({
    tipo_cuota: r.tipo_cuota,
    cuota: r.cuota,
    tipo_otros: secuenciaToTipo.get(r.secuencia) ?? 0,
    monto: r.monto,
    monto_pagado: r.monto_pagado,
  }))

  // Columnas ordenadas por secuencia (orden en que se agregaron en la promesa), sin duplicados
  const seen = new Set<number>()
  const otrosColumnas: PlanOtroColumna[] = []
  for (const po of promesaOtros) {
    if (seen.has(po.tipo_otros)) continue
    seen.add(po.tipo_otros)
    otrosColumnas.push({ codigo: po.tipo_otros, etiqueta: etiquetaMap.get(po.tipo_otros) ?? `#${po.tipo_otros}` })
  }

  return { cuotas, otrosColumnas, otros }
}
