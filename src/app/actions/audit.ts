'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { leerAcceso } from '@/app/actions/permisos'
import { puedeEmpresa, puedeProyecto } from '@/lib/acceso-proyecto'

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

  const empresa = registroId.empresa
  const proyecto = registroId.proyecto
  if (typeof empresa === 'number' && typeof proyecto === 'number') {
    if (!puedeProyecto(acceso, empresa, proyecto)) return []
  } else if (typeof empresa === 'number') {
    if (!puedeEmpresa(acceso, empresa)) return []
  } else if (tabla === 't_empresa' && typeof registroId.codigo === 'number') {
    if (!puedeEmpresa(acceso, registroId.codigo)) return []
  } else if (!acceso.esAdmin) {
    return []
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_audit_log')
    .select('*')
    .eq('tabla', tabla)
    .eq('cuenta', acceso.cuenta)
    .filter('registro_id', 'cs', JSON.stringify(registroId))
    .order('fecha', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data as AuditEntry[]
}
