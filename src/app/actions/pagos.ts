'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCuentaActiva } from '@/app/actions/permisos'
import type {
  ReciboCaja, DetalleReciboCaja, PagosFiltros, ReciboCajaDetalleExtra, ReciboOtroColumna, DetalleReciboOtro,
} from '@/lib/types/pagos'

const LIMITE_FILAS = 500

/**
 * Obtiene los pares (empresa, proyecto) a los que el usuario autenticado
 * tiene acceso explícito (t_usuario_proyecto). Sin filas = sin acceso.
 * Mismo patrón que getProyectosUsuario (src/app/actions/proyectos.ts).
 */
async function getAccesos(cuenta: string, userId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .schema('cartera')
    .from('t_usuario_proyecto')
    .select('empresa, proyecto')
    .eq('cuenta', cuenta)
    .eq('userid', userId)

  if (error) throw new Error(error.message)
  return (data ?? []) as { empresa: number; proyecto: number }[]
}

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
): Promise<{ data: ReciboCaja[]; limitReached: boolean; error?: string }> {
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { data: [], limitReached: false, error: 'Sesión no válida.' }

  const admin = createAdminClient()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], limitReached: false, error: 'Sesión no válida.' }

  const accesos = await getAccesos(cuenta, user.id, admin)
  if (accesos.length === 0) return { data: [], limitReached: false }

  let query = admin
    .schema('cartera')
    .from('t_recibo_caja')
    .select('*')
    .eq('cuenta', cuenta)

  // Filtro de empresa/proyecto: si el usuario indica un proyecto especifico,
  // validar que tenga acceso a el. Si solo indica empresa, restringir a los
  // proyectos de esa empresa a los que tiene acceso. Sin ninguno de los dos,
  // restringir a todos los accesos concedidos.
  if (filtros.proyecto !== undefined && filtros.empresa !== undefined) {
    const tieneAcceso = accesos.some((a) => a.empresa === filtros.empresa && a.proyecto === filtros.proyecto)
    if (!tieneAcceso) return { data: [], limitReached: false }
    query = query.eq('empresa', filtros.empresa).eq('proyecto', filtros.proyecto)
  } else if (filtros.empresa !== undefined) {
    const accesosEmpresa = accesos.filter((a) => a.empresa === filtros.empresa)
    if (accesosEmpresa.length === 0) return { data: [], limitReached: false }
    const filtroEmpresa = accesosEmpresa
      .map((a) => `and(empresa.eq.${a.empresa},proyecto.eq.${a.proyecto})`)
      .join(',')
    query = query.or(filtroEmpresa)
  } else {
    const filtroAccesos = accesos
      .map((a) => `and(empresa.eq.${a.empresa},proyecto.eq.${a.proyecto})`)
      .join(',')
    query = query.or(filtroAccesos)
  }

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

  if (filtros.cliente?.trim()) {
    const filtroClienteAccesos = accesos
      .map((a) => `and(empresa.eq.${a.empresa},proyecto.eq.${a.proyecto})`)
      .join(',')
    const { data: clientesMatch, error: clienteError } = await admin
      .schema('cartera')
      .from('t_cliente')
      .select('empresa, proyecto, codigo')
      .eq('cuenta', cuenta)
      .or(filtroClienteAccesos)
      .ilike('nombre', `%${filtros.cliente.trim()}%`)

    if (clienteError) return { data: [], limitReached: false, error: clienteError.message }
    if (!clientesMatch || clientesMatch.length === 0) return { data: [], limitReached: false }

    const codigos = [...new Set(clientesMatch.map((c) => c.codigo as number))]
    query = query.in('cliente', codigos)
  }

  const { data, error } = await query
    .order('secuencia', { ascending: false })
    .limit(LIMITE_FILAS + 1)

  if (error) return { data: [], limitReached: false, error: error.message }

  const rows = (data ?? []) as ReciboCaja[]
  const limitReached = rows.length > LIMITE_FILAS
  return { data: limitReached ? rows.slice(0, LIMITE_FILAS) : rows, limitReached }
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
  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = createAdminClient()

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
    .select('*')
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
      .eq('empresa', empresa)
      .eq('cuenta_bancaria', recibo.cuenta_deposito)
      .eq('numero_transaccion', recibo.transaccion_bancaria)
      .maybeSingle()
    if (transaccion) deposito = transaccion as ReciboCajaDetalleExtra['deposito']
  }

  // Desglose de "Otros" aplicados por este recibo (t_detalle_recibo_otros), resuelto contra
  // t_tipo_ingreso via t_promesa_otros.secuencia -> tipo_otros (mismo patron que getPlanPago
  // en plan-pago.ts). Solo aplica si el recibo esta ligado a una promesa.
  let otrosColumnas: ReciboOtroColumna[] = []
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
