// Tipos para el módulo Promesas, mapeados a cartera.t_promesa

export type Promesa = {
  cuenta: string
  empresa: number
  proyecto: number
  numero: number
  referencia: string
  fecha: string
  cliente: number
  vendedor: number
  fase: number
  manzana: string
  lote: string
  moneda: string
  valor_lote: number
  subsidio: number
  arras: number
  monto_enganche: number
  primer_enganche: number
  plazo_enganche: number
  interes_anual: number
  forma_mora: number
  interes_mora: number
  fijo_mora: number
  mora_enganche: number
  dias_gracia: number
  dias_afecto: number
  forma_financiamiento: number
  fecha_financiamiento: string | null
  monto_financiamiento: number
  plazo_financiamiento: number
  fecha_cancelacion: string | null
  venta: number
  observacion: string
  estado: number
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type PromesaForm = {
  empresa: number
  proyecto: number
  numero: number
  referencia: string
  fecha: string
  cliente: number
  vendedor: number
  fase: number
  manzana: string
  lote: string
  moneda: string
  valor_lote: number
  subsidio: number
  arras: number
  monto_enganche: number
  primer_enganche: number
  plazo_enganche: number
  interes_anual: number
  forma_mora: number
  interes_mora: number
  fijo_mora: number
  mora_enganche: number
  dias_gracia: number
  dias_afecto: number
  forma_financiamiento: number
  fecha_financiamiento: string | null
  monto_financiamiento: number
  plazo_financiamiento: number
  fecha_cancelacion: string | null
  venta: number
  observacion: string
  estado: number
}
