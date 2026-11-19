'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { clienteDatos } from '@/lib/supabase/datos'
import { leerAcceso } from '@/app/actions/permisos'
import { puedeEmpresa, puedeProyecto, type AccesoLectura } from '@/lib/acceso-proyecto'

function entero(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

async function transaccionPermitida(
  acceso: AccesoLectura,
  registroId: Record<string, unknown>,
): Promise<boolean> {
  const empresa = registroId.empresa
  const codigo = registroId.cuenta_bancaria
  const numero = registroId.numero_transaccion
  if (!entero(empresa) || !entero(codigo)) return false
  if (typeof numero !== 'string' || numero.trim() === '') return false
  if (acceso.esAdmin) return true
  if (entero(registroId.proyecto)) return puedeProyecto(acceso, empresa, registroId.proyecto)

  const datos = await clienteDatos()
  const { data, error } = await datos
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('proyecto')
    .eq('cuenta', acceso.cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)
  if (error || !data || data.length === 0) return false
  return data.every((fila) => puedeProyecto(acceso, empresa, fila.proyecto as number))
}

function registroPermitido(
  acceso: AccesoLectura,
  tabla: string,
  registroId: Record<string, unknown>,
): boolean {
  if (acceso.esAdmin) return true
  const empresa = registroId.empresa
  const proyecto = registroId.proyecto
  if (entero(empresa) && entero(proyecto)) return puedeProyecto(acceso, empresa, proyecto)
  if (tabla === 't_proyecto' && entero(empresa) && entero(registroId.codigo)) {
    return puedeProyecto(acceso, empresa, registroId.codigo)
  }
  if (tabla === 't_empresa') {
    const codigo = entero(registroId.codigo) ? registroId.codigo : empresa
    return entero(codigo) && puedeEmpresa(acceso, codigo)
  }
  return false
}

export type AuditEntry = {
  id: number
  tabla: string
  operacion: 'INSERT' | 'UPDATE' | 'DELETE'
  cuenta: string
  registro_id: Record<string, unknown>
  datos_antes: Record<string, unknown> | null
  datos_despues: Record<string, unknown> | null
  usuario_id: string | null
  usuario_email: string | null
  usuario_nombre: string | null
  fecha: string
}

export async function getAuditLog(
  tabla: string,
  cuenta: string,
  registroId: Record<string, unknown>,
): Promise<AuditEntry[]> {
  const acceso = await leerAcceso()
  if (!acceso || cuenta !== acceso.cuenta) return []
  const permitido = tabla === 't_transaccion_bancaria'
    ? await transaccionPermitida(acceso, registroId)
    : registroPermitido(acceso, tabla, registroId)
  if (!permitido) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_audit_log')
    .select('id, tabla, operacion, cuenta, registro_id, datos_antes, datos_despues, usuario_id, usuario_email, usuario_nombre, fecha')
    .eq('tabla', tabla)
    .eq('cuenta', acceso.cuenta)
    .filter('registro_id', 'cs', JSON.stringify(registroId))
    .order('fecha', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data as AuditEntry[]
}
