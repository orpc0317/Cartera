'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clienteDatos } from '@/lib/supabase/datos'
import type { Gface, GfaceForm } from '@/lib/types/gface'
import type { NombresVer } from '@/lib/registro-ver'
import { filaConNombres } from '@/lib/leer-nombres'
import { requirePermiso, getCuentaActiva, leerAcceso, exigirProyecto } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { restringirProyecto } from '@/lib/acceso-proyecto'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

function normalizeNombre(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function secretToNull(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return value
}

function ilikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function quitarSecretos<T extends { token?: string | null; certificado_contrasena?: string | null }>(row: T) {
  return {
    ...row,
    token_configurado: Boolean(row.token),
    certificado_configurado: Boolean(row.certificado_contrasena),
    token: null,
    certificado_contrasena: null,
  }
}

function sinSecretoVacio(value: GfaceWrite): Partial<GfaceWrite> {
  const next: Partial<GfaceWrite> = { ...value }
  if (!next.token) delete next.token
  if (!next.certificado_contrasena) delete next.certificado_contrasena
  return next
}

function omitSecrets(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null
  const copy = { ...row }
  delete copy.token
  delete copy.certificado_contrasena
  return copy
}

type GfaceWrite = {
  nombre: string
  requestor: string | null
  entity: string | null
  user_name: string | null
  token: string | null
  web_service: string | null
  web_service_documento: string | null
  certificado_post: string | null
  certificado_ruta: string | null
  certificado_nombre: string | null
  certificado_contrasena: string | null
  correo_envio: string | null
  correo_copia: string | null
  primera_firma: number
  validar_identificacion: number
}

function validateForm(form: GfaceForm): { error: string } | { value: GfaceWrite } {
  const nombre = normalizeNombre(form.nombre ?? '')
  if (!nombre) return { error: 'El nombre es requerido.' }
  if (!form.empresa) return { error: 'La empresa es requerida.' }
  if (!form.proyecto) return { error: 'El proyecto es requerido.' }

  const correoEnvio = blankToNull(form.correo_envio)
  const correoCopia = blankToNull(form.correo_copia)
  if (correoEnvio && !isValidEmail(correoEnvio)) {
    return { error: 'El correo electrónico no tiene un formato válido.' }
  }
  if (correoCopia && !isValidEmail(correoCopia)) {
    return { error: 'El correo electrónico no tiene un formato válido.' }
  }

  const value: GfaceWrite = {
    nombre,
    requestor: blankToNull(form.requestor),
    entity: blankToNull(form.entity),
    user_name: blankToNull(form.user_name),
    token: secretToNull(form.token),
    web_service: blankToNull(form.web_service),
    web_service_documento: blankToNull(form.web_service_documento),
    certificado_post: blankToNull(form.certificado_post),
    certificado_ruta: blankToNull(form.certificado_ruta),
    certificado_nombre: blankToNull(form.certificado_nombre),
    certificado_contrasena: secretToNull(form.certificado_contrasena),
    correo_envio: correoEnvio,
    correo_copia: correoCopia,
    primera_firma: form.primera_firma === 1 ? 1 : 0,
    validar_identificacion: form.validar_identificacion === 1 ? 1 : 0,
  }

  const limits: [string | null, number, string][] = [
    [value.nombre, 100, 'El nombre'],
    [value.requestor, 50, 'Requestor'],
    [value.entity, 25, 'Entidad'],
    [value.user_name, 25, 'Usuario'],
    [value.token, 50, 'Token'],
    [value.web_service, 100, 'Servicio Web'],
    [value.web_service_documento, 100, 'Servicio Web de Documento'],
    [value.certificado_post, 100, 'Certificado Post'],
    [value.certificado_ruta, 100, 'Ruta del Certificado'],
    [value.certificado_nombre, 50, 'Nombre del Certificado'],
    [value.certificado_contrasena, 25, 'Contrasena del Certificado'],
    [value.correo_envio, 50, 'Correo de Envio'],
    [value.correo_copia, 50, 'Correo Copia'],
  ]
  for (const [field, max, label] of limits) {
    if (field && field.length > max) return { error: `${label} no puede superar ${max} caracteres.` }
  }

  return { value }
}

async function getAuditUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, email: null, nombre: null }
  const { data } = await supabase
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
  const admin = createAdminClient()
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

const GFACE_COLUMNS = 'cuenta, empresa, proyecto, codigo, nombre, requestor, entity, user_name, web_service, web_service_documento, certificado_post, certificado_ruta, certificado_nombre, correo_envio, correo_copia, primera_firma, validar_identificacion, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha'

type MarcaSecreto = {
  empresa: number
  proyecto: number
  codigo: number
  token_configurado: boolean
  certificado_configurado: boolean
}

async function marcasSecreto(): Promise<MarcaSecreto[]> {
  const datos = await clienteDatos()
  const { data, error } = await datos.schema('cartera').rpc('fn_gface_configurado')
  if (error) throw new Error(error.message)
  return (data ?? []) as MarcaSecreto[]
}

function conMarcas<T extends { empresa: number; proyecto: number; codigo: number; token?: string | null; certificado_contrasena?: string | null }>(
  rows: T[],
  marcas: MarcaSecreto[],
): T[] {
  const porClave = new Map(marcas.map((marca) => [`${marca.empresa}:${marca.proyecto}:${marca.codigo}`, marca]))
  return rows.map((row) => {
    const limpio = quitarSecretos(row)
    const marca = porClave.get(`${row.empresa}:${row.proyecto}:${row.codigo}`)
    if (!marca) return limpio as T
    return {
      ...limpio,
      token_configurado: marca.token_configurado,
      certificado_configurado: marca.certificado_configurado,
    } as T
  })
}

export async function getGfaces(empresa?: number, proyecto?: number): Promise<(Gface & NombresVer)[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = await clienteDatos()
  let query = admin
    .schema('cartera')
    .from('v_gface_lista')
    .select(`${GFACE_COLUMNS}, empresa_nombre, proyecto_nombre`)
    .eq('cuenta', acceso.cuenta)
    .order('empresa')
    .order('proyecto')
    .order('nombre')
  const acotada = restringirProyecto(query, acceso, { empresa, proyecto })
  if (!acotada) return []
  query = acotada
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return conMarcas(data as (Gface & NombresVer)[], await marcasSecreto())
}

export async function obtenerGface(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ row?: Gface & NombresVer; error?: string }> {
  const guard = await requirePermiso(PERMISOS.GFA_CAT, 'consultar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const result = await filaConNombres<Gface>(
    await clienteDatos(), cuenta, 't_gface',
    { cuenta, empresa, proyecto, codigo }, GFACE_COLUMNS,
    { empresa, proyecto },
  )
  if (result.row) return { row: conMarcas([result.row], await marcasSecreto())[0] }
  return result
}

export async function createGface(form: GfaceForm): Promise<{ error?: string }> {
  const guard = await requirePermiso(PERMISOS.GFA_CAT, 'agregar')
  if (guard) return guard
  const alcance = await exigirProyecto(form.empresa, form.proyecto)
  if (alcance) return alcance

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const parsed = validateForm(form)
  if ('error' in parsed) return parsed
  const value = parsed.value

  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]

  const { data: existente, error: dupError } = await admin
    .schema('cartera')
    .from('t_gface')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .ilike('nombre', ilikeLiteral(value.nombre))
    .maybeSingle()
  if (dupError) return { error: dupError.message }
  if (existente) return { error: 'Ya existe un certificador con ese nombre en este proyecto.' }

  const { data: maxRow, error: maxError } = await admin
    .schema('cartera')
    .from('t_gface')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxError) return { error: maxError.message }

  const codigo = ((maxRow as { codigo: number } | null)?.codigo ?? 0) + 1
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema('cartera')
    .from('t_gface')
    .insert({
      ...value,
      cuenta,
      empresa: form.empresa,
      proyecto: form.proyecto,
      codigo,
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select(GFACE_COLUMNS)
    .single()

  if (error) return { error: error.message }

  await writeAudit({
    tabla: 't_gface',
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, codigo },
    datoAntes: null,
    datoDespues: omitSecrets(data as Record<string, unknown>),
    ...auditUser,
  })

  revalidatePath('/dashboard/generales/gface')
  return {}
}

export async function updateGface(
  empresa: number,
  proyecto: number,
  codigo: number,
  form: GfaceForm,
  lastModified?: string,
): Promise<{ error?: string; row?: Gface }> {
  const guard = await requirePermiso(PERMISOS.GFA_CAT, 'modificar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const parsed = validateForm(form)
  if ('error' in parsed) return parsed
  const value = parsed.value

  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]

  const { data: oldRow, error: oldError } = await admin
    .schema('cartera')
    .from('t_gface')
    .select(GFACE_COLUMNS)
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .maybeSingle()
  if (oldError) return { error: oldError.message }
  if (!oldRow) return { error: 'El registro no existe.' }

  const { data: existente, error: dupError } = await admin
    .schema('cartera')
    .from('t_gface')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .ilike('nombre', ilikeLiteral(value.nombre))
    .neq('codigo', codigo)
    .maybeSingle()
  if (dupError) return { error: dupError.message }
  if (existente) return { error: 'Ya existe un certificador con ese nombre en este proyecto.' }

  const now = new Date().toISOString()

  let query = admin
    .schema('cartera')
    .from('t_gface')
    .update({
      ...sinSecretoVacio(value),
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select(GFACE_COLUMNS)
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit({
    tabla: 't_gface',
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: omitSecrets(oldRow as Record<string, unknown>),
    datoDespues: omitSecrets((data?.[0] ?? null) as Record<string, unknown> | null),
    ...auditUser,
  })

  revalidatePath('/dashboard/generales/gface')
  return { row: conMarcas([data[0] as Gface], await marcasSecreto())[0] }
}

export async function deleteGface(
  empresa: number,
  proyecto: number,
  codigo: number,
): Promise<{ error?: string }> {
  const guard = await requirePermiso(PERMISOS.GFA_CAT, 'eliminar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]

  const { data: oldRow, error: oldError } = await admin
    .schema('cartera')
    .from('t_gface')
    .select(GFACE_COLUMNS)
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)
    .maybeSingle()
  if (oldError) return { error: oldError.message }

  const { error } = await admin
    .schema('cartera')
    .from('t_gface')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit({
    tabla: 't_gface',
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, codigo },
    datoAntes: omitSecrets(oldRow as Record<string, unknown> | null),
    datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/generales/gface')
  return {}
}
