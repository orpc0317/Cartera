// Tipos para el módulo Tipos de Ingresos, mapeados a cartera.t_tipo_ingreso

export type TipoIngreso = {
  cuenta: string
  empresa: number
  proyecto: number
  codigo: number
  nombre: string
  etiqueta: string
  forma_pago: number
  monto: number
  moneda: string
  hasta_monto: number
  factura_item: string | null
  factura_descripcion: string | null
  mora: number
  impuesto: number
  editable: number
  fijo: number
  activo: number
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type TipoIngresoForm = {
  empresa: number
  proyecto: number
  nombre: string
  etiqueta: string
  forma_pago: number
  moneda: string
  monto: number
  hasta_monto: number
  factura_item: string
  factura_descripcion: string
  mora: number
  impuesto: number
  editable: number
  activo: number
}
