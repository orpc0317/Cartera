// Tipos para documentos adjuntos de una Promesa, mapeados a cartera.t_promesa_documentos

export type PromesaDocumento = {
  cuenta: string
  empresa: number
  proyecto: number
  promesa: number
  secuencia: number
  tipo_documento: number
  archivo_path: string
  nombre_archivo: string
  tamano: number
  agrego_usuario?: string
  agrego_fecha?: string
}
