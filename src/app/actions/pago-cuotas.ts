'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCuentaActiva, requirePermiso } from '@/app/actions/permisos'
import { PERMISOS } from '@/lib/permisos'
import { getPlanPago } from '@/app/actions/plan-pago'
import type {
  PromesaBusqueda, PlanPagoPendiente, CuotaPendiente, RegistrarPagoCuotasPayload,
} from '@/lib/types/pago-cuotas'

// ─── Identificar Promesa ────────────────────────────────────────────────────

/**
 * Busca Promesas vigentes (estado = 1) dentro de una empresa/proyecto ya
 * seleccionados, por numero, referencia, codigo de cliente o nombre de
 * cliente. Un cliente puede tener mas de una promesa, por lo que se
 * devuelve la lista completa de coincidencias para que el usuario elija
 * la correcta.
 */
export async function buscarPromesas(
  empresa: number,
  proyecto: number,
  query: string,
): Promise<PromesaBusqueda[]> {
  const cuenta = await getCuentaActiva()
  const q = query.trim()
  if (!q || !empresa || !proyecto) return []

  const admin = createAdminClient()
  const numericQ = /^\d+$/.test(q) ? Number(q) : null
  const qLower = q.toLowerCase()

  const { data: promesas, error } = await admin
    .schema('cartera')
    .from('t_promesa')
    .select('empresa, proyecto, numero, referencia, fecha, cliente, fase, manzana, lote, moneda')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('estado', 1)
    .order('numero')
  if (error) throw new Error(error.message)

  const rows = promesas ?? []
  if (rows.length === 0) return []

  const clienteCodigos = [...new Set(rows.map((r) => r.cliente as number))]
  const { data: clientes } = await admin
    .schema('cartera')
    .from('t_cliente')
    .select('codigo, nombre')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .in('codigo', clienteCodigos)

  const clienteMap = new Map((clientes ?? []).map((c) => [c.codigo as number, c.nombre as string]))

  const matches = rows.filter((p) => {
    if (numericQ !== null && (p.numero === numericQ || p.cliente === numericQ)) return true
    if (p.referencia && String(p.referencia).toLowerCase().includes(qLower)) return true
    const nombre = clienteMap.get(p.cliente as number) ?? ''
    if (nombre.toLowerCase().includes(qLower)) return true
    return false
  })

  return matches.slice(0, 30).map((p) => ({
    empresa:        p.empresa as number,
    proyecto:       p.proyecto as number,
    numero:         p.numero as number,
    referencia:     (p.referencia as string) ?? '',
    fecha:          p.fecha as string,
    cliente_codigo: p.cliente as number,
    cliente_nombre: clienteMap.get(p.cliente as number) ?? String(p.cliente),
    fase:           p.fase as number,
    manzana:        p.manzana as string,
    lote:           p.lote as string,
    moneda:         p.moneda as string,
  }))
}

// ─── Cuotas pendientes de una Promesa ──────────────────────────────────────

/**
 * Reutiliza getPlanPago (plan-pago.ts) y lo transforma a saldos pendientes
 * (monto - monto_pagado por rubro), filtrando las cuotas ya pagadas
 * (estado = 2). El orden ya viene correcto desde getPlanPago: tipo_cuota
 * (1 Enganche, 2 Financiamiento) y luego cuota ascendente.
 */
export async function getCuotasPendientes(
  empresa: number,
  proyecto: number,
  promesa: number,
): Promise<PlanPagoPendiente> {
  const plan = await getPlanPago(empresa, proyecto, promesa)

  const otrosPorCuota = new Map<string, Map<number, number>>()
  for (const o of plan.otros) {
    const key = `${o.tipo_cuota}-${o.cuota}`
    if (!otrosPorCuota.has(key)) otrosPorCuota.set(key, new Map())
    otrosPorCuota.get(key)!.set(o.tipo_otros, (o.monto ?? 0) - (o.monto_pagado ?? 0))
  }

  const cuotas: CuotaPendiente[] = plan.cuotas
    .filter((c) => c.estado !== 2)
    .map((c) => {
      const saldoCuota = (c.capital - c.capital_pagado) + (c.interes - c.interes_pagado)
      const saldoMora  = c.mora - c.mora_pagado
      const otrosMap   = otrosPorCuota.get(`${c.tipo_cuota}-${c.cuota}`) ?? new Map<number, number>()
      const otros      = plan.otrosColumnas.map((col) => ({
        codigo:   col.codigo,
        etiqueta: col.etiqueta,
        saldo:    otrosMap.get(col.codigo) ?? 0,
      }))
      const saldoOtrosTotal = otros.reduce((s, o) => s + o.saldo, 0)
      return {
        tipo_cuota:  c.tipo_cuota,
        cuota:       c.cuota,
        fecha:       c.fecha,
        saldo_cuota: saldoCuota,
        otros,
        saldo_mora:  saldoMora,
        saldo_total: saldoCuota + saldoOtrosTotal + saldoMora,
        fecha_modifico: c.fecha_modifico,
      }
    })

  return { cuotas, otrosColumnas: plan.otrosColumnas }
}

// ─── Grabar el recibo (Pasos 1-4) ───────────────────────────────────────────

/**
 * Registra el pago de cuotas sobre el Plan de Pagos de una Promesa vigente.
 * Delega toda la logica (numero de recibo, tasa de cambio, distribucion del
 * pago, actualizacion de saldos y validacion de concurrencia optimista) al
 * RPC cartera.fn_registrar_pago_cuotas, que ejecuta todo en una sola
 * transaccion atomica (rollback total ante cualquier error, incluyendo un
 * conflicto de fecha_modifico en cualquiera de las cuotas cargadas).
 */
export async function registrarPagoCuotas(
  payload: RegistrarPagoCuotasPayload,
): Promise<{ error?: string; numero_recibo?: number; promesa_pagada?: boolean }> {
  const guard = await requirePermiso(PERMISOS.PAG_CUO, 'agregar')
  if (guard) return guard

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesion no valida.' }

  if (!payload.empresa || !payload.proyecto || !payload.promesa)
    return { error: 'Selecciona una promesa valida.' }
  if (!payload.serie) return { error: 'Selecciona la serie de recibo.' }
  if (!payload.fecha) return { error: 'La fecha es requerida.' }
  if (!payload.cobrador) return { error: 'Selecciona el cobrador.' }
  if (!payload.forma_pago) return { error: 'Selecciona la forma de pago.' }
  if (!payload.moneda) return { error: 'Selecciona la moneda.' }
  if (!payload.tasa_cambio || payload.tasa_cambio <= 0) return { error: 'No hay tasa de cambio valida para la moneda seleccionada.' }
  if (!payload.monto || payload.monto <= 0) return { error: 'El monto a pagar debe ser mayor a cero.' }
  if (!payload.cuotas || payload.cuotas.length === 0) return { error: 'No hay cuotas pendientes para esta promesa.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesion no valida.' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .schema('cartera')
    .rpc('fn_registrar_pago_cuotas', {
      p_cuenta:            cuenta,
      p_empresa:           payload.empresa,
      p_proyecto:          payload.proyecto,
      p_promesa:           payload.promesa,
      p_serie:             payload.serie,
      p_numero:            payload.numero || 0,
      p_fecha:             payload.fecha,
      p_cobrador:          payload.cobrador,
      p_forma_pago:        payload.forma_pago,
      p_banco:             payload.banco || 0,
      p_numero_cuenta:     payload.numero_cuenta || null,
      p_numero_documento:  payload.numero_documento || null,
      p_cuenta_bancaria:   payload.cuenta_bancaria || 0,
      p_moneda:            payload.moneda,
      p_tasa_cambio:       payload.tasa_cambio,
      p_monto:             payload.monto,
      p_cliente_nombre:    payload.cliente_nombre,
      p_usuario:           user.id,
      p_cuotas:            payload.cuotas,
    })

  if (error) return { error: error.message }

  const result = data as { numero_recibo: number; promesa_pagada: boolean } | null
  return { numero_recibo: result?.numero_recibo, promesa_pagada: result?.promesa_pagada }
}
