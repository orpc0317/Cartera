'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TasaCambio, TasaCambioForm } from '@/lib/types/tasas-cambio'
export type { TasaCambio, TasaCambioForm } from '@/lib/types/tasas-cambio'

async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

async function getAuditUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, email: null, nombre: null }
  const admin = createAdminClient()
  const { data } = await admin
    .schema('cartera')
    .from('t_usuario')
    .select('nombres, apellidos')
    .eq('userid', user.id)
    .maybeSingle()
  const nombre = data
    ? `${data.nombres ?? ''} ${data.apellidos ?? ''}`.trim() || null
    : null
  return { userId: user.id, email: user.email ?? null, nombre }
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    tabla: string
    operacion: 'INSERT' | 'UPDATE' | 'DELETE'
    cuenta: string
    registroId: Record<string, unknown>
    datoAntes: Record<string, unknown> | null
    datoDespues: Record<string, unknown> | null
    userId: string | null
    email: string | null
    nombre: string | null
  },
) {
  await admin.schema('cartera').from('t_audit_log').insert({
    tabla: opts.tabla,
    operacion: opts.operacion,
    cuenta: opts.cuenta,
    registro_id: opts.registroId,
    datos_antes: opts.datoAntes,
    datos_despues: opts.datoDespues,
    usuario_id: opts.userId,
    usuario_email: opts.email,
    usuario_nombre: opts.nombre,
  })
}

export async function getTasasCambio(): Promise<TasaCambio[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_moneda_tasa_cambio')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa', { ascending: true })
    .order('proyecto', { ascending: true })
    .order('moneda', { ascending: true })
    .order('fecha', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TasaCambio[]
}

export async function createTasaCambio(form: TasaCambioForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  // Validate tasa_cambio > 0
  if (!form.tasa_cambio || Number(form.tasa_cambio) <= 0)
    return { error: 'La tasa de cambio debe ser mayor a cero.' }

  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Validate: new fecha must be strictly after all existing fechas for this group
  const { data: fechaConflicto } = await admin
    .schema('cartera')
    .from('t_moneda_tasa_cambio')
    .select('fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('moneda', form.moneda)
    .gte('fecha', form.fecha)
    .limit(1)
    .maybeSingle()

  if (fechaConflicto) return { error: 'La fecha debe ser posterior a la última tasa registrada para esta moneda.' }

  const now = new Date().toISOString()
  const { error } = await admin
    .schema('cartera')
    .from('t_moneda_tasa_cambio')
    .insert({
      cuenta,
      empresa: form.empresa,
      proyecto: form.proyecto,
      moneda: form.moneda,
      fecha: form.fecha,
      tasa_cambio: Number(form.tasa_cambio),
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
    })

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_moneda_tasa_cambio',
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, moneda: form.moneda, fecha: form.fecha },
    datoAntes: null,
    datoDespues: { empresa: form.empresa, proyecto: form.proyecto, moneda: form.moneda, fecha: form.fecha, tasa_cambio: form.tasa_cambio },
    userId: auditUser.userId,
    email: auditUser.email,
    nombre: auditUser.nombre,
  })

  return {}
}

export async function deleteTasaCambio(
  empresa: number,
  proyecto: number,
  moneda: string,
  fecha: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Check restriction: t_recibo_caja with same keys and fecha >= fecha_a_eliminar
  const { data: recibos } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('numero')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)
    .gte('fecha', fecha)
    .limit(1)

  if (recibos && recibos.length > 0)
    return { error: 'No se puede eliminar esta tasa porque hay recibos de caja registrados en esa fecha o posterior.' }

  // Read before delete for audit
  const { data: before } = await admin
    .schema('cartera')
    .from('t_moneda_tasa_cambio')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)
    .eq('fecha', fecha)
    .maybeSingle()

  const { error } = await admin
    .schema('cartera')
    .from('t_moneda_tasa_cambio')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)
    .eq('fecha', fecha)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_moneda_tasa_cambio',
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, moneda, fecha },
    datoAntes: before ?? null,
    datoDespues: null,
    userId: auditUser.userId,
    email: auditUser.email,
    nombre: auditUser.nombre,
  })

  return {}
}
