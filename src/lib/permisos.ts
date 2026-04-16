// Códigos de pantallas registrados en cartera.t_menu
// Máximo 8 caracteres (varchar(8))
export const PERMISOS = {
  DASH_HOME: 'DASH.HOM',
  DASH_KPI:  'DASH.KPI',
  EMP_CAT:   'EMP.CAT',
  PRO_CAT:   'PRO.CAT',
  FAS_CAT:   'FAS.CAT',
  MAN_CAT:   'MAN.CAT',
  LOT_CAT:   'LOT.CAT',
} as const

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS]

export function tienePermiso(permisos: string[], permiso: string): boolean {
  return permisos.includes(permiso)
}
