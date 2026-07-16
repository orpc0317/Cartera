// Tipos para el Plan de Pagos de una Promesa, mapeados a
// cartera.t_plan_pago (cuotas de capital/interes/mora) y
// cartera.t_plan_otros (otros ingresos por cuota, pivotados por tipo_ingreso.etiqueta)

export type PlanPagoCuota = {
  tipo_cuota: number // 1 = Enganche, 2 = Financiamiento
  cuota: number
  fecha: string
  capital: number
  capital_pagado: number
  interes: number
  interes_pagado: number
  mora: number
  mora_pagado: number
  estado: number // 0 Corriente, 1 Atrasada, 2 Pagada, 3 Pendiente
  fecha_modifico: string // control de concurrencia optimista (no se muestra en UI)
}

// Un "otro ingreso" ya resuelto contra t_tipo_ingreso, para una cuota especifica
export type PlanOtroCuota = {
  tipo_cuota: number
  cuota: number
  tipo_otros: number
  monto: number
  monto_pagado: number
}

// Columna dinamica de Otros Ingresos (una por cada tipo_ingreso distinto usado en la promesa)
export type PlanOtroColumna = {
  codigo: number
  etiqueta: string
}

export type PlanPagoData = {
  cuotas: PlanPagoCuota[]
  otrosColumnas: PlanOtroColumna[]
  otros: PlanOtroCuota[]
}
