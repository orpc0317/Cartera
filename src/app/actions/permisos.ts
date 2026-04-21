'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISOS } from '@/lib/permisos'

export type PermisosDetalle = {
  consultar: boolean
  agregar: boolean
  modificar: boolean
  eliminar: boolean
}

/**
 * Devuelve los índices de t_menu a los que el usuario tiene acceso (consultar = 1).
 *
 * Regla de fallback:
 *   - Si el usuario NO tiene ninguna fila en t_menu_usuario → acceso total
 *     (modo "setup inicial", sin restricciones configuradas aún)
 *   - Si el usuario SÍ tiene filas → solo los índices con consultar = 1
 */
export async function getPermisosUsuario(): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const admin = createAdminClient()

  // Contar cuántas filas tiene este usuario en t_menu_usuario
  const { count } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice', { count: 'exact', head: true })
    .eq('userid', user.id)

  // Sin configuración = acceso completo (modo setup)
  if (!count || count === 0) {
    return Object.values(PERMISOS)
  }

  // Con configuración = solo lo que explícitamente tiene consultar = 1
  const { data } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice')
    .eq('userid', user.id)
    .eq('consultar', 1)

  return (data ?? []).map((d) => d.indice as string)
}

/**
 * Devuelve el detalle de permisos (consultar/agregar/modificar/eliminar) para
 * un índice de menú específico y el usuario autenticado.
 *
 * Fallback: si el usuario no tiene configuración → acceso total.
 */
export async function getPermisosDetalle(indice: string): Promise<PermisosDetalle> {
  const fullAccess: PermisosDetalle = { consultar: true, agregar: true, modificar: true, eliminar: true }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { consultar: false, agregar: false, modificar: false, eliminar: false }

  const admin = createAdminClient()

  // Contar cuántas filas tiene este usuario en t_menu_usuario
  const { count } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice', { count: 'exact', head: true })
    .eq('userid', user.id)

  // Sin configuración = acceso completo (modo setup)
  if (!count || count === 0) return fullAccess

  const { data } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('consultar, agregar, modificar, eliminar')
    .eq('userid', user.id)
    .eq('indice', indice)
    .maybeSingle()

  // Índice no registrado = sin permisos asignados
  if (!data) return { consultar: false, agregar: false, modificar: false, eliminar: false }

  return {
    consultar: data.consultar === 1,
    agregar:   data.agregar   === 1,
    modificar: data.modificar === 1,
    eliminar:  data.eliminar  === 1,
  }
}
