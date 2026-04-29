'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Coordinador, CoordinadorForm } from '@/lib/types/proyectos'

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

export async function getCoordinadores(): Promise<Coordinador[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_coordinador')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa').order('proyecto').order('nombre')
  if (error) throw new Error(error.message)
  return data as Coordinador[]
}

// ─── Crear ─────────────────────────────────────────────────────────────────

export async function createCoordinador(form: CoordinadorForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]
  const now = new Date().toISOString()

  const { data: existente } = await admin
    .schema('cartera')
    .from('t_coordinador')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .ilike('nombre', form.nombre.trim())
    .maybeSingle()
  if (existente) return { error: 'Ya existe un coordinador con ese nombre en este proyecto.' }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_coordinador')
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
    tabla: 't_coordinador', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo: (data as Coordinador).codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/coordinadores')
  revalidatePath('/dashboard')
  return {}
}

// ─── Actualizar ────────────────────────────────────────────────────────────

export async function updateCoordinador(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: CoordinadorForm,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_coordinador')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const now = new Date().toISOString()

  if (form.nombre) {
    const { data: existente } = await admin
      .schema('cartera')
      .from('t_coordinador')
      .select('codigo')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .ilike('nombre', form.nombre.trim())
      .neq('codigo', codigo)
      .maybeSingle()
    if (existente) return { error: 'Ya existe un coordinador con ese nombre en este proyecto.' }
  }

  const { nombre, supervisor, activo } = form

  let query = admin
    .schema('cartera')
    .from('t_coordinador')
    .update({ nombre, supervisor, activo, modifico_usuario: auditUser.userId, modifico_fecha: now })
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
    tabla: 't_coordinador', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/coordinadores')
  return {}
}

// ─── Eliminar ──────────────────────────────────────────────────────────────

export async function deleteCoordinador(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_coordinador')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const { count: vendedoresCount } = await admin
    .schema('cartera')
    .from('t_vendedor')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('coordinador', codigo)
  if (vendedoresCount && vendedoresCount > 0) {
    return { error: 'No se puede eliminar este coordinador porque tiene vendedores asociados.' }
  }

  const { error } = await admin
    .schema('cartera')
    .from('t_coordinador')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_coordinador', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/coordinadores')
  return {}
}
