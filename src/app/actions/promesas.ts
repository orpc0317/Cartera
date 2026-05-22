'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Promesa, PromesaForm } from '@/lib/types/promesas'

// ─── Helpers ───────────────────────────────────────────────────────────────

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

export async function getPromesas(): Promise<Promesa[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa')
    .order('proyecto')
    .order('numero')
  if (error) throw new Error(error.message)
  return (data ?? []) as Promesa[]
}

// ─── Crear ─────────────────────────────────────────────────────────────────

export async function createPromesa(form: PromesaForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = createAdminClient()

  const { count: dupeCount } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('numero', form.numero)

  if (dupeCount && dupeCount > 0) {
    return { error: 'Ya existe una promesa con ese numero en este proyecto.' }
  }

  const auditUser = await getAuditUser()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema('cartera')
    .from('t_promesa')
    .insert({
      ...form,
      cuenta,
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_promesa',
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, numero: form.numero },
    datoAntes: null,
    datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  return {}
}

// ─── Actualizar ────────────────────────────────────────────────────────────

export async function updatePromesa(
  empresa: number,
  proyecto: number,
  numero: number,
  form: Pick<PromesaForm, 'referencia' | 'observacion' | 'estado'>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = createAdminClient()

  const { data: original } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)
    .maybeSingle()

  const auditUser = await getAuditUser()
  const now = new Date().toISOString()

  let query = admin
    .schema('cartera')
    .from('t_promesa')
    .update({
      referencia: form.referencia,
      observacion: form.observacion,
      estado: form.estado,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { data, error } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit(admin, {
    tabla: 't_promesa',
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, numero },
    datoAntes: original as Record<string, unknown> | null,
    datoDespues: (data?.[0] ?? null) as Record<string, unknown> | null,
    ...auditUser,
  })

  return {}
}

// ─── Eliminar ──────────────────────────────────────────────────────────────

export async function deletePromesa(
  empresa: number,
  proyecto: number,
  numero: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = createAdminClient()

  const { count } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', numero)

  if (count && count > 0) {
    return { error: 'No se puede eliminar esta promesa porque tiene recibos caja asociados.' }
  }

  const { data: original } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)
    .maybeSingle()

  const auditUser = await getAuditUser()

  const { error } = await admin
    .schema('cartera')
    .from('t_promesa')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_promesa',
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, numero },
    datoAntes: original as Record<string, unknown> | null,
    datoDespues: null,
    ...auditUser,
  })

  return {}
}
