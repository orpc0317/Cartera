'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TransaccionBancaria } from '@/lib/types/proyectos'
import { requirePermiso, getCuentaActiva } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getAuditUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null as string | null }
  return { userId: user.id }
}

// ─── Lectura ──────────────────────────────────────────────────────────────

export async function getTransaccionesBancarias(): Promise<TransaccionBancaria[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()

  const { data: cbs } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('codigo')
    .eq('cuenta', cuenta)

  const cbIds = (cbs ?? []).map((cb: { codigo: number }) => cb.codigo)
  if (cbIds.length === 0) return []

  const { data, error } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('*')
    .in('cuenta_bancaria', cbIds)
    .order('fecha', { ascending: false })
    .order('numero_transaccion', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TransaccionBancaria[]
}

// ─── Anular ───────────────────────────────────────────────────────────────

export async function anularTransaccionBancaria(
  empresa: number,
  cuentaBancaria: number,
  numeroTransaccion: string,
): Promise<{ error?: string }> {
  const permCheck = await requirePermiso(PERMISOS.TRX_BAN, 'modificar')
  if (permCheck) return permCheck

  const admin = createAdminClient()
  const { userId } = await getAuditUser()
  const now = new Date().toISOString()

  const { data: row } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('estado')
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)
    .single()

  if (!row) return { error: 'Transacción no encontrada.' }
  if (row.estado === 2) return { error: 'La transacción ya está anulada.' }

  const { error } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .update({ estado: 2, modifico_usuario: userId, modifico_fecha: now })
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/bancos/operaciones/transacciones')
  return {}
}

// ─── Eliminar ─────────────────────────────────────────────────────────────

export async function eliminarTransaccionBancaria(
  empresa: number,
  cuentaBancaria: number,
  numeroTransaccion: string,
): Promise<{ error?: string }> {
  const permCheck = await requirePermiso(PERMISOS.TRX_BAN, 'eliminar')
  if (permCheck) return permCheck

  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .delete()
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/bancos/operaciones/transacciones')
  return {}
}
