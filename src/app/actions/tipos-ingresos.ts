'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { TipoIngreso, TipoIngresoForm } from '@/lib/types/tipos-ingresos'

// ─── Helpers privados ─────────────────────────────────────────────────────

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
    tabla: 't_tipo_ingreso',
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

export async function getTiposIngresos(): Promise<TipoIngreso[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_tipo_ingreso')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa')
    .order('proyecto')
    .order('nombre')
  if (error) throw new Error(error.message)
  return (data ?? []) as TipoIngreso[]
}

// ─── Escritura ─────────────────────────────────────────────────────────────

export async function createTipoIngreso(
  form: TipoIngresoForm,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Verificar duplicado de nombre
  const { data: dup } = await admin
    .schema('cartera')
    .from('t_tipo_ingreso')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('nombre', toDbString(form.nombre))
    .maybeSingle()
  if (dup) return { error: 'Ya existe un tipo ingreso con ese nombre en este proyecto.' }

  const now = new Date().toISOString()
  const normalized: TipoIngresoForm & { cuenta: string; fijo: number; agrego_usuario: string | null; agrego_fecha: string; modifico_usuario: string | null; modifico_fecha: string } = {
    ...form,
    nombre: toDbString(form.nombre),
    etiqueta: stripAccents(form.etiqueta),
    factura_item: form.factura_item ? toDbString(form.factura_item) : '',
    factura_descripcion: form.factura_descripcion ? toDbString(form.factura_descripcion) : '',
    cuenta,
    fijo: 0,
    agrego_usuario: auditUser.userId,
    agrego_fecha: now,
    modifico_usuario: auditUser.userId,
    modifico_fecha: now,
  }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_tipo_ingreso')
    .insert(normalized)
    .select()
    .single()

  if (error) return { error: error.message }

  await writeAudit(admin, {
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo: (data as TipoIngreso).codigo },
    datoAntes: null,
    datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  return {}
}

export async function updateTipoIngreso(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: TipoIngresoForm,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Verificar duplicado de nombre excluyendo el registro actual
  const { data: dup } = await admin
    .schema('cartera')
    .from('t_tipo_ingreso')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('nombre', toDbString(form.nombre))
    .neq('codigo', codigo)
    .maybeSingle()
  if (dup) return { error: 'Ya existe un tipo ingreso con ese nombre en este proyecto.' }

  const now = new Date().toISOString()
  // empresa y proyecto son readonly tras creación — no se incluyen en el payload
  const payload: Omit<TipoIngresoForm, 'empresa' | 'proyecto'> & { modifico_usuario: string | null; modifico_fecha: string } = {
    nombre: toDbString(form.nombre),
    etiqueta: stripAccents(form.etiqueta),
    forma_pago: form.forma_pago,
    moneda: form.moneda,
    monto: form.monto,
    hasta_monto: form.hasta_monto,
    factura_item: form.factura_item ? toDbString(form.factura_item) : '',
    factura_descripcion: form.factura_descripcion ? toDbString(form.factura_descripcion) : '',
    mora: form.mora,
    impuesto: form.impuesto,
    editable: form.editable,
    activo: form.activo,
    modifico_usuario: auditUser.userId,
    modifico_fecha: now,
  }

  let query = admin
    .schema('cartera')
    .from('t_tipo_ingreso')
    .update(payload)
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0))
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }

  await writeAudit(admin, {
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: null,
    datoDespues: payload as Record<string, unknown>,
    ...auditUser,
  })

  return {}
}

export async function deleteTipoIngreso(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Restricción: verificar recibos asociados
  const { count: countRecibos } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('tipo_ingreso', codigo)

  if (countRecibos && countRecibos > 0)
    return { error: 'No se puede eliminar este tipo ingreso porque tiene recibos asociados.' }

  // Restricción: verificar promesas asociadas
  const { count: countPromesas } = await admin
    .schema('cartera')
    .from('t_promesa_otros')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('tipo_otros', codigo)

  if (countPromesas && countPromesas > 0)
    return { error: 'No se puede eliminar este tipo ingreso porque tiene promesas asociadas.' }

  const { error } = await admin
    .schema('cartera')
    .from('t_tipo_ingreso')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: { empresa, proyecto, codigo },
    datoDespues: null,
    ...auditUser,
  })

  return {}
}

// ─── Utilidades ────────────────────────────────────────────────────────────

/** Quita tildes pero NO convierte a mayúsculas (para el campo etiqueta). */
function stripAccents(s: string): string {
  return s
    .trim()
    .replace(/[áà]/gi, (m) => m === m.toUpperCase() ? 'A' : 'a')
    .replace(/[éè]/gi, (m) => m === m.toUpperCase() ? 'E' : 'e')
    .replace(/[íì]/gi, (m) => m === m.toUpperCase() ? 'I' : 'i')
    .replace(/[óò]/gi, (m) => m === m.toUpperCase() ? 'O' : 'o')
    .replace(/[úùü]/gi, (m) => m === m.toUpperCase() ? 'U' : 'u')
}
