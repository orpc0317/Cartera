'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PromesaDocumento } from '@/lib/types/promesa-documentos'
import { requirePermiso, getCuentaActiva } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'

const BUCKET          = 'promesa-documentos'
const MAX_BYTES        = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPE     = 'application/pdf'
const SIGNED_URL_TTL    = 60 // segundos de validez de la URL firmada

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

/** El PDF siempre inicia con la firma `%PDF-` (0x25 0x50 0x44 0x46 0x2D). */
function verifyPdfMagicBytes(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 &&
    buffer[3] === 0x46 && buffer[4] === 0x2D
  )
}

// ─── Lectura ───────────────────────────────────────────────────────────────

export async function getPromesaDocumentos(empresa: number, proyecto: number, promesa: number): Promise<PromesaDocumento[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_promesa_documentos')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', promesa)
    .order('secuencia')

  if (error) throw new Error(error.message)
  return (data ?? []) as PromesaDocumento[]
}

/** URL firmada de corta duración para ver el PDF — el bucket es privado, nunca hay URL pública fija. */
export async function getPromesaDocumentoUrl(
  empresa: number,
  proyecto: number,
  promesa: number,
  secuencia: number,
): Promise<{ url?: string; error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = createAdminClient()
  const { data: doc } = await admin
    .schema('cartera')
    .from('t_promesa_documentos')
    .select('archivo_path')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', promesa)
    .eq('secuencia', secuencia)
    .maybeSingle()

  if (!doc) return { error: 'El documento ya no existe.' }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl((doc as { archivo_path: string }).archivo_path, SIGNED_URL_TTL)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─── Cargar ────────────────────────────────────────────────────────────────

export async function uploadPromesaDocumento(
  formData: FormData,
  empresa: number,
  proyecto: number,
  promesa: number,
  tipoDocumento: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.PRE_OPE, 'modificar')
  if (permCheck) return permCheck

  if (!tipoDocumento) return { error: 'Selecciona el tipo de documento.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo no recibido.' }

  // Validar MIME type contra lista blanca
  if (file.type !== ALLOWED_TYPE) return { error: 'Formato no permitido. Solo se aceptan archivos PDF.' }

  // Validar tamaño
  if (file.size > MAX_BYTES) return { error: 'El archivo supera el tamaño máximo de 10 MB.' }

  // Leer bytes y verificar magic bytes — el file.type puede ser falsificado desde el cliente
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)
  if (!verifyPdfMagicBytes(buffer)) return { error: 'El contenido del archivo no coincide con el tipo declarado.' }

  const admin = createAdminClient()

  // Nombre de archivo generado — nunca el nombre original del usuario
  const path = `${cuenta}/${empresa}/${proyecto}/${promesa}/${crypto.randomUUID()}.pdf`

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: ALLOWED_TYPE, upsert: false })

  if (uploadError) return { error: uploadError.message }

  const auditUser = await getAuditUser()

  const { data, error } = await admin
    .schema('cartera')
    .from('t_promesa_documentos')
    .insert({
      cuenta,
      empresa,
      proyecto,
      promesa,
      tipo_documento: tipoDocumento,
      archivo_path: path,
      nombre_archivo: file.name,
      tamano: file.size,
      agrego_usuario: auditUser.userId,
      agrego_fecha: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    // La subida ya se hizo — si el INSERT falla, eliminar el archivo huérfano.
    await admin.storage.from(BUCKET).remove([path]).catch(() => {})
    return { error: error.message }
  }

  await writeAudit(admin, {
    tabla: 't_promesa_documentos',
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa, proyecto, promesa, secuencia: (data as PromesaDocumento).secuencia },
    datoAntes: null,
    datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  return {}
}

// ─── Eliminar ──────────────────────────────────────────────────────────────

export async function deletePromesaDocumento(
  empresa: number,
  proyecto: number,
  promesa: number,
  secuencia: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.PRE_OPE, 'eliminar')
  if (permCheck) return permCheck

  const admin = createAdminClient()

  const { data: existing } = await admin
    .schema('cartera')
    .from('t_promesa_documentos')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', promesa)
    .eq('secuencia', secuencia)
    .maybeSingle()

  if (!existing) return { error: 'El documento ya no existe.' }

  const { error } = await admin
    .schema('cartera')
    .from('t_promesa_documentos')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', promesa)
    .eq('secuencia', secuencia)

  if (error) return { error: error.message }

  await admin.storage.from(BUCKET).remove([(existing as PromesaDocumento).archivo_path]).catch(() => {})

  const auditUser = await getAuditUser()
  await writeAudit(admin, {
    tabla: 't_promesa_documentos',
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, promesa, secuencia },
    datoAntes: existing as Record<string, unknown>,
    datoDespues: null,
    ...auditUser,
  })

  return {}
}
