// Tipos para la pantalla Pago Cuotas.
// Registra pagos de un cliente sobre el plan de pagos de su Promesa,
// mapeando (en una fase futura) a cartera.t_recibo_caja + t_detalle_recibo_caja.

// ─── Identificacion de Promesa ──────────────────────────────────────────────

export type PromesaBusqueda = {
  empresa:        number
  proyecto:       number
  numero:         number
  referencia:     string
  fecha:          string   // YYYY-MM-DD
  cliente_codigo: number
  cliente_nombre: string
  fase:           number
  manzana:        string
  lote:           string
  moneda:         string   // moneda con la que se creo la promesa
}

// ─── Cuotas pendientes (Plan de Pago filtrado a estado <> 2) ───────────────

export type CuotaOtroSaldo = {
  codigo:   number
  etiqueta: string
  saldo:    number
}

export type CuotaPendiente = {
  tipo_cuota:  number   // 1 = Enganche, 2 = Financiamiento
  cuota:       number
  fecha:       string
  saldo_cuota: number   // (capital - capital_pagado) + (interes - interes_pagado)
  otros:       CuotaOtroSaldo[]
  saldo_mora:  number   // mora - mora_pagado
  saldo_total: number   // saldo_cuota + suma(otros) + saldo_mora
  // Control de concurrencia optimista (t_plan_pago.fecha_modifico) — se carga
  // de forma invisible junto con la cuota y viaja con el pago al grabar el
  // recibo; nunca se muestra en la UI.
  fecha_modifico: string
}

export type PlanPagoPendiente = {
  cuotas:        CuotaPendiente[]
  otrosColumnas: { codigo: number; etiqueta: string }[]
}

// ─── Grabado del recibo (Paso 1-4) ──────────────────────────────────────────

export type RegistrarPagoCuotasPayload = {
  empresa:            number
  proyecto:           number
  promesa:            number
  serie:              string
  numero:             number   // ignorado por el servidor si la serie es automatica
  fecha:              string   // YYYY-MM-DD
  cobrador:           number
  forma_pago:         number
  banco:              number
  numero_cuenta:      string
  numero_documento:   string
  cuenta_bancaria:    number
  moneda:             string
  // Tasa de cambio resuelta y desplegada por la pantalla (moneda seleccionada
  // contra la moneda predeterminada del proyecto). Se graba tal cual — el
  // servidor NO la vuelve a calcular, para garantizar que el recibo y las
  // cuotas se afecten exactamente con la tasa que el usuario vio en pantalla.
  tasa_cambio:        number
  monto:              number
  cliente_nombre:     string
  // Set completo de cuotas pendientes que la pantalla tenia cargadas al
  // momento de grabar — usado para la validacion de concurrencia optimista
  // (fecha_modifico) de TODO el Plan de Pagos, no solo de las cuotas afectadas.
  cuotas: Array<{
    tipo_cuota:     number
    cuota:          number
    fecha_modifico: string
  }>
}
