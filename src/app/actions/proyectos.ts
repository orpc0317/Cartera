'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { Proyecto, ProyectoForm } from '@/lib/types/proyectos'

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

export async function getProyectos(empresa?: number): Promise<Proyecto[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_proyecto')
    .select('*')
    .eq('cuenta', cuenta)
    .order('nombre')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Proyecto[]
}

export async function createProyecto(form: ProyectoForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: max } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  const codigo = (max?.codigo ?? 0) + 1
  const now = new Date().toISOString()

  const STR_FIELDS = ['nombre', 'pais', 'departamento', 'municipio', 'direccion', 'codigo_postal'] as const
  const normalized: ProyectoForm = { ...form }
  for (const key of STR_FIELDS) {
    if (typeof normalized[key] === 'string') {
      (normalized as Record<string, unknown>)[key] = toDbString(normalized[key] as string)
    }
  }

  // Validar nombre duplicado dentro de la misma empresa
  const { data: existente } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('nombre', normalized.nombre)
    .maybeSingle()
  if (existente) return { error: 'Ya existe un proyecto con ese nombre en esta empresa.' }

  const { data, error } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .insert({
      ...normalized,
      cuenta,
      codigo,
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_proyecto', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/proyectos')
  revalidatePath('/dashboard')
  return {}
}

export async function updateProyecto(
  empresa: number,
  codigo: number,
  form: Partial<ProyectoForm>,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)
    .single()

  const now = new Date().toISOString()

  const STR_FIELDS = ['nombre', 'pais', 'departamento', 'municipio', 'direccion', 'codigo_postal'] as const
  const normalized: Partial<ProyectoForm> = { ...form }
  for (const key of STR_FIELDS) {
    if (typeof normalized[key] === 'string') {
      (normalized as Record<string, unknown>)[key] = toDbString(normalized[key] as string)
    }
  }

  // Validar nombre duplicado dentro de la misma empresa (excluyendo el registro actual)
  if (normalized.nombre) {
    const { data: existente } = await admin
      .schema('cartera')
      .from('t_proyecto')
      .select('codigo')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('nombre', normalized.nombre)
      .neq('codigo', codigo)
      .maybeSingle()
    if (existente) return { error: 'Ya existe un proyecto con ese nombre en esta empresa.' }
  }

  let query = admin
    .schema('cartera')
    .from('t_proyecto')
    .update({ ...normalized, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit(admin, {
    tabla: 't_proyecto', operacion: 'UPDATE', cuenta,
    registroId: { empresa, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/proyectos')
  return {}
}

export async function deleteProyecto(empresa: number, codigo: number): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)
    .single()

  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_proyecto', operacion: 'DELETE', cuenta,
    registroId: { empresa, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/proyectos')
  revalidatePath('/dashboard')
  return {}
}

// ─── Logo ──────────────────────────────────────────────────────────────────

const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const LOGO_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const LOGO_BUCKET = 'project-logos'

export async function uploadProjectLogo(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo no recibido.' }

  // Server-side validation (defense-in-depth, client also validates)
  if (!LOGO_ALLOWED_TYPES.includes(file.type))
    return { error: 'Formato no permitido. Use PNG, JPG, WebP o SVG.' }
  if (file.size > LOGO_MAX_BYTES)
    return { error: 'El archivo supera el tamaño máximo de 5 MB.' }

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
  const path = `${cuenta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) return { error: error.message }

  const { data } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}
