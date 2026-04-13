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
