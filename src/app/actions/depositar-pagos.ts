'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCuentaActiva, requirePermiso } from '@/app/actions/permisos'
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
  const cuenta = await getCuentaActiva()
  const admin  = createAdminClient()

  const { data: recibo, error } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('cuenta, empresa, proyecto, serie, numero, fecha, cliente, forma_pago, monto, moneda, transaccion_bancaria, reserva, fase, manzana, lote')
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
  const tipo: 'Reserva' | 'Otros' = reservaNum > 0 ? 'Reserva' : 'Otros'

  let faseNombre: string | undefined
  if (tipo === 'Reserva' && recibo.fase) {
    const { data: faseRow } = await admin
      .schema('cartera')
      .from('t_fase')
      .select('nombre')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('codigo', recibo.fase)
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
      ...(tipo === 'Reserva' && {
        fase:       recibo.fase as number,
        fase_nombre: faseNombre,
        manzana:    recibo.manzana as string | undefined,
        lote:       recibo.lote as string | undefined,
      }),
    },
  }
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

  const cuenta = await getCuentaActiva()
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
      p_recibos:          payload.recibos,
    })

  if (error) return { error: error.message }

  const result = data as { numero_transaccion: string } | null
  return { numero_transaccion: result?.numero_transaccion }
}
