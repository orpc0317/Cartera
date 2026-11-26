'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clienteDatos } from '@/lib/supabase/datos'
import type { Lote, LoteForm, SerieRecibo } from '@/lib/types/proyectos'
import type { NombresVer } from '@/lib/registro-ver'
import { filaConNombres, leerNombres } from '@/lib/leer-nombres'
import { requirePermiso, getCuentaActiva, leerAcceso, exigirProyecto } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { restringirProyecto } from '@/lib/acceso-proyecto'

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

export async function getLotes(empresa?: number, proyecto?: number, fase?: number, manzana?: string): Promise<(Lote & NombresVer)[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = await clienteDatos()
  let query = admin
    .schema('cartera')
    .from('v_lote_lista')
    .select('cuenta, empresa, proyecto, fase, manzana, codigo, moneda, valor, extension, finca, folio, libro, norte, sur, este, oeste, otro, promesa, recibo_serie, recibo_numero, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha, empresa_nombre, proyecto_nombre, fase_nombre')
    .eq('cuenta', acceso.cuenta)
    .order('empresa').order('proyecto').order('fase').order('manzana').order('codigo')
  const acotada = restringirProyecto(query, acceso, { empresa, proyecto })
  if (!acotada) return []
  query = acotada
  if (fase !== undefined) query = query.eq('fase', fase)
  if (manzana !== undefined) query = query.eq('manzana', manzana)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as (Lote & NombresVer)[]
}

export async function obtenerLote(
  empresa: number,
  proyecto: number,
  fase: number,
  manzana: string,
  codigo: string,
): Promise<{ row?: Lote & NombresVer; error?: string }> {
  const guard = await requirePermiso(PERMISOS.LOT_CAT, 'consultar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  return filaConNombres<Lote>(
    await clienteDatos(), cuenta, 't_lote',
    { cuenta, empresa, proyecto, fase, manzana, codigo }, 'cuenta, empresa, proyecto, fase, manzana, codigo, moneda, valor, extension, finca, folio, libro, norte, sur, este, oeste, otro, promesa, recibo_serie, recibo_numero, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha',
    { empresa, proyecto, fase },
  )
}

export async function getSeriesRecibo(): Promise<SerieRecibo[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = await clienteDatos()
  const consulta = admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('cuenta, empresa, proyecto, serie, serie_factura, dias_fecha, correlativo, formato, predeterminado, recibo_automatico, activo, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', acceso.cuenta)
    .order('serie')
  const acotada = restringirProyecto(consulta, acceso)
  if (!acotada) return []
  const { data, error } = await acotada
  if (error) throw new Error(error.message)
  return data as SerieRecibo[]
}

export async function getLotesDisponibles(empresa?: number, proyecto?: number): Promise<Lote[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = await clienteDatos()
  let query = admin
    .schema('cartera')
    .from('t_lote')
    .select('cuenta, empresa, proyecto, fase, manzana, codigo, moneda, valor, extension, finca, folio, libro, norte, sur, este, oeste, otro, promesa, recibo_serie, recibo_numero, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', acceso.cuenta)
    .eq('promesa', 0)
    .eq('recibo_numero', 0)
    .order('empresa').order('proyecto').order('fase').order('manzana').order('codigo')
  const acotada = restringirProyecto(query, acceso, { empresa, proyecto })
  if (!acotada) return []
  query = acotada
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Lote[]
}

export async function createLote(form: LoteForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.LOT_CAT, 'agregar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(form.empresa, form.proyecto)
  if (alcance) return alcance
  if (!form.empresa) return { error: 'Selecciona la empresa.' }
  if (!form.proyecto) return { error: 'Selecciona el proyecto.' }
  if (!form.fase) return { error: 'Selecciona la fase.' }
  if (!form.manzana.trim()) return { error: 'Selecciona la manzana.' }
  if (!form.codigo.trim()) return { error: 'El codigo es requerido.' }
  if (!form.moneda.trim()) return { error: 'Selecciona la moneda.' }
  if (!Number.isFinite(form.valor)) return { error: 'El precio de venta es requerido.' }
  if (!Number.isFinite(form.extension)) return { error: 'La extension es requerida.' }
  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema('cartera')
    .from('t_lote')
    .insert({
      ...form,
      cuenta,
      promesa: 0,
      agrego_usuario: auditUser.userId,
      agrego_fecha: now,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un lote con ese codigo.' }
    return { error: error.message }
  }

  await writeAudit({
    tabla: 't_lote', operacion: 'INSERT', cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, fase: form.fase, manzana: form.manzana, codigo: form.codigo },
    datoAntes: null, datoDespues: data as Record<string, unknown>,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/lotes')
  revalidatePath('/dashboard')
  return {}
}

export async function updateLote(
  empresa: number, proyecto: number, fase: number, manzana: string, codigo: string,
  form: Partial<LoteForm>,
  lastModified?: string,
): Promise<{ error?: string; row?: Lote }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.LOT_CAT, 'modificar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  if (form.moneda !== undefined && !form.moneda.trim()) return { error: 'Selecciona la moneda.' }
  if (form.valor !== undefined && !Number.isFinite(form.valor)) return { error: 'El precio de venta es requerido.' }
  if (form.extension !== undefined && !Number.isFinite(form.extension)) return { error: 'La extension es requerida.' }
  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_lote')
    .select('cuenta, empresa, proyecto, fase, manzana, codigo, moneda, valor, extension, finca, folio, libro, norte, sur, este, oeste, otro, promesa, recibo_serie, recibo_numero, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('codigo', codigo)
    .single()

  const now = new Date().toISOString()
  let query = admin
    .schema('cartera')
    .from('t_lote')
    .update({ ...form, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('codigo', codigo)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { error, data } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit({
    tabla: 't_lote', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, fase, manzana, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/lotes')
  return { row: data[0] as Lote }
}

export async function deleteLote(empresa: number, proyecto: number, fase: number, manzana: string, codigo: string): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.LOT_CAT, 'eliminar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]

  // Cascade checks
  const { count: cPromesa } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('numero', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('lote', codigo)
  if (cPromesa && cPromesa > 0) return { error: 'No se puede eliminar este lote porque tiene promesas asociadas.' }

  const { count: cReserva } = await admin
    .schema('cartera')
    .from('t_reserva')
    .select('numero', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('lote', codigo)
  if (cReserva && cReserva > 0) return { error: 'No se puede eliminar este lote porque tiene reservas asociadas.' }

  const { count: cRecibo } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('numero', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('lote', codigo)
  if (cRecibo && cRecibo > 0) return { error: 'No se puede eliminar este lote porque tiene recibos asociados.' }

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_lote')
    .select('cuenta, empresa, proyecto, fase, manzana, codigo, moneda, valor, extension, finca, folio, libro, norte, sur, este, oeste, otro, promesa, recibo_serie, recibo_numero, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('codigo', codigo)
    .single()

  const { error } = await admin
    .schema('cartera')
    .from('t_lote')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('codigo', codigo)

  if (error) return { error: error.message }

  await writeAudit({
    tabla: 't_lote', operacion: 'DELETE', cuenta,
    registroId: { empresa, proyecto, fase, manzana, codigo },
    datoAntes: oldRow as Record<string, unknown> | null, datoDespues: null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/lotes')
  revalidatePath('/dashboard')
  return {}
}

// ─── Listar Reservas ──────────────────────────────────────────────────────────

export type ReservaRow = {
  cuenta:           string
  numero:           number   // PK de t_reserva
  empresa:          number
  proyecto:         number
  fase:             number
  manzana:          string
  lote:             string
  cliente:          number
  vendedor:         number
  recibo_serie:     string
  recibo_numero:    number
  estado:           number   // 1=Abierta 2=Promesa 3=Devolucion 99=Anulado
  // desde t_recibo_caja
  fecha:            string
  monto:            number
  moneda:           string
  forma_pago:       number
  banco:            number
  numero_cuenta:    string
  numero_documento: string
  cuenta_deposito:  number
  cobrador:         number
}

const LIMITE_RESERVAS = 500

export type ReservaFiltros = {
  empresa?: number
  proyecto?: number
  estado?: number | null
  numero?: number
  cliente?: string
  fechaDesde?: string
  fechaHasta?: string
}

export async function getReservas(
  filtros: ReservaFiltros = {},
): Promise<{ data: (ReservaRow & NombresVer)[]; limitReached: boolean }> {
  const acceso = await leerAcceso()
  if (!acceso) return { data: [], limitReached: false }
  const admin = await clienteDatos()
  let reservaQuery = admin
    .schema('cartera')
    .from('v_reserva_lista')
    .select('cuenta, numero, empresa, proyecto, fase, manzana, lote, cliente, vendedor, recibo_serie, recibo_numero, estado, fecha, monto, moneda, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, cobrador, empresa_nombre, proyecto_nombre, fase_nombre, cliente_nombre, vendedor_nombre, banco_nombre, cuenta_deposito_nombre')
    .eq('cuenta', acceso.cuenta)
  reservaQuery = filtros.estado === undefined
    ? reservaQuery.eq('estado', 1)
    : filtros.estado === null
      ? reservaQuery
      : reservaQuery.eq('estado', filtros.estado)
  if (filtros.numero !== undefined) reservaQuery = reservaQuery.eq('numero', filtros.numero)
  if (filtros.cliente?.trim()) reservaQuery = reservaQuery.ilike('cliente_nombre', `%${filtros.cliente.trim()}%`)
  if (filtros.fechaDesde) reservaQuery = reservaQuery.gte('fecha', filtros.fechaDesde)
  if (filtros.fechaHasta) reservaQuery = reservaQuery.lte('fecha', filtros.fechaHasta)
  reservaQuery = reservaQuery.order('numero', { ascending: false }).limit(LIMITE_RESERVAS + 1)
  const reservasAcotadas = restringirProyecto(reservaQuery, acceso, {
    empresa: filtros.empresa,
    proyecto: filtros.proyecto,
  })
  if (!reservasAcotadas) return { data: [], limitReached: false }
  const { data, error } = await reservasAcotadas
  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as (ReservaRow & NombresVer)[]).map((r) => ({ ...r, fecha: r.fecha ?? '' }))
  const limitReached = rows.length > LIMITE_RESERVAS
  return { data: limitReached ? rows.slice(0, LIMITE_RESERVAS) : rows, limitReached }
}

export async function obtenerReserva(
  empresa: number,
  proyecto: number,
  numero: number,
): Promise<{ row?: ReservaRow & NombresVer; error?: string }> {
  const guard = await requirePermiso(PERMISOS.RES_OPE, 'consultar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const admin = await clienteDatos()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_reserva')
    .select('cuenta, numero, empresa, proyecto, fase, manzana, lote, cliente, vendedor, recibo_serie, recibo_numero, estado')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Registro no encontrado.' }
  let recibo: {
    fecha?: string
    monto?: number
    moneda?: string
    forma_pago?: number
    banco?: number
    numero_cuenta?: string
    numero_documento?: string
    cuenta_deposito?: number
    cobrador?: number
  } | null = null
  if (data.recibo_numero > 0) {
    const rec = await admin
      .schema('cartera')
      .from('t_recibo_caja')
      .select('fecha, monto, moneda, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, cobrador')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('serie', data.recibo_serie)
      .eq('numero', data.recibo_numero)
      .maybeSingle()
    if (rec.error) return { error: rec.error.message }
    recibo = rec.data
  }
  const nombres = await leerNombres(admin, cuenta, {
    empresa,
    proyecto,
    fase: data.fase,
    cliente: data.cliente,
    vendedor: data.vendedor,
    banco: recibo?.banco ?? 0,
    cobrador: recibo?.cobrador ?? 0,
    cuentaDeposito: recibo?.cuenta_deposito ?? 0,
  })
  const row: ReservaRow & NombresVer = {
    cuenta,
    numero: data.numero,
    empresa: data.empresa,
    proyecto: data.proyecto,
    fase: data.fase,
    manzana: data.manzana,
    lote: data.lote,
    cliente: data.cliente,
    vendedor: data.vendedor,
    recibo_serie: data.recibo_serie ?? '',
    recibo_numero: data.recibo_numero,
    estado: data.estado,
    fecha: recibo?.fecha ?? '',
    monto: recibo?.monto ?? 0,
    moneda: recibo?.moneda ?? 'GTQ',
    forma_pago: recibo?.forma_pago ?? 0,
    banco: recibo?.banco ?? 0,
    numero_cuenta: recibo?.numero_cuenta ?? '',
    numero_documento: recibo?.numero_documento ?? '',
    cuenta_deposito: recibo?.cuenta_deposito ?? 0,
    cobrador: recibo?.cobrador ?? 0,
    ...nombres,
  }
  return { row }
}

// ─── Crear Reserva ────────────────────────────────────────────────────────────
// Llama a la función PL/pgSQL cartera.fn_crear_reserva que ejecuta todo en una
// sola transacción: t_reserva + t_recibo_caja + t_detalle_recibo_caja + t_lote.

export type CreateReservaInput = {
  empresa:           number
  proyecto:          number
  fase:              number
  manzana:           string
  lote:              string
  cliente:           number
  cliente_nombre:    string   // nombre del cliente para t_transaccion_bancaria
  fase_nombre:       string   // nombre de la fase para t_transaccion_bancaria
  vendedor:          number
  cobrador:          number
  serie_recibo:      string
  recibo:            string   // vacío cuando recibo_automatico = true
  recibo_automatico: boolean
  fecha:             string
  monto:             string   // string del input; se convierte a número aquí
  forma_pago:        number
  banco:             number
  num_cuenta:        string
  num_documento:     string
  cuenta_bancaria:   number
  moneda:            string   // moneda del lote
  tasa_cambio:       number   // tasa vigente el dia de la reserva, resuelta por la pantalla
}

export type CreateReservaResult =
  | { ok: true;  numero: number; recibo: number }
  | { ok: false; error: string }

export async function createReserva(
  form: CreateReservaInput,
  loteLastModified: string | undefined,
): Promise<CreateReservaResult> {
  const cuenta    = await getCuentaActiva()
  if (!cuenta) return { ok: false, error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.RES_OPE, 'agregar')
  if (permCheck) return { ok: false, error: permCheck.error }
  const alcance = await exigirProyecto(form.empresa, form.proyecto)
  if (alcance) return { ok: false, error: alcance.error }
  const auditUser = await getAuditUser()
  if (!auditUser.userId) return { ok: false, error: 'Usuario no autenticado.' }

  const montoNum = parseFloat(form.monto.replace(',', '.'))
  if (isNaN(montoNum) || montoNum <= 0)
    return { ok: false, error: 'Monto inválido.' }

  const reciboManual = form.recibo_automatico ? 0 : parseInt(form.recibo, 10)
  if (!form.recibo_automatico && isNaN(reciboManual))
    return { ok: false, error: 'Número de recibo inválido.' }

  if (!form.tasa_cambio || form.tasa_cambio <= 0)
    return { ok: false, error: 'La tasa de cambio debe ser mayor a cero.' }

  const privilegiado = createAdminClient()

  const { data, error } = await privilegiado
    .schema('cartera')
    .rpc('fn_crear_reserva', {
      p_cuenta:              cuenta,
      p_empresa:             form.empresa,
      p_proyecto:            form.proyecto,
      p_fase:                form.fase,
      p_manzana:             form.manzana,
      p_lote:                form.lote,
      p_cliente:             form.cliente,
      p_vendedor:            form.vendedor,
      p_cobrador:            form.cobrador,
      p_serie:               form.serie_recibo,
      p_recibo_automatico:   form.recibo_automatico ? 1 : 0,
      p_recibo_manual:       reciboManual,
      p_fecha:               form.fecha,
      p_monto:               montoNum,
      p_forma_pago:          form.forma_pago,
      p_banco:               form.banco,
      p_numero_cuenta:       form.num_cuenta,
      p_numero_documento:    form.num_documento,
      p_cuenta_deposito:     form.cuenta_bancaria,
      p_moneda:              form.moneda,
      p_tasa_cambio:         form.tasa_cambio,
      p_agrego_usuario:      auditUser.userId,
      p_lote_modifico_fecha: loteLastModified ?? '1900-01-01T00:00:00',
      p_cliente_nombre:      form.cliente_nombre,
      p_fase_nombre:         form.fase_nombre,
    })

  if (error) return { ok: false, error: error.message }

  const result = data as { ok: boolean; error?: string; numero?: number; recibo?: number }
  if (!result.ok) return { ok: false, error: result.error ?? 'Error desconocido.' }

  // fn_crear_reserva no devuelve las filas creadas (solo numero/recibo) — se
  // consultan aqui para dejar el mismo rastro de auditoria "INSERT" que tiene
  // el resto de entidades del sistema (Historial vacio en Reservas/Pagos era
  // un hueco: la creacion pasa por RPC, no por el flujo estandar create<Entidad>
  // que ya llama writeAudit automaticamente).
  const admin = await clienteDatos()
  const [{ data: nuevaReserva }, { data: nuevoRecibo }] = await Promise.all([
    admin.schema('cartera').from('t_reserva').select('cuenta, numero, empresa, proyecto, fase, manzana, lote, cliente, vendedor, recibo_serie, recibo_numero, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
      .eq('cuenta', cuenta).eq('numero', result.numero!).maybeSingle(),
    admin.schema('cartera').from('t_recibo_caja').select('cuenta, empresa, proyecto, serie, numero, fecha, promesa, reserva, cliente, fase, manzana, lote, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, transaccion_bancaria, cobrador, moneda, tasa_cambio, monto, mora, abono_capital, tipo_ingreso, factura_serie, factura_numero, observaciones, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
      .eq('cuenta', cuenta).eq('empresa', form.empresa).eq('proyecto', form.proyecto)
      .eq('serie', form.serie_recibo).eq('numero', result.recibo!).maybeSingle(),
  ])

  await Promise.all([
    writeAudit({
      tabla: 't_reserva', operacion: 'INSERT', cuenta,
      registroId: { numero: result.numero },
      datoAntes: null, datoDespues: nuevaReserva as Record<string, unknown> | null,
      ...auditUser,
    }),
    writeAudit({
      tabla: 't_recibo_caja', operacion: 'INSERT', cuenta,
      registroId: { empresa: form.empresa, proyecto: form.proyecto, serie: form.serie_recibo, numero: result.recibo },
      datoAntes: null, datoDespues: nuevoRecibo as Record<string, unknown> | null,
      ...auditUser,
    }),
  ])

  return { ok: true, numero: result.numero!, recibo: result.recibo! }
}

// ─── Info de Reserva para Lote ─────────────────────────────────────────────

export type LoteReservaInfo = {
  reserva_numero: number
  cliente_nombre: string
  fecha: string
  monto: number
  moneda: string
}

export async function getLoteReservaInfo(
  empresa: number,
  proyecto: number,
  fase: number,
  manzana: string,
  codigo: string,
): Promise<LoteReservaInfo | null> {
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return null
  const cuenta = await getCuentaActiva()
  if (!cuenta) return null
  const admin = await clienteDatos()

  const { data: reserva } = await admin
    .schema('cartera')
    .from('t_reserva')
    .select('numero, cliente, recibo_serie, recibo_numero')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('lote', codigo)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!reserva) return null

  const [{ data: cliente }, { data: recibo }] = await Promise.all([
    admin
      .schema('cartera')
      .from('t_cliente')
      .select('nombre')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('codigo', reserva.cliente)
      .maybeSingle(),
    admin
      .schema('cartera')
      .from('t_recibo_caja')
      .select('fecha, monto, moneda')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('serie', reserva.recibo_serie)
      .eq('numero', reserva.recibo_numero)
      .maybeSingle(),
  ])

  const filaRecibo = recibo as { fecha?: string; monto?: number; moneda?: string } | null
  return {
    reserva_numero: (reserva as { numero?: number }).numero ?? 0,
    cliente_nombre: (cliente as { nombre?: string } | null)?.nombre ?? '',
    fecha: filaRecibo?.fecha ?? '',
    monto: filaRecibo?.monto ?? 0,
    moneda: filaRecibo?.moneda ?? '',
  }
}

// ─── Desistir Reserva ─────────────────────────────────────────────────────────

export async function desistirReserva(
  empresa: number,
  proyecto: number,
  fase: number,
  manzana: string,
  codigo: string,
  reservaNumero: number,
): Promise<{ error?: string }> {
  const permCheck = await requirePermiso(PERMISOS.RES_OPE, 'modificar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), await clienteDatos()]
  const now = new Date().toISOString()

  const [{ data: oldLote }, { data: oldReserva }] = await Promise.all([
    admin.schema('cartera').from('t_lote').select('cuenta, empresa, proyecto, fase, manzana, codigo, moneda, valor, extension, finca, folio, libro, norte, sur, este, oeste, otro, promesa, recibo_serie, recibo_numero, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
      .eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', proyecto)
      .eq('fase', fase).eq('manzana', manzana).eq('codigo', codigo).single(),
    admin.schema('cartera').from('t_reserva').select('cuenta, numero, empresa, proyecto, fase, manzana, lote, cliente, vendedor, recibo_serie, recibo_numero, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
      .eq('cuenta', cuenta).eq('numero', reservaNumero).maybeSingle(),
  ])

  const { error: errLote, data: newLote } = await admin
    .schema('cartera').from('t_lote')
    .update({ recibo_serie: null, recibo_numero: 0, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta).eq('empresa', empresa).eq('proyecto', proyecto)
    .eq('fase', fase).eq('manzana', manzana).eq('codigo', codigo)
    .select()
  if (errLote) return { error: errLote.message }

  const { error: errReserva, data: newReserva } = await admin
    .schema('cartera').from('t_reserva')
    .update({ estado: 4, modifico_usuario: auditUser.userId, modifico_fecha: now })
    .eq('cuenta', cuenta).eq('numero', reservaNumero)
    .select()
  if (errReserva) return { error: errReserva.message }

  await Promise.all([
    writeAudit({
      tabla: 't_lote', operacion: 'UPDATE', cuenta,
      registroId: { empresa, proyecto, fase, manzana, codigo },
      datoAntes: oldLote as Record<string, unknown> | null,
      datoDespues: newLote?.[0] as Record<string, unknown> | null,
      ...auditUser,
    }),
    writeAudit({
      tabla: 't_reserva', operacion: 'UPDATE', cuenta,
      registroId: { numero: reservaNumero },
      datoAntes: oldReserva as Record<string, unknown> | null,
      datoDespues: newReserva?.[0] as Record<string, unknown> | null,
      ...auditUser,
    }),
  ])

  revalidatePath('/dashboard/proyectos/lotes')
  revalidatePath('/dashboard/promesas/reservas')
  revalidatePath('/dashboard')
  return {}
}
