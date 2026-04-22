'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { CuentaBancaria, CuentaBancariaForm } from '@/lib/types/proyectos'

// ─── Helpers (mirrored from bancos.ts) ────────────────────────────────────

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

export async function getCuentasBancarias(
  empresa?: number,
  proyecto?: number,
): Promise<CuentaBancaria[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('*')
    .eq('cuenta', cuenta)
    .order('nombre')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as CuentaBancaria[]
}

// ─── Escritura ─────────────────────────────────────────────────────────────

export async function createCuentaBancaria(
  form: CuentaBancariaForm,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: max } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  const codigo = (max?.codigo ?? 0) + 1
  const now = new Date().toISOString()

  // Validar que la combinación banco + número de cuenta no se repita en el mismo proyecto
  const { data: existente } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('banco', form.banco)
    .eq('numero', toDbString(form.numero))
    .maybeSingle()
  if (existente) return { error: 'Ya existe una cuenta bancaria con ese banco y número en este proyecto.' }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .insert({
      cuenta,
      empresa: form.empresa,
      proyecto: form.proyecto,
      codigo,
      numero: toDbString(form.numero),
      nombre: toDbString(form.nombre),
      banco: form.banco,
      moneda: form.moneda,
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
    tabla: 't_cuenta_bancaria', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/bancos/cuentas-bancarias')
  return {}
}

export async function updateCuentaBancaria(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: Partial<CuentaBancariaForm>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const now = new Date().toISOString()
  const normalized = {
    ...form,
    numero: form.numero ? toDbString(form.numero) : undefined,
    nombre: form.nombre ? toDbString(form.nombre) : undefined,
  }

  // Validar que la combinación banco + número de cuenta no se repita en el mismo proyecto (excluyendo el registro actual)
  if (form.banco !== undefined || normalized.numero) {
    const bancoVal = form.banco ?? oldRow?.banco
    const numeroVal = normalized.numero ?? oldRow?.numero
    if (bancoVal && numeroVal) {
      const { data: existente } = await admin
        .schema('cartera')
        .from('t_cuenta_bancaria')
        .select('codigo')
        .eq('cuenta', cuenta)
        .eq('empresa', empresa)
        .eq('proyecto', proyecto)
        .eq('banco', bancoVal)
        .eq('numero', numeroVal)
        .neq('codigo', codigo)
        .maybeSingle()
      if (existente) return { error: 'Ya existe una cuenta bancaria con ese banco y número en este proyecto.' }
    }
  }

  let query = admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
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
    tabla: 't_cuenta_bancaria', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/bancos/cuentas-bancarias')
  return {}
}

export async function deleteCuentaBancaria(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Guard: no se puede eliminar si tiene transacciones bancarias asociadas
  const { count } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('*', { count: 'exact', head: true })
    .eq('empresa', empresa)
    .eq('cuenta_bancaria', codigo)

  if ((count ?? 0) > 0) {
    return { error: `No se puede eliminar: la cuenta tiene ${count} transaccion(es) registrada(s).` }
  }

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .single()

  const { error } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_cuenta_bancaria', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/bancos/cuentas-bancarias')
  return {}
}
