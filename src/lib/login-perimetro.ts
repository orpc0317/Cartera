const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

export function omitirTurnstile(secret: string | undefined, nodeEnv: string | undefined): boolean {
  return !secret?.trim() && nodeEnv !== 'production'
}

export function ipDeLockout(ip: string): string | null {
  const valor = ip.trim()
  if (IPV4.test(valor)) return valor
  if (!esIpv6(valor)) return null
  return valor.toLowerCase()
}

export function bloqueadoPorConteo(
  fallosCorreo: number,
  fallosIp: number | null,
  maximo: number,
): boolean {
  if (fallosCorreo >= maximo) return true
  return fallosIp !== null && fallosIp >= maximo
}

function esIpv6(valor: string): boolean {
  if (valor.length < 2 || valor.length > 45 || !valor.includes(':')) return false
  if (!/^[0-9a-fA-F:]+$/.test(valor) || !/[0-9a-fA-F]/.test(valor)) return false
  return valor.split('::').length <= 2
}
