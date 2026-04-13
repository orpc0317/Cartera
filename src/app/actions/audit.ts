'use server'

import { createAdminClient } from '@/lib/supabase/admin'

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
  codigo: number,
): Promise<AuditEntry[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_audit_log')
    .select('*')
    .eq('tabla', tabla)
    .eq('cuenta', cuenta)
    .eq('registro_id->>codigo', String(codigo))
    .order('fecha', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data as AuditEntry[]
}
