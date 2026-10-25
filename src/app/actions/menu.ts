'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCuentaActiva } from '@/app/actions/permisos'
import { construirMenu, type MenuModulo, type PantallaMenu } from '@/lib/navigation'

/**
 * Arma el menú principal de la cuenta activa.
 * t_menu es el catálogo global (módulo en menu_array, pantalla en indice).
 * t_menu_usuario recorta por consultar; sin filas, el usuario ve todo el catálogo.
 * t_menu_modulo, si la cuenta tiene filas, limita los módulos por nombre.
 * El cliente admin es el mismo que usa getPermisosUsuario: t_menu no lleva cuenta.
 */
export async function getMenuPrincipal(): Promise<MenuModulo[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const cuenta = await getCuentaActiva()
  if (!cuenta) return []

  const admin = createAdminClient()
  const [menuRes, conteoRes, modulosRes] = await Promise.all([
    admin.schema('cartera').from('t_menu').select('indice, menu_array, nombre, mantenimiento'),
    admin
      .schema('cartera')
      .from('t_menu_usuario')
      .select('indice', { count: 'exact', head: true })
      .eq('cuenta', cuenta)
      .eq('userid', user.id),
    admin.schema('cartera').from('t_menu_modulo').select('nombre').eq('cuenta', cuenta),
  ])

  if (menuRes.error) {
    console.error('getMenuPrincipal t_menu:', menuRes.error.message)
    return []
  }

  if (conteoRes.error) {
    console.error('getMenuPrincipal t_menu_usuario:', conteoRes.error.message)
    return []
  }

  let indicesConsultar: Set<string> | null = null
  if ((conteoRes.count ?? 0) > 0) {
    const { data, error } = await admin
      .schema('cartera')
      .from('t_menu_usuario')
      .select('indice')
      .eq('cuenta', cuenta)
      .eq('userid', user.id)
      .eq('consultar', 1)

    if (error) {
      console.error('getMenuPrincipal consultar:', error.message)
      return []
    }
    indicesConsultar = new Set((data ?? []).map((fila) => fila.indice as string))
  }

  const modulosCuenta = modulosRes.error
    ? []
    : (modulosRes.data ?? []).map((fila) => fila.nombre as string)

  return construirMenu({
    pantallas: (menuRes.data ?? []) as PantallaMenu[],
    indicesConsultar,
    modulosCuenta,
  })
}
