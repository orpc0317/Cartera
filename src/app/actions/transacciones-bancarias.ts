'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { clienteDatos } from '@/lib/supabase/datos'
import type { TransaccionBancaria } from '@/lib/types/proyectos'
import type { NombresVer } from '@/lib/registro-ver'
import { leerNombres } from '@/lib/leer-nombres'
import { requirePermiso, leerAcceso } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { restringirProyecto } from '@/lib/acceso-proyecto'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getAuditUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null as string | null }
  return { userId: user.id }
}

// ─── Lectura ──────────────────────────────────────────────────────────────

async function proyectosDeCuentaBancaria(
  empresa: number,
  cuentaBancaria: number,
): Promise<{ cuenta: string; esAdmin: boolean; proyectos: number[] } | { error: string }> {
  const acceso = await leerAcceso()
  if (!acceso) return { error: 'Sesión no válida.' }
  const admin = await clienteDatos()
  const consulta = admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('proyecto')
    .eq('cuenta', acceso.cuenta)
    .eq('empresa', empresa)
    .eq('codigo', cuentaBancaria)
  const acotada = restringirProyecto(consulta, acceso, { empresa })
  if (!acotada) return { error: 'Acceso denegado.' }
  const { data, error } = await acotada
  if (error || !data || data.length === 0) return { error: 'Acceso denegado.' }
  return {
    cuenta: acceso.cuenta,
    esAdmin: acceso.esAdmin,
    proyectos: [...new Set(data.map((fila) => fila.proyecto as number))],
  }
}

export async function getTransaccionesBancarias(): Promise<TransaccionBancaria[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = await clienteDatos()

  const consulta = admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('empresa, proyecto, cuenta_bancaria, numero_transaccion, tipo_transaccion, fecha, numero_documento, valor, estado, origen, a_nombre_de, comentario, partida, tipo_saldo, en_circulacion, fecha_conciliacion, tasa_cambio, cuenta_transferencia, transaccion_transferencia, usuario_agrego, fecha_agrego, usuario_modifico, fecha_modifico')
    .eq('cuenta', acceso.cuenta)
    .order('fecha', { ascending: false })
    .order('numero_transaccion', { ascending: false })
  const acotada = restringirProyecto(consulta, acceso)
  if (!acotada) return []
  const { data, error } = await acotada

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
  const alcance = await proyectosDeCuentaBancaria(empresa, cuentaBancaria)
  if ('error' in alcance) return alcance
  const admin = await clienteDatos()
  let consulta = admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('empresa, proyecto, cuenta_bancaria, numero_transaccion, tipo_transaccion, fecha, numero_documento, valor, estado, origen, a_nombre_de, comentario, partida, tipo_saldo, en_circulacion, fecha_conciliacion, tasa_cambio, cuenta_transferencia, transaccion_transferencia, usuario_agrego, fecha_agrego, usuario_modifico, fecha_modifico')
    .eq('cuenta', alcance.cuenta)
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)
  if (!alcance.esAdmin) consulta = consulta.in('proyecto', alcance.proyectos)
  const { data, error } = await consulta.maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Registro no encontrado.' }
  const row = data as TransaccionBancaria & { proyecto?: number }
  const nombres = await leerNombres(admin, alcance.cuenta, {
    empresa,
    proyecto: row.proyecto,
    cuentaBancaria,
  })
  return { row: { ...row, ...nombres } }
}

// ─── Anular ───────────────────────────────────────────────────────────────

export async function anularTransaccionBancaria(
  empresa: number,
  cuentaBancaria: number,
  numeroTransaccion: string,
): Promise<{ error?: string }> {
  const permCheck = await requirePermiso(PERMISOS.TRX_BAN, 'modificar')
  if (permCheck) return permCheck
  const alcance = await proyectosDeCuentaBancaria(empresa, cuentaBancaria)
  if ('error' in alcance) return alcance

  const admin = await clienteDatos()
  const { userId } = await getAuditUser()
  const now = new Date().toISOString()

  let consulta = admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('estado')
    .eq('cuenta', alcance.cuenta)
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)
  if (!alcance.esAdmin) consulta = consulta.in('proyecto', alcance.proyectos)
  const { data: row } = await consulta.maybeSingle()

  if (!row) return { error: 'Transacción no encontrada.' }
  if (row.estado === 2) return { error: 'La transacción ya está anulada.' }

  let cambio = admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .update({ estado: 2, modifico_usuario: userId, modifico_fecha: now })
    .eq('cuenta', alcance.cuenta)
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)
  if (!alcance.esAdmin) cambio = cambio.in('proyecto', alcance.proyectos)
  const { error } = await cambio

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
  const alcance = await proyectosDeCuentaBancaria(empresa, cuentaBancaria)
  if ('error' in alcance) return alcance

  const admin = await clienteDatos()

  let baja = admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .delete()
    .eq('cuenta', alcance.cuenta)
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', cuentaBancaria)
    .eq('numero_transaccion', numeroTransaccion)
  if (!alcance.esAdmin) baja = baja.in('proyecto', alcance.proyectos)
  const { error } = await baja

  if (error) return { error: error.message }

  revalidatePath('/dashboard/bancos/operaciones/transacciones')
  return {}
}
