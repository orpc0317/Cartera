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
  BAN_CAT:   'BAN.CAT',
  CUE_BAN:   'CUE.BAN',
  CLI_CAT:   'CLI.CAT',
  SUP_CAT:   'SUP.CAT',
  VEN_CAT:   'VEN.CAT',
  COB_CAT:   'COB.CAT',
  COO_CAT:   'COO.CAT',
  RES_OPE:   'RES.OPE',
  SER_REC:   'SER.REC',
  TIN_CAT:   'TIN.CAT',
  TSC_CAT:   'TSC.CAT',
} as const

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS]

export function tienePermiso(permisos: string[], permiso: string): boolean {
  return permisos.includes(permiso)
}
