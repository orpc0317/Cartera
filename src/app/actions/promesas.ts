'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clienteDatos } from '@/lib/supabase/datos'
import type { Promesa, PromesaForm } from '@/lib/types/promesas'
import type { PromesaOtroPayload } from '@/lib/types/promesa-otros'
import type { NombresVer } from '@/lib/registro-ver'
import { filaConNombres } from '@/lib/leer-nombres'
import { requirePermiso, getCuentaActiva, leerAcceso, exigirProyecto } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { restringirProyecto } from '@/lib/acceso-proyecto'

// ─── Helpers ───────────────────────────────────────────────────────────────


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

// ─── Lectura ───────────────────────────────────────────────────────────────

export async function getPromesas(empresa?: number, proyecto?: number): Promise<Promesa[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  const admin = await clienteDatos()
  let query = admin
    .schema('cartera')
    .from('t_promesa')
    .select('cuenta, empresa, proyecto, numero, referencia, fecha, cliente, vendedor, fase, manzana, lote, moneda, valor_lote, subsidio, arras, monto_enganche, primer_enganche, plazo_enganche, interes_anual, forma_mora, interes_mora, fijo_mora, mora_enganche, dias_gracia, dias_afectos, forma_financiamiento, fecha_financiamiento, monto_financiamiento, plazo_financiamiento, fecha_cancelacion, venta, observacion, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', acceso.cuenta)
    .order('empresa')
    .order('proyecto')
    .order('numero')
  const acotada = restringirProyecto(query, acceso, { empresa, proyecto })
  if (!acotada) return []
  query = acotada
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Promesa[]
}

export async function obtenerPromesa(
  empresa: number,
  proyecto: number,
  numero: number,
): Promise<{ row?: Promesa & NombresVer; error?: string }> {
  const guard = await requirePermiso(PERMISOS.PRE_OPE, 'consultar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  return filaConNombres<Promesa>(
    await clienteDatos(), cuenta, 't_promesa',
    { cuenta, empresa, proyecto, numero }, 'cuenta, empresa, proyecto, numero, referencia, fecha, cliente, vendedor, fase, manzana, lote, moneda, valor_lote, subsidio, arras, monto_enganche, primer_enganche, plazo_enganche, interes_anual, forma_mora, interes_mora, fijo_mora, mora_enganche, dias_gracia, dias_afectos, forma_financiamiento, fecha_financiamiento, monto_financiamiento, plazo_financiamiento, fecha_cancelacion, venta, observacion, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha',
    (row) => ({
      empresa: row.empresa,
      proyecto: row.proyecto,
      fase: row.fase,
      cliente: row.cliente,
      vendedor: row.vendedor,
    }),
  )
}

// ─── Crear ─────────────────────────────────────────────────────────────────

export async function createPromesa(
  form: PromesaForm,
  loteModificoFecha?: string,
  otros: PromesaOtroPayload[] = [],
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.PRE_OPE, 'agregar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(form.empresa, form.proyecto)
  if (alcance) return alcance

  const admin = createAdminClient()
  const auditUser = await getAuditUser()

  // fecha_financiamiento debe ser '1900-01-01' si y solo si monto_financiamiento
  // es 0; se recalcula en el servidor para no depender de lo que envíe el cliente.
  const fechaFinanciamiento = form.monto_financiamiento > 0
    ? form.fecha_financiamiento
    : '1900-01-01'

  // La creación se delega a una función SECURITY DEFINER que bloquea la fila
  // del lote (FOR UPDATE) antes de insertar: garantiza que un lote solo pueda
  // asociarse a UNA promesa incluso bajo solicitudes concurrentes.
  const { data, error } = await admin.schema('cartera').rpc('fn_crear_promesa', {
    p_cuenta: cuenta,
    p_empresa: form.empresa,
    p_proyecto: form.proyecto,
    p_numero: form.numero,
    p_referencia: form.referencia,
    p_fecha: form.fecha,
    p_cliente: form.cliente,
    p_vendedor: form.vendedor,
    p_fase: form.fase,
    p_manzana: form.manzana,
    p_lote: form.lote,
    p_moneda: form.moneda,
    p_valor_lote: form.valor_lote,
    p_subsidio: form.subsidio,
    p_arras: form.arras,
    p_monto_enganche: form.monto_enganche,
    p_primer_enganche: form.primer_enganche,
    p_plazo_enganche: form.plazo_enganche,
    p_interes_anual: form.interes_anual,
    p_forma_mora: form.forma_mora,
    p_interes_mora: form.interes_mora,
    p_fijo_mora: form.fijo_mora,
    p_mora_enganche: form.mora_enganche,
    p_dias_gracia: form.dias_gracia,
    p_dias_afectos: form.dias_afectos,
    p_forma_financiamiento: form.forma_financiamiento,
    p_fecha_financiamiento: fechaFinanciamiento,
    p_monto_financiamiento: form.monto_financiamiento,
    p_plazo_financiamiento: form.plazo_financiamiento,
    p_venta: form.venta,
    p_observacion: form.observacion,
    p_estado: form.estado,
    p_agrego_usuario: auditUser.userId,
    p_lote_modifico_fecha: loteModificoFecha ?? '1900-01-01T00:00:00',
    p_otros: otros,
  })

  if (error) return { error: error.message }

  const result = data as { ok: boolean; error?: string; promesa?: Record<string, unknown> }
  if (!result.ok) return { error: result.error ?? 'No se pudo crear la promesa.' }

  const numeroCreado = (result.promesa?.numero as number | undefined) ?? form.numero

  await writeAudit({
    tabla: 't_promesa',
    operacion: 'INSERT',
    cuenta,
    registroId: { empresa: form.empresa, proyecto: form.proyecto, numero: numeroCreado },
    datoAntes: null,
    datoDespues: result.promesa ?? null,
    ...auditUser,
  })

  if (otros.length > 0) {
    await writeAudit({
      tabla: 't_promesa_otros',
      operacion: 'INSERT',
      cuenta,
      registroId: { empresa: form.empresa, proyecto: form.proyecto, promesa: numeroCreado },
      datoAntes: null,
      datoDespues: { otros },
      ...auditUser,
    })
  }

  return {}
}

// ─── Actualizar ────────────────────────────────────────────────────────────

export async function updatePromesa(
  empresa: number,
  proyecto: number,
  numero: number,
  form: Pick<PromesaForm, 'referencia' | 'observacion' | 'estado'>,
  lastModified?: string,
  otros: PromesaOtroPayload[] = [],
): Promise<{ error?: string; row?: Promesa }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.PRE_OPE, 'modificar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance

  const admin = await clienteDatos()

  const { data: original } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('cuenta, empresa, proyecto, numero, referencia, fecha, cliente, vendedor, fase, manzana, lote, moneda, valor_lote, subsidio, arras, monto_enganche, primer_enganche, plazo_enganche, interes_anual, forma_mora, interes_mora, fijo_mora, mora_enganche, dias_gracia, dias_afectos, forma_financiamiento, fecha_financiamiento, monto_financiamiento, plazo_financiamiento, fecha_cancelacion, venta, observacion, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)
    .maybeSingle()

  const auditUser = await getAuditUser()
  const now = new Date().toISOString()

  let query = admin
    .schema('cartera')
    .from('t_promesa')
    .update({
      referencia: form.referencia,
      observacion: form.observacion,
      estado: form.estado,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { data, error } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit({
    tabla: 't_promesa',
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, numero },
    datoAntes: original as Record<string, unknown> | null,
    datoDespues: (data?.[0] ?? null) as Record<string, unknown> | null,
    ...auditUser,
  })

  // Sincroniza el detalle de "otros ingresos" (reemplazo completo, delete-then-insert,
  // con validacion de forma_pago > 0 / activo = 1 dentro de la funcion SECURITY DEFINER).
  const privilegiado = createAdminClient()
  const { data: otrosResult, error: otrosError } = await privilegiado.schema('cartera').rpc('fn_actualizar_promesa_otros', {
    p_cuenta: cuenta,
    p_empresa: empresa,
    p_proyecto: proyecto,
    p_promesa: numero,
    p_otros: otros,
  })
  if (otrosError) return { error: otrosError.message }
  const otrosCheck = otrosResult as { ok: boolean; error?: string }
  if (!otrosCheck.ok) return { error: otrosCheck.error ?? 'No se pudo actualizar el detalle de otros ingresos.' }

  await writeAudit({
    tabla: 't_promesa_otros',
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, promesa: numero },
    datoAntes: null,
    datoDespues: { otros },
    ...auditUser,
  })

  return { row: data[0] as Promesa }
}

// ─── Anular ────────────────────────────────────────────────────────────────

export async function anularPromesa(
  empresa: number,
  proyecto: number,
  numero: number,
  comentario: string,
  lastModified?: string,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.PRE_OPE, 'eliminar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance

  const motivo = comentario.trim()
  if (!motivo) return { error: 'El motivo de la anulación es obligatorio.' }

  const admin = await clienteDatos()

  const { data: original } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('cuenta, empresa, proyecto, numero, referencia, fecha, cliente, vendedor, fase, manzana, lote, moneda, valor_lote, subsidio, arras, monto_enganche, primer_enganche, plazo_enganche, interes_anual, forma_mora, interes_mora, fijo_mora, mora_enganche, dias_gracia, dias_afectos, forma_financiamiento, fecha_financiamiento, monto_financiamiento, plazo_financiamiento, fecha_cancelacion, venta, observacion, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)
    .maybeSingle()

  if (!original) return { error: 'Promesa no encontrada.' }

  const observacionActual = (original as { observacion: string | null }).observacion
  const observacionNueva = observacionActual?.trim()
    ? `${observacionActual.trim()}; ${motivo}`
    : motivo

  const auditUser = await getAuditUser()
  const now = new Date().toISOString()

  let query = admin
    .schema('cartera')
    .from('t_promesa')
    .update({
      estado: 99,
      observacion: observacionNueva,
      modifico_usuario: auditUser.userId,
      modifico_fecha: now,
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)

  if (lastModified) query = query.eq('modifico_fecha', lastModified)

  const { data, error } = await query.select()
  if (error) return { error: error.message }
  if (lastModified && (!data || data.length === 0)) {
    return { error: 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.' }
  }

  await writeAudit({
    tabla: 't_promesa',
    operacion: 'UPDATE',
    cuenta,
    registroId: { empresa, proyecto, numero },
    datoAntes: original as Record<string, unknown>,
    datoDespues: (data?.[0] ?? null) as Record<string, unknown> | null,
    ...auditUser,
  })

  return {}
}

// ─── Eliminar ──────────────────────────────────────────────────────────────

export async function deletePromesa(
  empresa: number,
  proyecto: number,
  numero: number,
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  const permCheck = await requirePermiso(PERMISOS.PRE_OPE, 'eliminar')
  if (permCheck) return permCheck
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance

  const admin = await clienteDatos()

  const { count } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('numero', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('promesa', numero)

  if (count && count > 0) {
    return { error: 'No se puede eliminar esta promesa porque tiene recibos caja asociados.' }
  }

  const { data: original } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('cuenta, empresa, proyecto, numero, referencia, fecha, cliente, vendedor, fase, manzana, lote, moneda, valor_lote, subsidio, arras, monto_enganche, primer_enganche, plazo_enganche, interes_anual, forma_mora, interes_mora, fijo_mora, mora_enganche, dias_gracia, dias_afectos, forma_financiamiento, fecha_financiamiento, monto_financiamiento, plazo_financiamiento, fecha_cancelacion, venta, observacion, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)
    .maybeSingle()

  const auditUser = await getAuditUser()

  const { error } = await admin
    .schema('cartera')
    .from('t_promesa')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('numero', numero)

  if (error) return { error: error.message }

  await writeAudit({
    tabla: 't_promesa',
    operacion: 'DELETE',
    cuenta,
    registroId: { empresa, proyecto, numero },
    datoAntes: original as Record<string, unknown> | null,
    datoDespues: null,
    ...auditUser,
  })

  return {}
}
