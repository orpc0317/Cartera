'use server'

import { clienteDatos } from '@/lib/supabase/datos'
import { getCuentaActiva, requirePermiso, leerAcceso, exigirProyecto } from '@/app/actions/permisos'
import { restringirProyecto } from '@/lib/acceso-proyecto'
import { PERMISOS } from '@/lib/permisos'
import type { NombresVer } from '@/lib/registro-ver'
import { filaConNombres } from '@/lib/leer-nombres'
import type {
  ReciboCaja, DetalleReciboCaja, PagosFiltros, ReciboCajaDetalleExtra, ReciboOtroColumna, DetalleReciboOtro,
} from '@/lib/types/pagos'

const LIMITE_FILAS = 500

function rangoDia(fecha: string): { desde: string; hasta: string } {
  const desde = new Date(`${fecha}T00:00:00.000Z`)
  const hasta = new Date(desde)
  hasta.setUTCDate(hasta.getUTCDate() + 1)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}

/**
 * Lista de recibos de caja (solo lectura) para la pantalla Mantenimiento Pagos.
 *
 * Diseño pensado para una tabla que en producción puede acumular cientos de
 * miles de filas: nunca se trae todo el historico. Siempre se aplica un
 * filtro de fecha (recibo o fecha de grabado) resuelto por el llamador —
 * si el cliente no manda ningun filtro de fecha, se asume "grabados hoy"
 * (agrego_fecha) para acotar el primer despliegue.
 * Se aplica ademas un LIMITE duro de filas; si se alcanza, se informa
 * `limitReached: true` para que la pantalla pida al usuario refinar filtros.
 */
export async function getRecibosCaja(
  filtros: PagosFiltros,
): Promise<{ data: (ReciboCaja & NombresVer)[]; limitReached: boolean; error?: string }> {
  const acceso = await leerAcceso()
  if (!acceso) return { data: [], limitReached: false, error: 'Sesión no válida.' }
  const cuenta = acceso.cuenta

  const admin = await clienteDatos()

  let query = admin
    .schema('cartera')
    .from('v_recibo_caja_lista')
    .select('cuenta, empresa, proyecto, serie, numero, fecha, promesa, reserva, cliente, fase, manzana, lote, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, transaccion_bancaria, cobrador, moneda, tasa_cambio, monto, mora, abono_capital, tipo_ingreso, factura_serie, factura_numero, observaciones, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha, empresa_nombre, proyecto_nombre, cliente_nombre, cobrador_nombre, banco_nombre')
    .eq('cuenta', cuenta)

  const acotada = restringirProyecto(query, acceso, {
    empresa: filtros.empresa,
    proyecto: filtros.proyecto,
  })
  if (!acotada) return { data: [], limitReached: false }
  query = acotada

  // Fecha del recibo (columna date simple): si solo se manda "desde" (sin "hasta"),
  // se interpreta como busqueda exacta por ese dia, no como rango abierto.
  if (filtros.fechaDesde && filtros.fechaHasta) {
    query = query.gte('fecha', filtros.fechaDesde).lte('fecha', filtros.fechaHasta)
  } else if (filtros.fechaDesde) {
    query = query.eq('fecha', filtros.fechaDesde)
  } else if (filtros.fechaHasta) {
    query = query.lte('fecha', filtros.fechaHasta)
  }

  // Fecha de registro (timestamptz): mismo criterio — "solo desde" = ese dia exacto.
  // El default "grabados hoy" ya NO se aplica aqui de forma implicita: el llamador
  // (page.tsx en la carga inicial, o el panel de filtros en el cliente) siempre manda
  // agregoDesde=hoy explicitamente como si el usuario lo hubiera tecleado.
  if (filtros.agregoDesde && filtros.agregoHasta) {
    query = query.gte('agrego_fecha', rangoDia(filtros.agregoDesde).desde).lt('agrego_fecha', rangoDia(filtros.agregoHasta).hasta)
  } else if (filtros.agregoDesde) {
    const { desde, hasta } = rangoDia(filtros.agregoDesde)
    query = query.gte('agrego_fecha', desde).lt('agrego_fecha', hasta)
  } else if (filtros.agregoHasta) {
    query = query.lt('agrego_fecha', rangoDia(filtros.agregoHasta).hasta)
  }

  if (filtros.promesa !== undefined) query = query.eq('promesa', filtros.promesa)

  if (filtros.cuentaDeposito !== undefined) query = query.eq('cuenta_deposito', filtros.cuentaDeposito)
  if (filtros.formaPago !== undefined) query = query.eq('forma_pago', filtros.formaPago)
  if (filtros.numeroDocumento?.trim()) query = query.ilike('numero_documento', `%${filtros.numeroDocumento.trim()}%`)
  if (filtros.serie) query = query.eq('serie', filtros.serie)

  // Rango de numero de recibo: mismo criterio — "solo desde" = numero exacto.
  if (filtros.numeroDesde !== undefined && filtros.numeroHasta !== undefined) {
    query = query.gte('numero', filtros.numeroDesde).lte('numero', filtros.numeroHasta)
  } else if (filtros.numeroDesde !== undefined) {
    query = query.eq('numero', filtros.numeroDesde)
  } else if (filtros.numeroHasta !== undefined) {
    query = query.lte('numero', filtros.numeroHasta)
  }

  if (filtros.cliente?.trim()) query = query.ilike('cliente_nombre', `%${filtros.cliente.trim()}%`)

  const { data, error } = await query
    .order('secuencia', { ascending: false })
    .limit(LIMITE_FILAS + 1)

  if (error) return { data: [], limitReached: false, error: error.message }

  const rows = (data ?? []) as (ReciboCaja & NombresVer)[]
  const limitReached = rows.length > LIMITE_FILAS
  return { data: limitReached ? rows.slice(0, LIMITE_FILAS) : rows, limitReached }
}

export async function obtenerReciboCaja(
  empresa: number,
  proyecto: number,
  serie: string,
  numero: number,
): Promise<{ row?: ReciboCaja & NombresVer; error?: string }> {
  const guard = await requirePermiso(PERMISOS.PAG_MAN, 'consultar')
  if (guard) return guard
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }
  return filaConNombres<ReciboCaja>(
    await clienteDatos(), cuenta, 't_recibo_caja',
    { cuenta, empresa, proyecto, serie, numero }, 'cuenta, empresa, proyecto, serie, numero, fecha, promesa, reserva, cliente, fase, manzana, lote, forma_pago, banco, numero_cuenta, numero_documento, cuenta_deposito, transaccion_bancaria, cobrador, moneda, tasa_cambio, monto, mora, abono_capital, tipo_ingreso, factura_serie, factura_numero, observaciones, estado, agrego_usuario, agrego_fecha, modifico_usuario, modifico_fecha',
    (row) => ({
      empresa: row.empresa,
      proyecto: row.proyecto,
      fase: row.fase,
      cliente: row.cliente,
      banco: row.banco,
      cobrador: row.cobrador,
      cuentaDeposito: row.cuenta_deposito,
    }),
  )
}

/**
 * Datos adicionales del recibo que solo se necesitan al abrir el modal Ver
 * (no en la tabla): lineas de t_detalle_recibo_caja y, si aplica, la
 * transaccion bancaria asociada al deposito/transferencia.
 */
export async function getReciboCajaExtra(
  empresa: number,
  proyecto: number,
  serie: string,
  numero: number,
): Promise<{ data?: ReciboCajaDetalleExtra; error?: string }> {
  const alcance = await exigirProyecto(empresa, proyecto)
  if (alcance) return alcance
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = await clienteDatos()

  const { data: recibo, error: reciboError } = await admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('promesa, cuenta_deposito, transaccion_bancaria')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie', serie)
    .eq('numero', numero)
    .maybeSingle()

  if (reciboError) return { error: reciboError.message }
  if (!recibo) return { error: 'Recibo no encontrado.' }

  const { data: detalle, error: detalleError } = await admin
    .schema('cartera')
    .from('t_detalle_recibo_caja')
    .select('cuenta, empresa, proyecto, serie_recibo, recibo, fecha_cuota, tipo_cuota, cuota, capital, intereses, mora, otros')
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('serie_recibo', serie)
    .eq('recibo', numero)
    .order('fecha_cuota')

  if (detalleError) return { error: detalleError.message }

  let deposito: ReciboCajaDetalleExtra['deposito'] = null
  if (recibo.transaccion_bancaria) {
    const { data: transaccion } = await admin
      .schema('cartera')
      .from('t_transaccion_bancaria')
      .select('numero_transaccion, fecha, numero_documento, valor, tipo_transaccion')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('cuenta_bancaria', recibo.cuenta_deposito)
      .eq('numero_transaccion', recibo.transaccion_bancaria)
      .maybeSingle()
    if (transaccion) deposito = transaccion as ReciboCajaDetalleExtra['deposito']
  }

  // Desglose de "Otros" aplicados por este recibo (t_detalle_recibo_otros), resuelto contra
  // t_tipo_ingreso via t_promesa_otros.secuencia -> tipo_otros (mismo patron que getPlanPago
  // en plan-pago.ts). Solo aplica si el recibo esta ligado a una promesa.
  const otrosColumnas: ReciboOtroColumna[] = []
  let otros: DetalleReciboOtro[] = []
  if (recibo.promesa) {
    const { data: detalleOtros, error: detalleOtrosError } = await admin
      .schema('cartera')
      .from('t_detalle_recibo_otros')
      .select('tipo_cuota, cuota, secuencia, monto')
      .eq('cuenta', cuenta)
      .eq('empresa', empresa)
      .eq('proyecto', proyecto)
      .eq('serie_recibo', serie)
      .eq('recibo', numero)

    if (detalleOtrosError) return { error: detalleOtrosError.message }

    if (detalleOtros && detalleOtros.length > 0) {
      const { data: promesaOtros, error: promesaOtrosError } = await admin
        .schema('cartera')
        .from('t_promesa_otros')
        .select('secuencia, tipo_otros')
        .eq('cuenta', cuenta)
        .eq('empresa', empresa)
        .eq('proyecto', proyecto)
        .eq('promesa', recibo.promesa)

      if (promesaOtrosError) return { error: promesaOtrosError.message }

      const secuenciaToTipo = new Map((promesaOtros ?? []).map((r) => [r.secuencia, r.tipo_otros]))
      const tiposOtros = [...new Set((promesaOtros ?? []).map((r) => r.tipo_otros))]

      const { data: tiposIngreso, error: tiposIngresoError } = await admin
        .schema('cartera')
        .from('t_tipo_ingreso')
        .select('codigo, etiqueta')
        .eq('cuenta', cuenta)
        .eq('empresa', empresa)
        .eq('proyecto', proyecto)
        .in('codigo', tiposOtros.length > 0 ? tiposOtros : [0])

      if (tiposIngresoError) return { error: tiposIngresoError.message }

      const etiquetaMap = new Map((tiposIngreso ?? []).map((t) => [t.codigo, t.etiqueta]))

      otros = detalleOtros.map((d) => ({
        tipo_cuota: d.tipo_cuota,
        cuota:      d.cuota,
        tipo_otros: secuenciaToTipo.get(d.secuencia) ?? 0,
        monto:      d.monto,
      }))

      const seen = new Set<number>()
      for (const o of otros) {
        if (seen.has(o.tipo_otros)) continue
        seen.add(o.tipo_otros)
        otrosColumnas.push({ codigo: o.tipo_otros, etiqueta: etiquetaMap.get(o.tipo_otros) ?? `#${o.tipo_otros}` })
      }
    }
  }

  return { data: { detalle: (detalle ?? []) as DetalleReciboCaja[], otrosColumnas, otros, deposito } }
}
