// Tipos para la pantalla Mantenimiento Pagos (solo lectura)
// Mapeados a cartera.t_recibo_caja / cartera.t_detalle_recibo_caja

export type ReciboCaja = {
  cuenta:                string
  empresa:               number
  proyecto:              number
  serie:                 string
  numero:                number
  fecha:                 string
  promesa:               number
  reserva:               number
  cliente:               number
  fase:                  number
  manzana:               string | null
  lote:                  string | null
  forma_pago:            number   // 1=Efectivo 2=Cheque 3=Deposito 4=Transferencia
  banco:                 number
  numero_cuenta:         string | null
  numero_documento:      string | null
  cuenta_deposito:       number
  transaccion_bancaria:  string | null
  cobrador:              number
  moneda:                string
  tasa_cambio:           number
  monto:                 number
  mora:                  number
  abono_capital:         number
  tipo_ingreso:          number
  factura_serie:         string | null
  factura_numero:        number
  observaciones:         string | null
  estado:                number
  agrego_usuario:        string
  agrego_fecha:          string
  modifico_usuario:      string
  modifico_fecha:        string
}

export type DetalleReciboCaja = {
  cuenta:        string
  empresa:       number
  proyecto:      number
  serie_recibo:  string
  recibo:        number
  fecha_cuota:   string
  tipo_cuota:    number   // 1=Enganche 2=Financiamiento
  cuota:         number
  capital:       number
  intereses:     number
  mora:          number
  otros:         number
}

// Fila de cartera.t_detalle_recibo_otros ya resuelta contra t_tipo_ingreso
// (mismo patron que PlanOtroCuota en lib/types/plan-pago.ts)
export type DetalleReciboOtro = {
  tipo_cuota: number
  cuota:      number
  tipo_otros: number
  monto:      number
}

// Columna dinamica de Otros Ingresos (una por cada tipo_ingreso usado en el recibo)
export type ReciboOtroColumna = {
  codigo:   number
  etiqueta: string
}

export type PagosFiltros = {
  empresa?:          number
  proyecto?:         number
  fechaDesde?:       string   // fecha del recibo, YYYY-MM-DD
  fechaHasta?:       string
  agregoDesde?:      string   // fecha en que se grabo el recibo (agrego_fecha), YYYY-MM-DD
  agregoHasta?:      string
  promesa?:          number
  cliente?:          string   // texto libre, busca por nombre de cliente
  cuentaDeposito?:   number   // codigo de t_cuenta_bancaria
  formaPago?:        number
  numeroDocumento?:  string   // texto libre, busca por numero_documento
  serie?:            string
  numeroDesde?:      number   // rango de t_recibo_caja.numero
  numeroHasta?:      number
}

export type ReciboCajaDetalleExtra = {
  detalle:        DetalleReciboCaja[]
  otrosColumnas:  ReciboOtroColumna[]
  otros:          DetalleReciboOtro[]
  deposito: {
    numero_transaccion: string
    fecha:               string
    numero_documento:    string | null
    valor:                number
    tipo_transaccion:     number
  } | null
}
