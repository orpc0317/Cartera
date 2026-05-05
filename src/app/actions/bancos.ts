'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { Banco, BancoForm } from '@/lib/types/proyectos'

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

export async function getBancos(empresa?: number, proyecto?: number): Promise<Banco[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_banco')
    .select('*')
    .eq('cuenta', cuenta)
    .order('nombre')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Banco[]
}

// ─── Escritura ─────────────────────────────────────────────────────────────

export async function createBanco(form: BancoForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: max } = await admin
    .schema('cartera')
    .from('t_banco')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  const codigo = (max?.codigo ?? 0) + 1
  const now = new Date().toISOString()

  // Validar nombre duplicado dentro del mismo proyecto
  const { data: existente } = await admin
    .schema('cartera')
    .from('t_banco')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('nombre', toDbString(form.nombre))
    .maybeSingle()
  if (existente) return { error: 'Ya existe un banco con ese nombre en este proyecto.' }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_banco')
    .insert({
      cuenta,
      empresa: form.empresa,
      proyecto: form.proyecto,
      codigo,
      nombre: toDbString(form.nombre),
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_banco', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/bancos/bancos')
  return {}
}

export async function updateBanco(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: Partial<BancoForm>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_banco')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const now = new Date().toISOString()
  const normalized = {
    ...form,
    nombre: form.nombre ? toDbString(form.nombre) : undefined,
  }

  // Validar nombre duplicado dentro del mismo proyecto (excluyendo el registro actual)
  if (normalized.nombre) {
    const { data: existente } = await admin
      .schema('cartera')
      .from('t_banco')
      .select('codigo')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('nombre', normalized.nombre)
      .neq('codigo', codigo)
      .maybeSingle()
    if (existente) return { error: 'Ya existe un banco con ese nombre en este proyecto.' }
  }

  let query = admin
    .schema('cartera')
    .from('t_banco')
    .update({ ...normalized, modifico_usuario: auditUser.userId, modifico_fecha: now })
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
    tabla: 't_banco', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/bancos/bancos')
  return {}
}

export async function deleteBanco(empresa: number, proyecto: number, codigo: number): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Guard: no se puede eliminar si tiene cuentas bancarias asociadas
  const { count: countCuentas } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('banco', codigo)

  if ((countCuentas ?? 0) > 0) {
    return { error: 'No se puede eliminar este banco porque tiene cuentas bancarias asociadas.' }
  }

  // Guard: no se puede eliminar si tiene recibos de caja asociados
  const { count: countRecibos } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('banco', codigo)

  if ((countRecibos ?? 0) > 0) {
    return { error: 'No se puede eliminar este banco porque tiene recibos de caja asociados.' }
  }

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_banco')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const { error } = await admin
    .schema('cartera')
    .from('t_banco')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_banco', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/bancos/bancos')
  return {}
}
