'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Lote, LoteForm, SerieRecibo } from '@/lib/types/proyectos'

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

export async function getLotes(empresa?: number, proyecto?: number, fase?: number, manzana?: string): Promise<Lote[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_lote')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa').order('proyecto').order('fase').order('manzana').order('codigo')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  if (fase !== undefined) query = query.eq('fase', fase)
  if (manzana !== undefined) query = query.eq('manzana', manzana)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Lote[]
}

export async function getSeriesRecibo(): Promise<SerieRecibo[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_serie_recibo')
    .select('*')
    .eq('cuenta', cuenta)
    .order('serie')
  if (error) throw new Error(error.message)
  return data as SerieRecibo[]
}

export async function getLotesDisponibles(empresa?: number, proyecto?: number): Promise<Lote[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_lote')
    .select('*')
    .eq('cuenta', cuenta)
    .eq('promesa', 0)
    .eq('recibo_numero', 0)
    .order('empresa').order('proyecto').order('fase').order('manzana').order('codigo')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Lote[]
}

export async function createLote(form: LoteForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]
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

  if (error) return { error: error.message }

  await writeAudit(admin, {
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
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_lote')
    .select('*')
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

  await writeAudit(admin, {
    tabla: 't_lote', operacion: 'UPDATE', cuenta,
    registroId: { empresa, proyecto, fase, manzana, codigo },
    datoAntes: oldRow as Record<string, unknown> | null,
    datoDespues: data?.[0] as Record<string, unknown> | null,
    ...auditUser,
  })

  revalidatePath('/dashboard/proyectos/lotes')
  return {}
}

export async function deleteLote(empresa: number, proyecto: number, fase: number, manzana: string, codigo: string): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const [auditUser, admin] = [await getAuditUser(), createAdminClient()]

  const { data: oldRow } = await admin
    .schema('cartera')
    .from('t_lote')
    .select('*')
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

  await writeAudit(admin, {
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

export async function getReservas(): Promise<ReservaRow[]> {
  const cuenta = await getCuentaActiva()
  const admin  = createAdminClient()

  const { data: reservas, error: err1 } = await admin
    .schema('cartera')
    .from('t_reserva')
    .select('numero, empresa, proyecto, fase, manzana, lote, cliente, vendedor, recibo_serie, recibo_numero, estado')
    .eq('cuenta', cuenta)
    .eq('estado', 1)
    .order('numero', { ascending: false })
  if (err1) throw new Error(err1.message)
  if (!reservas || reservas.length === 0) return []

  const numerosRecibo = [...new Set(reservas.map((r) => r.recibo_numero).filter((n) => n > 0))]

  const { data: recibos, error: err2 } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('empresa, proyecto, serie, numero, fecha, monto, moneda, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, cobrador')
    .eq('cuenta', cuenta)
    .in('numero', numerosRecibo)
  if (err2) throw new Error(err2.message)

  // Composite key: empresa-proyecto-serie-numero
  const reciboMap = new Map<string, NonNullable<typeof recibos>[number]>()
  for (const r of recibos ?? []) {
    reciboMap.set(`${r.empresa}-${r.proyecto}-${r.serie}-${r.numero}`, r)
  }

  return reservas.map((r) => {
    const rc = reciboMap.get(`${r.empresa}-${r.proyecto}-${r.recibo_serie}-${r.recibo_numero}`)
    return {
      numero:           r.numero,
      empresa:          r.empresa,
      proyecto:         r.proyecto,
      fase:             r.fase,
      manzana:          r.manzana,
      lote:             r.lote,
      cliente:          r.cliente,
      vendedor:         r.vendedor,
      recibo_serie:     r.recibo_serie ?? '',
      recibo_numero:    r.recibo_numero,
      estado:           r.estado,
      fecha:            rc?.fecha ?? '',
      monto:            rc?.monto ?? 0,
      moneda:           rc?.moneda ?? 'GTQ',
      forma_pago:       rc?.forma_pago ?? 0,
      banco:            rc?.banco ?? 0,
      numero_cuenta:    rc?.numero_cuenta ?? '',
      numero_documento: rc?.numero_documento ?? '',
      cuenta_deposito:  rc?.cuenta_deposito ?? 0,
      cobrador:         rc?.cobrador ?? 0,
    }
  })
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
  const auditUser = await getAuditUser()
  if (!auditUser.userId) return { ok: false, error: 'Usuario no autenticado.' }

  const montoNum = parseFloat(form.monto.replace(',', '.'))
  if (isNaN(montoNum) || montoNum <= 0)
    return { ok: false, error: 'Monto inválido.' }

  const reciboManual = form.recibo_automatico ? 0 : parseInt(form.recibo, 10)
  if (!form.recibo_automatico && isNaN(reciboManual))
    return { ok: false, error: 'Número de recibo inválido.' }

  const admin = createAdminClient()

  const { data, error } = await admin
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
      p_agrego_usuario:      auditUser.userId,
      p_lote_modifico_fecha: loteLastModified ?? '1900-01-01T00:00:00',
      p_cliente_nombre:      form.cliente_nombre,
      p_fase_nombre:         form.fase_nombre,
    })

  if (error) return { ok: false, error: error.message }

  const result = data as { ok: boolean; error?: string; numero?: number; recibo?: number }
  if (!result.ok) return { ok: false, error: result.error ?? 'Error desconocido.' }

  return { ok: true, numero: result.numero!, recibo: result.recibo! }
}
