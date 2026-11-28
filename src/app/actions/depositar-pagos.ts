'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clienteDatos } from '@/lib/supabase/datos'
import { requirePermiso, leerAcceso } from '@/app/actions/permisos'
import { puedeProyecto } from '@/lib/acceso-proyecto'
import { PERMISOS } from '@/lib/permisos'
import type { ReciboDetalleItem, DepositarPagosServerPayload } from '@/lib/types/depositar-pagos'

// ─── Lectura ───────────────────────────────────────────────────────────────

/**
 * Busca un recibo de caja por serie + número y valida que esté pendiente de depositar.
 * Las validaciones de moneda incompatible y recibo duplicado en la lista local
 * se realizan en el cliente (_client.tsx) para inmediatez de feedback.
 */
export async function getReciboParaDeposito(
  empresa: number,
  proyecto: number,
  serie: string,
  numero: number,
): Promise<{ data?: ReciboDetalleItem; error?: string }> {
  const acceso = await leerAcceso()
  if (!acceso || !puedeProyecto(acceso, empresa, proyecto)) return { error: 'Acceso denegado.' }
  const cuenta = acceso.cuenta
  const admin  = await clienteDatos()

  const { data: recibo, error } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('cuenta, empresa, proyecto, serie, numero, fecha, cliente, forma_pago, monto, moneda, transaccion_bancaria, reserva, promesa, fase, manzana, lote, modifico_fecha')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
    .eq('numero', numero)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!recibo) return { error: 'Recibo no encontrado.' }

  if (recibo.forma_pago === 3 || recibo.forma_pago === 4)
    return { error: 'Este recibo no requiere deposito (forma de pago: Deposito/Transferencia).' }

  if (recibo.transaccion_bancaria)
    return { error: `Este recibo ya tiene un deposito asociado (Transaccion: ${recibo.transaccion_bancaria}).` }

  const { data: cliente } = await admin
    .schema('cartera')
    .from('t_cliente')
    .select('codigo, nombre')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', recibo.cliente)
    .maybeSingle()

  const reservaNum = Number(recibo.reserva ?? 0)
  const promesaNum = Number(recibo.promesa ?? 0)
  const tipo: 'Reserva' | 'Otros' = reservaNum > 0 ? 'Reserva' : 'Otros'

  let fase = Number(recibo.fase ?? 0)
  let manzana = (recibo.manzana as string | null) ?? null
  let lote = (recibo.lote as string | null) ?? null
  if (reservaNum <= 0 && promesaNum > 0) {
    const { data: promesa } = await admin
      .schema('cartera')
      .from('t_promesa')
      .select('fase, manzana, lote')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('numero', promesaNum)
      .maybeSingle()
    if (promesa) {
      fase = Number(promesa.fase ?? 0)
      manzana = (promesa.manzana as string | null) ?? null
      lote = (promesa.lote as string | null) ?? null
    }
  }

  let faseNombre: string | undefined
  if (fase) {
    const { data: faseRow } = await admin
      .schema('cartera')
      .from('t_fase')
      .select('nombre')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('codigo', fase)
      .maybeSingle()
    faseNombre = faseRow?.nombre ?? undefined
  }

  return {
    data: {
      cuenta:         recibo.cuenta as string,
      empresa:        recibo.empresa as number,
      proyecto:       recibo.proyecto as number,
      serie:          recibo.serie as string,
      numero:         recibo.numero as number,
      fecha:          recibo.fecha as string,
      cliente_codigo: recibo.cliente as number,
      cliente_nombre: cliente?.nombre ?? String(recibo.cliente),
      forma_pago:     recibo.forma_pago as number,
      monto:          recibo.monto as number,
      moneda:         recibo.moneda as string,
      tipo,
      reserva:        reservaNum,
      modifico_fecha: (recibo.modifico_fecha as string | null) ?? null,
      ...(fase || manzana || lote ? {
        fase:        fase || undefined,
        fase_nombre: faseNombre,
        manzana:     manzana ?? undefined,
        lote:        lote ?? undefined,
      } : {}),
    },
  }
}

// ─── Auditoría ─────────────────────────────────────────────────────────────

const COLUMNAS_RECIBO = 'cuenta, empresa, proyecto, serie, numero, fecha, promesa, reserva, cliente, fase, manzana, lote, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, transaccion_bancaria, cobrador, moneda, tasa_cambio, monto, mora, abono_capital, tipo_ingreso, factura_serie, factura_numero, observaciones, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha'

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

function mensajeLock(serie: string, numero: number) {
  return `El recibo ${serie}-${numero} fue modificado por otro usuario. Quitelo, busquelo de nuevo y vuelva a intentar.`
}

// ─── Escritura ─────────────────────────────────────────────────────────────

/**
 * Registra un depósito bancario.
 * Llama al RPC cartera.fn_depositar_pagos que ejecuta de forma atómica:
 *   1. INSERT en t_transaccion_bancaria (estado=1).
 *      El campo numero_transaccion es generado automáticamente por el trigger
 *      de la tabla; la función lo obtiene con RETURNING numero_transaccion.
 *   2. UPDATE en t_recibo_caja (cuenta_deposito + transaccion_bancaria)
 *      con SELECT FOR UPDATE para protección multi-sesión.
 *
 * PREREQUISITO: la función cartera.fn_depositar_pagos debe existir en la BD.
 * Ver spec prompts/crud-depositar-pagos.md sección RPC.
 */
export async function depositarPagos(
  payload: DepositarPagosServerPayload,
): Promise<{ error?: string; numero_transaccion?: string }> {
  const guard = await requirePermiso(PERMISOS.DEP_BAN, 'agregar')
  if (guard) return guard

  const acceso = await leerAcceso()
  if (!acceso || !puedeProyecto(acceso, payload.empresa, payload.proyecto)) {
    return { error: 'Acceso denegado.' }
  }
  if (payload.recibos.some((recibo) => !puedeProyecto(acceso, recibo.empresa, recibo.proyecto))) {
    return { error: 'Acceso denegado.' }
  }

  const cuenta = acceso.cuenta
  if (!cuenta) return { error: 'Sesion no valida.' }

  if (payload.recibos.length === 0)
    return { error: 'Debe agregar al menos un recibo al deposito.' }
  if (!payload.fecha)
    return { error: 'La fecha del deposito es requerida.' }
  if (!payload.numero_documento?.trim())
    return { error: 'El numero de documento es requerido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesion no valida.' }

  const valor = payload.recibos.reduce((sum, r) => sum + r.monto, 0)
  const admin = createAdminClient()
  const antes: Record<string, unknown>[] = []

  for (const recibo of payload.recibos) {
    let vigente = admin
      .schema('cartera')
      .from('t_recibo_caja')
      .select(COLUMNAS_RECIBO)
      .eq('cuenta', cuenta)
      .eq('empresa', recibo.empresa)
      .eq('proyecto', recibo.proyecto)
      .eq('serie', recibo.serie)
      .eq('numero', recibo.numero)
    vigente = recibo.modifico_fecha
      ? vigente.eq('modifico_fecha', recibo.modifico_fecha)
      : vigente.is('modifico_fecha', null)
    const { data: fila, error: errorFila } = await vigente.maybeSingle()
    if (errorFila) return { error: errorFila.message }
    if (!fila) {
      const { data: existe } = await admin
        .schema('cartera')
        .from('t_recibo_caja')
        .select('numero')
        .eq('cuenta', cuenta)
        .eq('empresa', recibo.empresa)
        .eq('proyecto', recibo.proyecto)
        .eq('serie', recibo.serie)
        .eq('numero', recibo.numero)
        .maybeSingle()
      if (!existe) return { error: `El recibo ${recibo.serie}-${recibo.numero} no existe.` }
      return { error: mensajeLock(recibo.serie, recibo.numero) }
    }
    if (fila.transaccion_bancaria) {
      return { error: `El recibo ${recibo.serie}-${recibo.numero} ya fue depositado por otra sesion.` }
    }
    antes.push(fila as Record<string, unknown>)
  }

  const { data, error } = await admin
    .schema('cartera')
    .rpc('fn_depositar_pagos', {
      p_cuenta:           cuenta,
      p_empresa:          payload.empresa,
      p_proyecto:         payload.proyecto,
      p_cuenta_bancaria:  payload.cuenta_bancaria,
      p_fecha:            payload.fecha,
      p_numero_documento: payload.numero_documento.trim(),
      p_valor:            valor,
      p_usuario:          user.id,
      p_recibos:          payload.recibos.map((recibo) => ({
        cuenta:   recibo.cuenta,
        empresa:  recibo.empresa,
        proyecto: recibo.proyecto,
        serie:    recibo.serie,
        numero:   recibo.numero,
        monto:    recibo.monto,
      })),
    })

  if (error) return { error: error.message }

  const result = data as { numero_transaccion: string } | null
  if (!result?.numero_transaccion) return { error: 'No se obtuvo el numero de transaccion.' }

  const { data: transaccion } = await admin
    .schema('cartera')
    .from('t_transaccion_bancaria')
    .select('numero_documento')
    .eq('cuenta', cuenta)
    .eq('empresa', payload.empresa)
    .eq('proyecto', payload.proyecto)
    .eq('cuenta_bancaria', payload.cuenta_bancaria)
    .eq('numero_transaccion', result.numero_transaccion)
    .maybeSingle()
  const boleta = String(transaccion?.numero_documento ?? payload.numero_documento).trim()
  const auditUser = await getAuditUser()

  for (const previo of antes) {
    const { data: posterior } = await admin
      .schema('cartera')
      .from('t_recibo_caja')
      .select(COLUMNAS_RECIBO)
      .eq('cuenta', cuenta)
      .eq('empresa', previo.empresa as number)
      .eq('proyecto', previo.proyecto as number)
      .eq('serie', previo.serie as string)
      .eq('numero', previo.numero as number)
      .maybeSingle()
    if (!posterior) continue
    await writeAudit(admin, {
      tabla: 't_recibo_caja',
      operacion: 'UPDATE',
      cuenta,
      registroId: {
        empresa: previo.empresa,
        proyecto: previo.proyecto,
        serie: previo.serie,
        numero: previo.numero,
      },
      datoAntes: { ...previo, boleta_deposito: null },
      datoDespues: { ...(posterior as Record<string, unknown>), boleta_deposito: boleta },
      ...auditUser,
    })
  }

  return { numero_transaccion: result.numero_transaccion }
}
