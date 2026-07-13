// Tipos para el catalogo Tipos Documento (modulo Generales), mapeados a cartera.t_tipo_documento

export type TipoDocumento = {
  cuenta: string
  empresa: number
  proyecto: number
  codigo: number
  descripcion: string
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type TipoDocumentoForm = {
  empresa: number
  proyecto: number
  descripcion: string
}
