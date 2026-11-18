'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { clienteDatos } from '@/lib/supabase/datos'
import { PERMISOS } from '@/lib/permisos'
import {
  puedeEmpresa,
  puedeProyecto,
  type AccesoLectura,
} from '@/lib/acceso-proyecto'

/**
 * Devuelve la cuenta que la RLS va a permitir.
 * fn_cuenta_del_usuario() lee app_metadata.cuenta_activa del JWT.
 * La cookie se alinea con ese valor. Si difieren, consultar la cookie
 * deja la pantalla vacía y el INSERT no pasa el WITH CHECK.
 */
export async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ''

  const cuenta = (user.app_metadata as Record<string, string> | undefined)?.cuenta_activa?.trim() ?? ''
  if (!cuenta) return ''

  const datos = await clienteDatos()
  const { count, error } = await datos
    .schema('cartera')
    .from('t_usuario')
    .select('userid', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('userid', user.id)

  if (error || !count) return ''

  const cookieStore = await cookies()
  const fromCookie = cookieStore.get('cartera-cuenta')?.value?.trim() ?? ''
  if (fromCookie !== cuenta) {
    try {
      cookieStore.set('cartera-cuenta', cuenta, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    } catch {
      // En un Server Component las cookies son de solo lectura.
    }
  }
  return cuenta
}

export type { AccesoLectura }

export type PermisosDetalle = {
  consultar: boolean
  agregar: boolean
  modificar: boolean
  eliminar: boolean
}

const DENEGADO: PermisosDetalle = {
  consultar: false,
  agregar: false,
  modificar: false,
  eliminar: false,
}

const COMPLETO: PermisosDetalle = {
  consultar: true,
  agregar: true,
  modificar: true,
  eliminar: true,
}

/**
 * Sesión, membresía de la cuenta y pares empresa/proyecto.
 * es_admin = 1 concede la cuenta completa. Sin fila, o si la columna
 * todavía no existe, la lectura queda cerrada.
 */
export async function leerAcceso(): Promise<AccesoLectura | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cuenta = await getCuentaActiva()
  if (!cuenta) return null

  const admin = await clienteDatos()
  const [usuarioRes, accesosRes] = await Promise.all([
    admin
      .schema('cartera')
      .from('t_usuario')
      .select('es_admin')
      .eq('cuenta', cuenta)
      .eq('userid', user.id)
      .maybeSingle(),
    admin
      .schema('cartera')
      .from('t_usuario_proyecto')
      .select('empresa, proyecto')
      .eq('cuenta', cuenta)
      .eq('userid', user.id),
  ])

  if (usuarioRes.error || !usuarioRes.data || accesosRes.error) return null

  return {
    cuenta,
    userId: user.id,
    esAdmin: usuarioRes.data.es_admin === 1,
    accesos: (accesosRes.data ?? []) as AccesoLectura['accesos'],
  }
}

export async function exigirProyecto(
  empresa: number,
  proyecto: number,
): Promise<{ error: string } | null> {
  const acceso = await leerAcceso()
  if (!acceso) return { error: 'Sesión no válida.' }
  if (!puedeProyecto(acceso, empresa, proyecto)) return { error: 'Acceso denegado.' }
  return null
}

export async function exigirEmpresa(empresa: number): Promise<{ error: string } | null> {
  const acceso = await leerAcceso()
  if (!acceso) return { error: 'Sesión no válida.' }
  if (!puedeEmpresa(acceso, empresa)) return { error: 'Acceso denegado.' }
  return null
}

/**
 * Índices de t_menu con consultar = 1.
 * es_admin = 1 devuelve el catálogo. Sin esa marca, solo las filas explícitas.
 */
export async function getPermisosUsuario(): Promise<string[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []
  if (acceso.esAdmin) return Object.values(PERMISOS)

  const admin = await clienteDatos()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice')
    .eq('cuenta', acceso.cuenta)
    .eq('userid', acceso.userId)
    .eq('consultar', 1)

  if (error) return []
  return (data ?? []).map((fila) => fila.indice as string)
}

/**
 * Detalle consultar/agregar/modificar/eliminar de un índice.
 * es_admin = 1 concede los cuatro. Sin fila para el índice, quedan en falso.
 */
export async function getPermisosDetalle(indice: string): Promise<PermisosDetalle> {
  const acceso = await leerAcceso()
  if (!acceso) return DENEGADO
  if (acceso.esAdmin) return COMPLETO

  const admin = await clienteDatos()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('consultar, agregar, modificar, eliminar')
    .eq('cuenta', acceso.cuenta)
    .eq('userid', acceso.userId)
    .eq('indice', indice)
    .maybeSingle()

  if (error || !data) return DENEGADO

  return {
    consultar: data.consultar === 1,
    agregar: data.agregar === 1,
    modificar: data.modificar === 1,
    eliminar: data.eliminar === 1,
  }
}

/**
 * Guard de server actions. La lectura por id usa 'consultar'; las mutaciones
 * usan agregar, modificar o eliminar.
 *
 * es_admin = 1 permite la operación. Con filas de menú, solo el flag en 1.
 * Sin fila de usuario en la cuenta, o sin el flag, la acción se niega.
 */
export async function requirePermiso(
  indice: string,
  operacion: 'consultar' | 'agregar' | 'modificar' | 'eliminar',
): Promise<{ error: string } | null> {
  const acceso = await leerAcceso()
  if (!acceso) return { error: 'Sesión no válida.' }
  if (acceso.esAdmin) return null

  const admin = await clienteDatos()
  const { data, error } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select(operacion)
    .eq('cuenta', acceso.cuenta)
    .eq('userid', acceso.userId)
    .eq('indice', indice)
    .maybeSingle()

  if (error) return { error: 'No tienes permiso para realizar esta acción.' }

  const row = data as Record<string, number | boolean | null> | null
  const flag = row?.[operacion]
  if (flag !== 1 && flag !== true) {
    return { error: 'No tienes permiso para realizar esta acción.' }
  }

  return null
}
