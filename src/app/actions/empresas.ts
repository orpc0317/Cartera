'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { Empresa, EmpresaForm } from '@/lib/types/proyectos'

// Obtiene cuenta_activa del usuario en sesión
async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

// Obtiene info del usuario para auditoría
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
    codigo: number
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
    registro_id: { codigo: opts.codigo },
    datos_antes: opts.datoAntes,
    datos_despues: opts.datoDespues,
    usuario_id: opts.userId,
    usuario_email: opts.email,
    usuario_nombre: opts.nombre,
  })
}

// ─── Lectura ───────────────────────────────────────────────────────────────

export async function getEmpresas(): Promise<Empresa[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_empresa')
    .select('*')
    .eq('cuenta', cuenta)
    .order('nombre')
  if (error) throw new Error(error.message)
  return data as Empresa[]
}

export async function getEmpresa(codigo: number): Promise<Empresa> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_empresa')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('codigo', codigo)
    .single()
  if (error) throw new Error(error.message)
  return data as Empresa
}

// ─── Escritura ─────────────────────────────────────────────────────────────

export async function createEmpresa(form: EmpresaForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const normalized: EmpresaForm = {
    ...form,
    nombre:                   toDbString(form.nombre),
    razon_social:             toDbString(form.razon_social),
    identificaion_tributaria: toDbString(form.identificaion_tributaria),
    pais:                     toDbString(form.pais),
    departamento:             toDbString(form.departamento),
    municipio:                toDbString(form.municipio),
    direccion:                toDbString(form.direccion),
    codigo_postal:            toDbString(form.codigo_postal),
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_empresa')
    .insert({
      ...normalized,
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
    tabla: 't_empresa', operacion: 'INSERT', cuenta,
    codigo: (data as Empresa).codigo,
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/empresas')
  revalidatePath('/dashboard')
  return {}
}

export async function updateEmpresa(codigo: number, form: Partial<EmpresaForm>, lastModified?: string): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Capturar estado anterior para auditoría
  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_empresa')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('codigo', codigo)
    .single()

  const normalized: Partial<EmpresaForm> = { ...form }
  const strFields = ['nombre', 'razon_social', 'identificaion_tributaria', 'pais', 'departamento', 'municipio', 'direccion', 'codigo_postal'] as const
  for (const key of strFields) {
    if (typeof normalized[key] === 'string') {
      (normalized as Record<string, unknown>)[key] = toDbString(normalized[key] as string)
    }
  }

  const now = new Date().toISOString()
  let query = admin
    .schema('cartera')
    .from('t_empresa')
    .update({ ...normalized, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta)
    .eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()

  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit(admin, {
    tabla: 't_empresa', operacion: 'UPDATE', cuenta, codigo,
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/empresas')
  return {}
}

export async function deleteEmpresa(codigo: number): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Capturar estado anterior
  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_empresa')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('codigo', codigo)
    .single()

  const { error } = await admin
    .schema('cartera')
    .from('t_empresa')
    .delete()
    .eq('cuenta', cuenta)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_empresa', operacion: 'DELETE', cuenta, codigo,
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/empresas')
  revalidatePath('/dashboard')
  return {}
}
