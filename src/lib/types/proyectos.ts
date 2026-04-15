// Tipos para el módulo Proyectos, mapeados a las tablas en schema cartera

export type Empresa = {
  cuenta: string
  codigo: number
  nombre: string
  razon_social: string
  identificaion_tributaria: string  // typo original en DB
  pais: string
  departamento: string
  municipio: string
  direccion: string
  codigo_postal: string
  regimen_isr: number
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type EmpresaForm = Omit<Empresa, 'cuenta' | 'agrego_usuario' | 'agrego_fecha' | 'modifico_usuario' | 'modifico_fecha'>

export type Proyecto = {
  cuenta: string
  empresa: number
  codigo: number
  nombre: string
  moneda: string
  pais: string
  departamento: string
  municipio: string
  direccion: string
  codigo_postal: string
  telefono1: string
  telefono2?: string
  mora_automatica: number
  fijar_parametros_mora: number
  forma_mora: number
  interes_mora: number
  fijo_mora: number
  mora_enganche: number
  dias_gracia: number
  dias_afectos: number
  inicio_calculo_mora: string
  calcular_mora_antes: number
  minimo_mora: number
  minimo_abono_capital: number
  inicio_abono_capital_estricto: string
  promesa_vencida: number
  logo_url?: string
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type ProyectoForm = Omit<Proyecto, 'cuenta' | 'agrego_usuario' | 'agrego_fecha' | 'modifico_usuario' | 'modifico_fecha'>

export type Fase = {
  cuenta: string
  empresa: number
  proyecto: number
  codigo: number
  nombre: string
  medida: string
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type FaseForm = Omit<Fase, 'cuenta' | 'agrego_usuario' | 'agrego_fecha' | 'modifico_usuario' | 'modifico_fecha'>

export type Manzana = {
  cuenta: string
  empresa: number
  proyecto: number
  fase: number
  codigo: string
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type ManzanaForm = Omit<Manzana, 'cuenta' | 'agrego_usuario' | 'agrego_fecha' | 'modifico_usuario' | 'modifico_fecha'>

export type Lote = {
  cuenta: string
  empresa: number
  proyecto: number
  fase: number
  manzana: string
  codigo: string
  moneda: string
  valor: number
  extension: number
  finca?: string
  folio?: string
  libro?: string
  norte?: string
  sur?: string
  este?: string
  oeste?: string
  otro?: string
  promesa: number
  recibo_serie?: string
  recibo_numero: number
  agrego_usuario?: string
  agrego_fecha?: string
  modifico_usuario?: string
  modifico_fecha?: string
}

export type LoteForm = Omit<Lote, 'cuenta' | 'promesa' | 'recibo_serie' | 'recibo_numero' | 'agrego_usuario' | 'agrego_fecha' | 'modifico_usuario' | 'modifico_fecha'>

// Estado derivado del lote
export function getLoteEstado(lote: Lote): 'disponible' | 'con-promesa' {
  return lote.promesa > 0 ? 'con-promesa' : 'disponible'
}
