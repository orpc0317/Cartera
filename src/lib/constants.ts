/** Convierte un código ISO 3166-1 alpha-2 en emoji de bandera. Ej: "GT" → "🇬🇹" */
export function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.codePointAt(0)!))
    .join('')
}

export const REGIMENES_ISR: Record<number, string> = {
  1: 'Régimen General',
  2: 'Pequeño Contribuyente',
  3: 'Exento',
}

export const REGIMENES_IVA: Record<number, string> = {
  0: 'No aplica',
  1: 'General (12%)',
  2: 'Pequeño Contribuyente (5%)',
  3: 'Exento',
}

/**
 * Valida la estructura de un NIT guatemalteco.
 * Acepta formato con guion (1234567-8) o sin guion (12345678).
 * "CF" (Consumidor Final) también es válido.
 */
export function validarNIT(nit: string): boolean {
  const s = nit.trim()
  if (s.length === 0) return false
  if (s.toUpperCase() === 'CF') return true

  let correlativo: string
  let verificador: string

  if (s.includes('-')) {
    const pos = s.length - 2
    correlativo = s.substring(0, pos)
    verificador = s.substring(pos + 1)
  } else {
    const pos = s.length - 1
    correlativo = s.substring(0, pos)
    verificador = s.substring(pos)
  }

  if (verificador.toUpperCase() === 'K') verificador = '10'

  if (!/^\d+$/.test(correlativo)) return false

  let factor = correlativo.length + 1
  let valor = 0
  for (let i = 0; i < correlativo.length; i++) {
    valor += parseInt(s[i], 10) * factor
    factor--
  }

  valor = valor % 11
  if (valor === 0) return verificador === '0'
  return (11 - valor) === parseInt(verificador, 10)
}

/**
 * Valida el CUI / DPI guatemalteco (13 dígitos).
 * Verifica:
 *   - Formato numérico exacto de 13 dígitos
 *   - Departamento válido (1–22)
 *   - Municipio válido dentro del departamento
 *   - Dígito verificador por módulo 11
 */
export function validarDPI(dpi: string): boolean {
  if (!/^\d{13}$/.test(dpi.trim())) return false
  const d = dpi.trim()

  const depto = parseInt(d.substring(11, 13), 10)
  const muni  = parseInt(d.substring(9,  11), 10)

  if (depto < 1 || depto > 22) return false

  // Municipios máximos por departamento (índice = número de depto)
  const maxMunis = [0, 17, 8, 16, 16, 13, 14, 19, 8, 24, 21, 9, 30, 32, 21, 8, 17, 14, 5, 11, 11, 7, 17]
  if (muni < 1 || muni > maxMunis[depto]) return false

  // Dígito verificador (posición 8)
  const suma =
    parseInt(d[0], 10) * 2 +
    parseInt(d[1], 10) * 3 +
    parseInt(d[2], 10) * 4 +
    parseInt(d[3], 10) * 5 +
    parseInt(d[4], 10) * 6 +
    parseInt(d[5], 10) * 7 +
    parseInt(d[6], 10) * 8 +
    parseInt(d[7], 10) * 9

  const verificador = suma % 11
  if (verificador >= 10) return false

  return verificador === parseInt(d[8], 10)
}
