// Tipos para el detalle de "Otros Ingresos" asociados a una Promesa,
// mapeados a cartera.t_promesa_otros

export type PromesaOtro = {
  cuenta: string
  empresa: number
  proyecto: number
  promesa: number
  secuencia: number
  tipo_otros: number
  monto: number
  hasta_monto: number
  mora: number
  partir_de: string
  aplicar_hasta: string
}

// Payload enviado al servidor al grabar la promesa (crear o actualizar) —
// el servidor reemplaza por completo el detalle (delete-then-insert) y
// asigna la secuencia segun el orden del arreglo.
export type PromesaOtroPayload = {
  tipo_otros: number
  monto: number
  hasta_monto: number
  mora: number
  partir_de: string
  aplicar_hasta: string
}
