'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TransaccionBancaria } from '@/lib/types/proyectos'
import type { NombresVer } from '@/lib/registro-ver'
import { filaConNombres } from '@/lib/leer-nombres'
import { requirePermiso, getCuentaActiva, leerAcceso } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { puedeProyecto, restringirProyecto } from '@/lib/acceso-proyecto'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getAuditUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null as string | null }
  return { userId: user.id }
}

// ─── Lectura ──────────────────────────────────────────────────────────────

async function exigirCuentaBancaria(
  empresa: number,
  cuentaBancaria: number,
): Promise<{ error: string } | null> {
  const acceso = await leerAcceso()
  if (!acceso) return { error: 'Sesión no válida.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('proyecto')
    .eq('cuenta', acceso.cuenta)
    .eq('empresa', empresa)
    .eq('codigo', cuentaBancaria)
    .maybeSingle()
  if (error || !data || !puedeProyecto(acceso, empresa, data.proyecto)) {
    return { error: 'Acceso denegado.' }
  }
  return null
}

export async function getTransaccionesBancarias(): Promise<TransaccionBancaria[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = createAdminClient()

  const consulta = admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('empresa, codigo')
    .eq('cuenta', acceso.cuenta)
  const acotada = restringirProyecto(consulta, acceso)
  if (!acotada) return []
  const { data: cbs } = await acotada

  const pares = (cbs ?? []) as { empresa: number; codigo: number }[]
  if (pares.length === 0) return []
  const filtro = pares
    .map((par) => `and(empresa.eq.${par.empresa},cuenta_bancaria.eq.${par.codigo})`)
    .join(',')

  const { data, error } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('*')
    .or(filtro)
    .order('fecha', { ascending: false })
    .order('numero_transaccion', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TransaccionBancaria[]
}

export async function obtenerTransaccionBancaria(
  empresa: number,
  cuentaBancaria: number,
  numeroTransaccion: string,
): Promise<{ row?: TransaccionBancaria & NombresVer; error?: string }> {
  const guard = await requirePermiso(PERMISOS.TRX_BAN, 'consultar')
  if (guard) return guard
  const alcance = await exigirCuentaBancaria(empresa, cuentaBancaria)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const admin = createAdminClient()
  const { data: propia } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('codigo', cuentaBancaria)
    .maybeSingle()
  if (!propia) return { error: 'Registro no encontrado.' }
  return filaConNombres<TransaccionBancaria>(
    admin, cuenta, 't_transaccion_bancaria',
    { empresa, cuenta_bancaria: cuentaBancaria, numero_transaccion: numeroTransaccion },
    '*',
    { empresa, cuentaBancaria },
  )
}

// ─── Anular ───────────────────────────────────────────────────────────────

export async function anularTransaccionBancaria(
  empresa: number,
  cuentaBancaria: number,
  numeroTransaccion: string,
): Promise<{ error?: string }> {
  const permCheck = await requirePermiso(PERMISOS.TRX_BAN, 'modificar')
  if (permCheck) return permCheck
  const alcance = await exigirCuentaBancaria(empresa, cuentaBancaria)
  if (alcance) return alcance

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
  const alcance = await exigirCuentaBancaria(empresa, cuentaBancaria)
  if (alcance) return alcance

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
