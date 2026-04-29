'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Supervisor, SupervisorForm } from '@/lib/types/proyectos'

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

export async function getSupervisores(): Promise<Supervisor[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_supervisor')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa').order('proyecto').order('nombre')
  if (error) throw new Error(error.message)
  return data as Supervisor[]
}

// ─── Crear ─────────────────────────────────────────────────────────────────

export async function createSupervisor(form: SupervisorForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]
  const now = new Date().toISOString()

  // Validar nombre duplicado dentro del mismo proyecto
  const { data: existente } = await admin
    .schema('cartera')
    .from('t_supervisor')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .ilike('nombre', form.nombre.trim())
    .maybeSingle()
  if (existente) return { error: 'Ya existe un supervisor con ese nombre en este proyecto.' }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_supervisor')
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
    tabla: 't_supervisor', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo: (data as Supervisor).codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/supervisores')
  revalidatePath('/dashboard')
  return {}
}

// ─── Actualizar ────────────────────────────────────────────────────────────

export async function updateSupervisor(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: Partial<SupervisorForm>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_supervisor')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const now = new Date().toISOString()

  // Validar nombre duplicado dentro del mismo proyecto (excluyendo el registro actual)
  if (form.nombre) {
    const { data: existente } = await admin
      .schema('cartera')
      .from('t_supervisor')
      .select('codigo')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .ilike('nombre', (form.nombre as string).trim())
      .neq('codigo', codigo)
      .maybeSingle()
    if (existente) return { error: 'Ya existe un supervisor con ese nombre en este proyecto.' }
  }

  let query = admin
    .schema('cartera')
    .from('t_supervisor')
    .update({ ...form, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit(admin, {
    tabla: 't_supervisor', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/supervisores')
  return {}
}

// ─── Eliminar ──────────────────────────────────────────────────────────────

export async function deleteSupervisor(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_supervisor')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  // Verificar restricción: vendedores asociados
  const { count: vendedoresCount } = await admin
    .schema('cartera')
    .from('t_vendedor')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('supervisor', codigo)
  if (vendedoresCount && vendedoresCount > 0) {
    return { error: 'No se puede eliminar este supervisor porque tiene vendedores asociados.' }
  }

  const { error } = await admin
    .schema('cartera')
    .from('t_supervisor')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_supervisor', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/supervisores')
  return {}
}
