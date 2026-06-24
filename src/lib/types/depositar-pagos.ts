// Tipos para la pantalla Depositar Pagos
// Registra un depósito bancario agrupando recibos de caja pendientes de depositar.

export type ReciboDetalleItem = {
  cuenta:         string
  empresa:        number
  proyecto:       number
  serie:          string
  numero:         number
  fecha:          string   // YYYY-MM-DD (del recibo)
  cliente_codigo: number
  cliente_nombre: string
  forma_pago:     number   // 1=Efectivo 2=Cheque
  monto:          number
  moneda:         string
  tipo:           'Reserva' | 'Otros'
  reserva:        number
  fase?:          number
  fase_nombre?:   string
  manzana?:       string
  lote?:          string
}

export type DepositarPagosServerPayload = {
  empresa:          number
  proyecto:         number   // parte de la PK de t_cuenta_bancaria
  cuenta_bancaria:  number
  fecha:            string   // YYYY-MM-DD
  numero_documento: string
  recibos: Array<{
    cuenta:   string
    empresa:  number
    proyecto: number
    serie:    string
    numero:   number
    monto:    number
  }>
}
