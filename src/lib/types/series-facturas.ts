export type SerieFactura = {
  cuenta: string
  empresa: number
  proyecto: number
  serie: string
  gface: number
  id_docto_gface: string | null
  establecimiento: number
  dispositivo: number
  carpeta_dtes: string | null
  formato: number
  predeterminado: number
  activo: number
  agrego_usuario: string
  agrego_fecha: string
  modifico_usuario: string
  modifico_fecha: string
}

export type SerieFacturaForm = {
  empresa: number
  proyecto: number
  serie: string
  gface: number
  id_docto_gface: string | null
  establecimiento: number
  dispositivo: number
  carpeta_dtes: string | null
  formato: number
  predeterminado: number
  activo: number
}
