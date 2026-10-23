// Catalogo de certificadores de documentos electronicos (cartera.t_gface)

export type Gface = {
  cuenta: string
  empresa: number
  proyecto: number
  codigo: number
  nombre: string
  requestor: string | null
  entity: string | null
  user_name: string | null
  token: string | null
  web_service: string | null
  web_service_documento: string | null
  certificado_post: string | null
  certificado_ruta: string | null
  certificado_nombre: string | null
  certificado_contrasena: string | null
  correo_envio: string | null
  correo_copia: string | null
  primera_firma: number
  validar_identificacion: number
  agrego_usuario: string
  agrego_fecha: string
  modifico_usuario: string
  modifico_fecha: string
}

export type GfaceForm = Omit<Gface, 'cuenta' | 'agrego_usuario' | 'agrego_fecha' | 'modifico_usuario' | 'modifico_fecha'>
