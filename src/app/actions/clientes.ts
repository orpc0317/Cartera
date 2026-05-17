'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Cliente, ClienteForm } from '@/lib/types/proyectos'

// ─── Helpers ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

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

export async function getClientes(empresa?: number, proyecto?: number): Promise<Cliente[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_cliente')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa').order('proyecto').order('nombre')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Cliente[]
}

// ─── Crear ─────────────────────────────────────────────────────────────────

export async function createCliente(form: ClienteForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  if (form.correo && !isValidEmail(form.correo)) return { error: 'El correo electrónico no tiene un formato válido.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]
  const now = new Date().toISOString()

  // Validar nombre duplicado dentro del mismo proyecto
  const { data: existente } = await admin
    .schema('cartera')
    .from('t_cliente')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .ilike('nombre', form.nombre.trim())
    .maybeSingle()
  if (existente) return { error: 'Ya existe un cliente con ese nombre en este proyecto.' }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_cliente')
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
    tabla: 't_cliente', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo: (data as Cliente).codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/clientes')
  revalidatePath('/dashboard')
  return {}
}

// ─── Actualizar ────────────────────────────────────────────────────────────

export async function updateCliente(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: Partial<ClienteForm>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  if (form.correo && !isValidEmail(form.correo)) return { error: 'El correo electrónico no tiene un formato válido.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_cliente')
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
      .from('t_cliente')
      .select('codigo')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .ilike('nombre', (form.nombre as string).trim())
      .neq('codigo', codigo)
      .maybeSingle()
    if (existente) return { error: 'Ya existe un cliente con ese nombre en este proyecto.' }
  }

  let query = admin
    .schema('cartera')
    .from('t_cliente')
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
    tabla: 't_cliente', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/clientes')
  return {}
}

// ─── Eliminar ──────────────────────────────────────────────────────────────

export async function deleteCliente(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_cliente')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const { count: promesasCount } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('cliente', codigo)
  if (promesasCount && promesasCount > 0) {
    return { error: 'No se puede eliminar este cliente porque tiene promesas asociadas.' }
  }

  const { count: recibosCount } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('cliente', codigo)
  if (recibosCount && recibosCount > 0) {
    return { error: 'No se puede eliminar este cliente porque tiene recibos asociados.' }
  }

  const { error } = await admin
    .schema('cartera')
    .from('t_cliente')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_cliente', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/promesas/clientes')
  revalidatePath('/dashboard')
  return {}
}
