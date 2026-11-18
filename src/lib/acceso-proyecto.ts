export type ParProyecto = { empresa: number; proyecto: number }

export type AccesoLectura = {
  cuenta: string
  userId: string
  esAdmin: boolean
  accesos: ParProyecto[]
}

export type ColumnasProyecto = { empresa: string; proyecto: string }

const COLUMNAS: ColumnasProyecto = { empresa: 'empresa', proyecto: 'proyecto' }

type Filtro<T> = {
  eq: (column: string, value: number) => T
  or: (filters: string) => T
}

function entero(value: number | undefined): boolean {
  return value === undefined || Number.isInteger(value)
}

export function puedeEmpresa(acceso: AccesoLectura, empresa: number): boolean {
  if (!Number.isInteger(empresa)) return false
  if (acceso.esAdmin) return true
  return acceso.accesos.some((par) => par.empresa === empresa)
}

export function puedeProyecto(acceso: AccesoLectura, empresa: number, proyecto: number): boolean {
  if (!Number.isInteger(empresa) || !Number.isInteger(proyecto)) return false
  if (acceso.esAdmin) return true
  return acceso.accesos.some((par) => par.empresa === empresa && par.proyecto === proyecto)
}

export function empresasVisibles(acceso: AccesoLectura): number[] | null {
  if (acceso.esAdmin) return null
  return [...new Set(acceso.accesos.map((par) => par.empresa))]
}

export function restringirProyecto<T extends Filtro<T>>(
  query: T,
  acceso: AccesoLectura,
  pedido?: { empresa?: number; proyecto?: number },
  columnas: ColumnasProyecto = COLUMNAS,
): T | null {
  const empresa = pedido?.empresa
  const proyecto = pedido?.proyecto
  if (!entero(empresa) || !entero(proyecto)) return null

  if (acceso.esAdmin) {
    let next = query
    if (empresa !== undefined) next = next.eq(columnas.empresa, empresa)
    if (proyecto !== undefined) next = next.eq(columnas.proyecto, proyecto)
    return next
  }

  const pares = acceso.accesos.filter((par) =>
    (empresa === undefined || par.empresa === empresa) &&
    (proyecto === undefined || par.proyecto === proyecto),
  )
  if (pares.length === 0) return null
  if (empresa !== undefined && proyecto !== undefined) {
    return query.eq(columnas.empresa, empresa).eq(columnas.proyecto, proyecto)
  }

  const filtro = pares
    .map((par) => `and(${columnas.empresa}.eq.${par.empresa},${columnas.proyecto}.eq.${par.proyecto})`)
    .join(',')
  return query.or(filtro)
}
