'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { SerieRecibo, SerieReciboForm, SerieFactura } from '@/lib/types/proyectos'

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

// ─── Lectura ───────────────────────────────────────────────────────────────

export async function getSeriesFactura(): Promise<SerieFactura[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .select('empresa, proyecto, serie')
    .eq('cuenta', cuenta)
    .order('empresa')
    .order('proyecto')
    .order('serie')
  if (error) throw new Error(error.message)
  return data as SerieFactura[]
}

export async function getSeriesRecibos(): Promise<SerieRecibo[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa')
    .order('proyecto')
    .order('serie')
  if (error) throw new Error(error.message)
  return data as SerieRecibo[]
}

// ─── Escritura ─────────────────────────────────────────────────────────────

export async function createSerieRecibo(form: SerieReciboForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const serie = toDbString(form.serie)

  // Validar duplicado
  const { data: existente } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('serie')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('serie', serie)
    .maybeSingle()
  if (existente) return { error: 'Ya existe una serie con ese código en este proyecto.' }

  // Si se marca como predeterminado, quitar la bandera de las demás series del mismo proyecto
  if (form.predeterminado === 1) {
    await admin
      .schema('cartera')
      .from('t_serie_recibo')
      .update({ predeterminado: 0 })
      .eq('cuenta', cuenta)
      .eq('empresa', form.empresa)
      .eq('proyecto', form.proyecto)
      .neq('serie', serie)
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .insert({
      cuenta,
      empresa: form.empresa,
      proyecto: form.proyecto,
      serie,
      serie_factura: form.serie_factura || null,
      dias_fecha: form.dias_fecha,
      correlativo: form.correlativo,
      formato: form.formato,
      predeterminado: form.predeterminado,
      recibo_automatico: form.recibo_automatico,
      activo: form.activo,
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_serie_recibo', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, serie },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  return {}
}

export async function updateSerieRecibo(
  empresa: number,
  proyecto: number,
  serie: string,
  form: Partial<SerieReciboForm>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
    .single()

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    serie_factura: form.serie_factura || null,
    dias_fecha: form.dias_fecha,
    correlativo: form.correlativo,
    formato: form.formato,
    predeterminado: form.predeterminado,
    recibo_automatico: form.recibo_automatico,
    activo: form.activo,
    modifico_usuario: auditUser.userId,
    modifico_fecha: now,
  }

  // Si se marca como predeterminado, quitar la bandera de las demás series del mismo proyecto
  if (form.predeterminado === 1) {
    await admin
      .schema('cartera')
      .from('t_serie_recibo')
      .update({ predeterminado: 0 })
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .neq('serie', serie)
  }

  let query = admin
    .schema('cartera')
    .from('t_serie_recibo')
    .update(payload)
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit(admin, {
    tabla: 't_serie_recibo', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, serie },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: (data as Record<string, unknown>[])[0] ?? null,
    ...auditUser,
  })

  return {}
}

export async function deleteSerieRecibo(
  empresa: number,
  proyecto: number,
  serie: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Restriction: cannot delete if there are associated recibos de caja
  const { count } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('cuenta', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)

  if ((count ?? 0) > 0)
    return { error: 'No se puede eliminar esta serie porque tiene recibos de caja asociados.' }

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
    .single()

  const { error } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_serie_recibo', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, serie },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: null,
    ...auditUser,
  })

  return {}
}
