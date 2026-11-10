export type NombresVer = {
  empresa_nombre?: string | null
  proyecto_nombre?: string | null
  fase_nombre?: string | null
  banco_nombre?: string | null
  cliente_nombre?: string | null
  vendedor_nombre?: string | null
  coordinador_nombre?: string | null
  supervisor_nombre?: string | null
  cobrador_nombre?: string | null
  pais_nombre?: string | null
  departamento_nombre?: string | null
  municipio_nombre?: string | null
  gface_nombre?: string | null
  cuenta_bancaria_nombre?: string | null
  cuenta_deposito_nombre?: string | null
  moneda_nombre?: string | null
}

export function nombreLeido(leido: string | null | undefined, respaldo?: string | null): string {
  if (leido !== undefined) return leido ?? ''
  return respaldo ?? ''
}

export function reemplazarFila<T>(filas: T[], clave: (row: T) => string, fresca: T): T[] {
  const id = clave(fresca)
  return filas.map((row) => clave(row) === id ? fresca : row)
}
