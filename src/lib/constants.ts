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
