'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SerieFactura, SerieFacturaForm } from '@/lib/types/series-facturas'
import { requirePermiso, getCuentaActiva } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'

const COLUMNS = 'cuenta, empresa, proyecto, serie, gface, id_docto_gface, establecimiento, dispositivo, carpeta_dtes, formato, predeterminado, activo, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha'

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asSmallint(value: number, label: string): { error: string } | { value: number } {
  if (!Number.isInteger(value) || value < 0 || value > 32767) {
    return { error: `${label} debe ser un entero entre 0 y 32767.` }
  }
  return { value }
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

function parseForm(form: SerieFacturaForm): { error: string } | {
  value: {
    serie: string
    gface: number
    id_docto_gface: string | null
    establecimiento: number
    dispositivo: number
    carpeta_dtes: string | null
    formato: number
    predeterminado: number
    activo: number
  }
} {
  if (!form.empresa) return { error: 'La empresa es requerida.' }
  if (!form.proyecto) return { error: 'El proyecto es requerido.' }
  const serie = normalizeText(form.serie ?? '')
  if (!serie) return { error: 'La serie es requerida.' }

  const formato = asSmallint(form.formato, 'Formato')
  if ('error' in formato) return formato
  const establecimiento = asSmallint(form.establecimiento, 'Establecimiento')
  if ('error' in establecimiento) return establecimiento
  const dispositivo = asSmallint(form.dispositivo, 'Dispositivo')
  if ('error' in dispositivo) return dispositivo
  if (!Number.isInteger(form.gface) || form.gface < 0) {
    return { error: 'El certificador seleccionado no es valido.' }
  }

  return {
    value: {
      serie,
      gface: form.gface,
      id_docto_gface: blankToNull(normalizeText(form.id_docto_gface ?? '')),
      establecimiento: establecimiento.value,
      dispositivo: dispositivo.value,
      carpeta_dtes: blankToNull(form.carpeta_dtes),
      formato: formato.value,
      predeterminado: form.predeterminado === 1 ? 1 : 0,
      activo: form.activo === 1 ? 1 : 0,
    },
  }
}

async function gfaceExiste(
  admin: ReturnType<typeof createAdminClient>,
  cuenta: string,
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  if (codigo === 0) return {}
  const { data, error } = await admin
    .schema('cartera')
    .from('t_gface')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'El certificador seleccionado no existe en este proyecto.' }
  return {}
}

async function quitarPredeterminado(
  admin: ReturnType<typeof createAdminClient>,
  cuenta: string,
  empresa: number,
  proyecto: number,
  serie: string,
) {
  await admin
    .schema('cartera')
    .from('t_serie_factura')
    .update({ predeterminado: 0 })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .neq('serie', serie)
}

function refrescar() {
  revalidatePath('/dashboard/cuentas-cobrar/series-facturas')
  revalidatePath('/dashboard/cuentas-cobrar/series-recibos')
}

export async function getSeriesFacturas(): Promise<SerieFactura[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .select(COLUMNS)
    .eq('cuenta', cuenta)
    .order('empresa')
    .order('proyecto')
    .order('serie')
  if (error) throw new Error(error.message)
  return data as SerieFactura[]
}

export async function createSerieFactura(form: SerieFacturaForm): Promise<{ error?: string }> {
  const guard = await requirePermiso(PERMISOS.SER_FAC, 'agregar')
  if (guard) return guard

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const parsed = parseForm(form)
  if ('error' in parsed) return parsed
  const value = parsed.value

  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const gface = await gfaceExiste(admin, cuenta, form.empresa, form.proyecto, value.gface)
  if (gface.error) return gface

  const { data: existente, error: dupError } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .select('serie')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .eq('serie', value.serie)
    .maybeSingle()
  if (dupError) return { error: dupError.message }
  if (existente) return { error: 'Ya existe una serie con ese código en este proyecto.' }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .insert({
      cuenta,
      empresa: form.empresa,
      proyecto: form.proyecto,
      serie: value.serie,
      gface: value.gface,
      id_docto_gface: value.id_docto_gface,
      establecimiento: value.establecimiento,
      dispositivo: value.dispositivo,
      carpeta_dtes: value.carpeta_dtes,
      formato: value.formato,
      predeterminado: value.predeterminado,
      activo: value.activo,
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select(COLUMNS)
    .single()

  if (error) return { error: error.message }

  if (value.predeterminado === 1) {
    await quitarPredeterminado(admin, cuenta, form.empresa, form.proyecto, value.serie)
  }

  await writeAudit(admin, {
    tabla: 't_serie_factura',
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, serie: value.serie },
    datoAntes: null,
    datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  refrescar()
  return {}
}

export async function updateSerieFactura(
  empresa: number,
  proyecto: number,
  serie: string,
  form: SerieFacturaForm,
  lastModified?: string,
): Promise<{ error?: string }> {
  const guard = await requirePermiso(PERMISOS.SER_FAC, 'modificar')
  if (guard) return guard

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const parsed = parseForm(form)
  if ('error' in parsed) return parsed
  const value = parsed.value

  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const gface = await gfaceExiste(admin, cuenta, empresa, proyecto, value.gface)
  if (gface.error) return gface

  const { data: oldRow, error: oldError } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .select(COLUMNS)
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
    .maybeSingle()
  if (oldError) return { error: oldError.message }
  if (!oldRow) return { error: 'La serie ya no existe.' }

  const now = new Date().toISOString()
  let query = admin
    .schema('cartera')
    .from('t_serie_factura')
    .update({
      gface: value.gface,
      id_docto_gface: value.id_docto_gface,
      establecimiento: value.establecimiento,
      dispositivo: value.dispositivo,
      carpeta_dtes: value.carpeta_dtes,
      formato: value.formato,
      predeterminado: value.predeterminado,
      activo: value.activo,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select(COLUMNS)
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  if (value.predeterminado === 1) {
    await quitarPredeterminado(admin, cuenta, empresa, proyecto, serie)
  }

  await writeAudit(admin, {
    tabla: 't_serie_factura',
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, serie },
    datoAntes: oldRow as Record<string, unknown>,
    datoDespues: (data as Record<string, unknown>[])[0] ?? null,
    ...auditUser,
  })

  refrescar()
  return {}
}

export async function deleteSerieFactura(
  empresa: number,
  proyecto: number,
  serie: string,
): Promise<{ error?: string }> {
  const guard = await requirePermiso(PERMISOS.SER_FAC, 'eliminar')
  if (guard) return guard

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { count: recibos, error: recibosError } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('serie', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie_factura', serie)
  if (recibosError) return { error: recibosError.message }
  if ((recibos ?? 0) > 0) {
    return { error: 'No se puede eliminar esta serie porque tiene series de recibos asociadas.' }
  }

  const { count: facturas, error: facturasError } = await admin
    .schema('cartera')
    .from('t_factura')
    .select('factura', { count: 'exact', head: true })
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
  if (facturasError) return { error: facturasError.message }
  if ((facturas ?? 0) > 0) {
    return { error: 'No se puede eliminar esta serie porque tiene facturas asociadas.' }
  }

  const { data: oldRow, error: oldError } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .select(COLUMNS)
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
    .maybeSingle()
  if (oldError) return { error: oldError.message }

  const { error } = await admin
    .schema('cartera')
    .from('t_serie_factura')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
  if (error) return { error: error.message }

  await writeAudit(admin, {
    tabla: 't_serie_factura',
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, serie },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: null,
    ...auditUser,
  })

  refrescar()
  return {}
}
