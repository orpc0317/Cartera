'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISOS } from '@/lib/permisos'

/**
 * Devuelve la cuenta activa del usuario.
 * Lee primero la cookie `cartera-cuenta` (aislada por navegador/perfil);
 * si no existe, recurre al JWT app_metadata como fallback.
 */
export async function getCuentaActiva(): Promise<string> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get('cartera-cuenta')?.value
  if (fromCookie) return fromCookie
  // Fallback: JWT app_metadata (sesión sin cookie, p.ej. primer login)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

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

  const cuenta = await getCuentaActiva()
  if (!cuenta) return []

  const admin = createAdminClient()

  // Contar cuántas filas tiene este usuario en t_menu_usuario
  const { count } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('userid', user.id)

  // Sin configuración = acceso completo (modo Admin)
  if (!count || count === 0) {
    return Object.values(PERMISOS)
  }

  // Con configuración = solo lo que explícitamente tiene consultar = 1
  const { data } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice')
    .eq('cuenta', cuenta)
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

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { consultar: false, agregar: false, modificar: false, eliminar: false }

  const admin = createAdminClient()

  // Contar cuántas filas tiene este usuario en t_menu_usuario
  const { count } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('userid', user.id)

  // Sin configuración = acceso completo (modo Admin)
  if (!count || count === 0) return fullAccess

  const { data } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('consultar, agregar, modificar, eliminar')
    .eq('cuenta', cuenta)
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

/**
 * Guard para server actions de escritura.
 *
 * Verifica que el usuario autenticado tenga el permiso requerido para el
 * índice de menú indicado. Devuelve `{ error }` si el acceso está denegado,
 * o `null` si está permitido.
 *
 * Aplica la misma regla de fallback que getPermisosDetalle:
 *   - Sin filas en t_menu_usuario → Admin, acceso completo.
 *   - Con filas pero sin el índice, o con el flag en 0 → denegado.
 */
export async function requirePermiso(
  indice: string,
  operacion: 'agregar' | 'modificar' | 'eliminar',
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Sesión no válida.' }

  const cuenta = await getCuentaActiva()
  if (!cuenta) return { error: 'Sesión no válida.' }

  const admin = createAdminClient()

  const { count } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select('indice', { count: 'exact', head: true })
    .eq('cuenta', cuenta)
    .eq('userid', user.id)

  // Sin configuración = Admin → acceso completo
  if (!count || count === 0) return null

  const { data } = await admin
    .schema('cartera')
    .from('t_menu_usuario')
    .select(operacion)
    .eq('cuenta', cuenta)
    .eq('userid', user.id)
    .eq('indice', indice)
    .maybeSingle()

  const row = data as Record<string, boolean | null> | null
  if (!row || !row[operacion]) {
    return { error: 'No tienes permiso para realizar esta acción.' }
  }

  return null
}
