export type TasaCambio = {
  cuenta: string
  empresa: number
  proyecto: number
  moneda: string
  fecha: string        // YYYY-MM-DD
  tasa_cambio: number  // numeric(18,8)
  agrego_usuario: string
  agrego_fecha: string
}

export type TasaCambioForm = {
  empresa: number
  proyecto: number
  moneda: string
  fecha: string
  tasa_cambio: number | ''
}

/** View-model only — not persisted. One entry per (empresa, proyecto, moneda) showing latest tasa. */
export type TasaCambioGrupo = {
  empresa: number
  proyecto: number
  moneda: string
  ultima_fecha: string
  ultima_tasa: number
}
