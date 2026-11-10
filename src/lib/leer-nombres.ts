import type { createAdminClient } from '@/lib/supabase/admin'
import type { NombresVer } from '@/lib/registro-ver'

type Admin = ReturnType<typeof createAdminClient>

export type ConsultaNombres = {
  empresa?: number
  proyecto?: number
  fase?: number
  banco?: number
  cliente?: number
  vendedor?: number
  coordinador?: number
  supervisor?: number
  cobrador?: number
  gface?: number
  pais?: string
  departamento?: string
  municipio?: string
  cuentaBancaria?: number
  cuentaDeposito?: number
}

async function uno(
  admin: Admin,
  tabla: string,
  filtros: Record<string, string | number>,
): Promise<string | null> {
  let query = admin.schema('cartera').from(tabla).select('nombre')
  for (const [columna, valor] of Object.entries(filtros)) query = query.eq(columna, valor)
  const { data } = await query.maybeSingle()
  const nombre = data && typeof data.nombre === 'string' ? data.nombre : null
  return nombre
}

async function cuentaBancariaTexto(
  admin: Admin,
  cuenta: string,
  codigo: number,
): Promise<{ texto: string | null; proyecto: number | null; empresa: number | null; moneda: string | null }> {
  const { data } = await admin
    .schema('cartera')
    .from('t_cuenta_bancaria')
    .select('nombre, numero, banco, proyecto, empresa, moneda')
    .eq('cuenta', cuenta)
    .eq('codigo', codigo)
    .maybeSingle()
  if (!data) return { texto: null, proyecto: null, empresa: null, moneda: null }
  const banco = data.banco
    ? await uno(admin, 't_banco', { cuenta, empresa: data.empresa, proyecto: data.proyecto, codigo: data.banco })
    : null
  const texto = banco ? `${banco} · ${data.numero ?? ''}` : (data.nombre || data.numero || null)
  return { texto, proyecto: data.proyecto ?? null, empresa: data.empresa ?? null, moneda: data.moneda ?? null }
}

export async function leerNombres(admin: Admin, cuenta: string, q: ConsultaNombres): Promise<NombresVer> {
  const out: NombresVer = {}
  const jobs: Promise<void>[] = []
  const empresa = q.empresa
  const proyecto = q.proyecto

  if (empresa != null) {
    jobs.push(uno(admin, 't_empresa', { cuenta, codigo: empresa }).then((nombre) => { out.empresa_nombre = nombre }))
  }
  if (empresa != null && proyecto != null) {
    jobs.push(uno(admin, 't_proyecto', { cuenta, empresa, codigo: proyecto }).then((nombre) => { out.proyecto_nombre = nombre }))
  }
  if (empresa != null && proyecto != null && q.fase != null) {
    jobs.push(uno(admin, 't_fase', { cuenta, empresa, proyecto, codigo: q.fase }).then((nombre) => { out.fase_nombre = nombre }))
  }
  if (empresa != null && proyecto != null && q.banco != null && q.banco !== 0) {
    jobs.push(uno(admin, 't_banco', { cuenta, empresa, proyecto, codigo: q.banco }).then((nombre) => { out.banco_nombre = nombre }))
  } else if (q.banco === 0) {
    out.banco_nombre = null
  }
  if (empresa != null && proyecto != null && q.cliente != null) {
    jobs.push(uno(admin, 't_cliente', { cuenta, empresa, proyecto, codigo: q.cliente }).then((nombre) => { out.cliente_nombre = nombre }))
  }
  if (empresa != null && proyecto != null && q.vendedor != null) {
    jobs.push(uno(admin, 't_vendedor', { cuenta, empresa, proyecto, codigo: q.vendedor }).then((nombre) => { out.vendedor_nombre = nombre }))
  }
  if (empresa != null && proyecto != null && q.coordinador != null && q.coordinador !== 0) {
    jobs.push(uno(admin, 't_coordinador', { cuenta, empresa, proyecto, codigo: q.coordinador }).then((nombre) => { out.coordinador_nombre = nombre }))
  } else if (q.coordinador === 0) {
    out.coordinador_nombre = null
  }
  if (empresa != null && proyecto != null && q.supervisor != null) {
    jobs.push(uno(admin, 't_supervisor', { cuenta, empresa, proyecto, codigo: q.supervisor }).then((nombre) => { out.supervisor_nombre = nombre }))
  }
  if (empresa != null && proyecto != null && q.cobrador != null && q.cobrador !== 0) {
    jobs.push(uno(admin, 't_cobrador', { cuenta, empresa, proyecto, codigo: q.cobrador }).then((nombre) => { out.cobrador_nombre = nombre }))
  } else if (q.cobrador === 0) {
    out.cobrador_nombre = null
  }
  if (empresa != null && proyecto != null && q.gface != null && q.gface !== 0) {
    jobs.push(uno(admin, 't_gface', { cuenta, empresa, proyecto, codigo: q.gface }).then((nombre) => { out.gface_nombre = nombre }))
  } else if (q.gface === 0) {
    out.gface_nombre = null
  }
  if (q.pais) {
    jobs.push(uno(admin, 't_pais', { codigo: q.pais }).then((nombre) => { out.pais_nombre = nombre }))
  } else if (q.pais !== undefined) {
    out.pais_nombre = null
  }
  if (q.pais && q.departamento) {
    jobs.push(
      uno(admin, 't_departamento', { pais: q.pais, codigo: q.departamento })
        .then((nombre) => { out.departamento_nombre = nombre }),
    )
  } else if (q.departamento !== undefined) {
    out.departamento_nombre = null
  }
  if (q.pais && q.departamento && q.municipio) {
    jobs.push(
      uno(admin, 't_municipio', { pais: q.pais, departamento: q.departamento, codigo: q.municipio })
        .then((nombre) => { out.municipio_nombre = nombre }),
    )
  } else if (q.municipio !== undefined) {
    out.municipio_nombre = null
  }
  if (q.cuentaBancaria != null) {
    jobs.push(cuentaBancariaTexto(admin, cuenta, q.cuentaBancaria).then(async (cb) => {
      out.cuenta_bancaria_nombre = cb.texto
      out.moneda_nombre = cb.moneda
      if (out.proyecto_nombre === undefined && cb.empresa != null && cb.proyecto != null) {
        out.proyecto_nombre = await uno(admin, 't_proyecto', { cuenta, empresa: cb.empresa, codigo: cb.proyecto })
      }
    }))
  }
  if (q.cuentaDeposito != null && q.cuentaDeposito !== 0) {
    jobs.push(cuentaBancariaTexto(admin, cuenta, q.cuentaDeposito).then((cb) => {
      out.cuenta_deposito_nombre = cb.texto
    }))
  } else if (q.cuentaDeposito === 0) {
    out.cuenta_deposito_nombre = null
  }

  await Promise.all(jobs)
  return out
}

export async function filaConNombres<T>(
  admin: Admin,
  cuenta: string,
  tabla: string,
  filtros: Record<string, string | number>,
  columnas: string,
  nombres: ConsultaNombres | ((row: T) => ConsultaNombres),
): Promise<{ row?: T & NombresVer; error?: string }> {
  let query = admin.schema('cartera').from(tabla).select(columnas)
  for (const [columna, valor] of Object.entries(filtros)) query = query.eq(columna, valor)
  const { data, error } = await query.maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Registro no encontrado.' }
  const row = data as T
  const consulta = typeof nombres === 'function' ? nombres(row) : nombres
  const resueltos = await leerNombres(admin, cuenta, consulta)
  return { row: { ...row, ...resueltos } }
}
