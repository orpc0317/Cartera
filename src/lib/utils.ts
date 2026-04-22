import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza un string para guardar en BD:
 * mayúsculas, sin tildes, conservando la Ñ.
 */
export function toDbString(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/Á/g, 'A')
    .replace(/É/g, 'E')
    .replace(/Í/g, 'I')
    .replace(/Ó/g, 'O')
    .replace(/Ú/g, 'U')
    .replace(/Ü/g, 'U')
}

/**
 * Jaro-Winkler similarity between two strings.
 * Returns a value in [0, 1] where 1 = identical.
 * Purely deterministic — no external dependencies.
 */
function jaro(a: string, b: string): number {
  if (a === b) return 1
  const lenA = a.length
  const lenB = b.length
  if (lenA === 0 || lenB === 0) return 0

  const matchDist = Math.max(Math.floor(Math.max(lenA, lenB) / 2) - 1, 0)
  const matchedA = new Array<boolean>(lenA).fill(false)
  const matchedB = new Array<boolean>(lenB).fill(false)

  let matches = 0
  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchDist)
    const end = Math.min(i + matchDist + 1, lenB)
    for (let j = start; j < end; j++) {
      if (matchedB[j] || a[i] !== b[j]) continue
      matchedA[i] = true
      matchedB[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < lenA; i++) {
    if (!matchedA[i]) continue
    while (!matchedB[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  return (matches / lenA + matches / lenB + (matches - transpositions / 2) / matches) / 3
}

export function jaroWinkler(a: string, b: string): number {
  const jaroScore = jaro(a, b)
  let prefix = 0
  const maxPrefix = Math.min(4, Math.min(a.length, b.length))
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++
    else break
  }
  return jaroScore + prefix * 0.1 * (1 - jaroScore)
}
