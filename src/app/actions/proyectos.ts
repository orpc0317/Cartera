'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toDbString } from '@/lib/utils'
import type { Proyecto, ProyectoForm, ProyectoMoneda } from '@/lib/types/proyectos'

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

export async function createProyecto(form: ProyectoForm): Promise<{ error?: string; codigo?: number }> {
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

  const STR_FIELDS = ['nombre', 'direccion_pais', 'direccion_departamento', 'direccion_municipio', 'direccion', 'codigo_postal'] as const
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
  return { codigo }
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

  const STR_FIELDS = ['nombre', 'direccion_pais', 'direccion_departamento', 'direccion_municipio', 'direccion', 'codigo_postal'] as const
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

  // Verificar restricciones referenciales antes de eliminar
  const [
    { count: cFase },
    { count: cSerie },
    { count: cCuentaBancaria },
    { count: cSupervisor },
    { count: cCobrador },
    { count: cCliente },
    { count: cPromesa },
  ] = await Promise.all([
    admin.schema('cartera').from('t_fase').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
    admin.schema('cartera').from('t_serie_recibo').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
    admin.schema('cartera').from('t_cuenta_bancaria').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
    admin.schema('cartera').from('t_supervisor').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
    admin.schema('cartera').from('t_cobrador').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
    admin.schema('cartera').from('t_cliente').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
    admin.schema('cartera').from('t_promesa').select('*', { count: 'exact', head: true }).eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', codigo),
  ])
  if ((cFase ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene fases registradas.' }
  if ((cSerie ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene series de recibos registradas.' }
  if ((cCuentaBancaria ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene cuentas bancarias registradas.' }
  if ((cSupervisor ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene supervisores registrados.' }
  if ((cCobrador ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene cobradores registrados.' }
  if ((cCliente ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene clientes registrados.' }
  if ((cPromesa ?? 0) > 0) return { error: 'No se puede eliminar: el proyecto tiene promesas de venta registradas.' }

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

/** Verifica que los primeros bytes del archivo coincidan con el tipo MIME declarado. */
function verifyMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/png':
      return (
        buffer[0] === 0x89 && buffer[1] === 0x50 &&
        buffer[2] === 0x4E && buffer[3] === 0x47
      )
    case 'image/jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
      )
    case 'image/svg+xml':
      return true // SVG es texto XML; no tiene magic bytes fijos
    default:
      return false
  }
}

/** Extrae la ruta relativa al bucket desde una URL pública de Supabase Storage. */
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = publicUrl.indexOf(marker)
    return idx >= 0 ? decodeURIComponent(publicUrl.slice(idx + marker.length)) : null
  } catch { return null }
}

export async function uploadProjectLogo(
  formData: FormData,
  oldUrl?: string,
): Promise<{ url?: string; error?: string }> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo no recibido.' }

  // Validar MIME type contra lista blanca
  if (!LOGO_ALLOWED_TYPES.includes(file.type))
    return { error: 'Formato no permitido. Use PNG, JPG, WebP o SVG.' }

  // Validar tamaño
  if (file.size > LOGO_MAX_BYTES)
    return { error: 'El archivo supera el tamaño máximo de 5 MB.' }

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  // Leer bytes antes de subir para verificar magic bytes
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Verificar magic bytes — el file.type puede ser falsificado desde el cliente
  if (!verifyMagicBytes(buffer, file.type))
    return { error: 'El contenido del archivo no coincide con el tipo declarado.' }

  // Nombre de archivo generado — nunca usar el nombre original del usuario
  const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
  const path = `${cuenta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) return { error: error.message }

  // Eliminar archivo anterior (best-effort — no falla si no existe o si la URL es inválida)
  if (oldUrl) {
    const oldPath = extractStoragePath(oldUrl, LOGO_BUCKET)
    if (oldPath) await admin.storage.from(LOGO_BUCKET).remove([oldPath]).catch(() => {})
  }

  const { data } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}

// ─── Monedas por Proyecto ─────────────────────────────────────────────────────

export async function getProyectoMonedas(): Promise<ProyectoMoneda[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .select('*')
    .eq('cuenta', cuenta)
    .order('predeterminado', { ascending: false })
    .order('moneda')
  if (error) throw new Error(error.message)
  return (data ?? []) as ProyectoMoneda[]
}

export async function addProyectoMoneda(
  empresa: number,
  proyecto: number,
  moneda: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  // Validar duplicado
  const { data: existing } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .select('moneda')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)
    .maybeSingle()
  if (existing) return { error: 'Esta moneda ya está registrada en el proyecto.' }

  // Primera moneda del proyecto → predeterminada automáticamente
  const { count } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .select('*', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)

  const esPrimera = (count ?? 0) === 0
  const now = new Date().toISOString()

  const payload = {
    cuenta,
    empresa,
    proyecto,
    moneda,
    predeterminado: esPrimera ? 1 : 0,
    activo: 1,
    agrego_usuario: auditUser.userId,
    agrego_fecha: now,
  }

  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .insert(payload)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_proyecto_moneda', operacion: 'INSERT', cuenta,
    registroId: { empresa, proyecto, moneda },
    datoAntes: null, datoDespues: payload as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/proyectos')
  return {}
}

export async function toggleProyectoMonedaActivo(
  empresa: number,
  proyecto: number,
  moneda: string,
  nuevoActivo: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: row } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)
    .maybeSingle()

  if (!row) return { error: 'Moneda no encontrada en el proyecto.' }
  if (nuevoActivo === 0 && row.predeterminado === 1)
    return { error: 'No se puede desactivar la moneda predeterminada del proyecto.' }

  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .update({ activo: nuevoActivo })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)

  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_proyecto_moneda', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, moneda },
    datoAntes: row as Record<string, unknown>,
    datoDespues: { ...row, activo: nuevoActivo } as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/proyectos')
  return {}
}

export async function setProyectoMonedaPredeterminada(
  empresa: number,
  proyecto: number,
  moneda: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const admin = createAdminClient()

  const { data: row } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .select('activo, predeterminado')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)
    .maybeSingle()

  if (!row) return { error: 'Moneda no encontrada en el proyecto.' }
  if (row.activo !== 1) return { error: 'Solo se puede marcar como predeterminada una moneda activa.' }

  // Quitar predeterminado a la actual
  await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .update({ predeterminado: 0 })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)

  // Marcar la nueva como predeterminada
  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto_moneda')
    .update({ predeterminado: 1 })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('moneda', moneda)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/proyectos/proyectos')
  return {}
}
