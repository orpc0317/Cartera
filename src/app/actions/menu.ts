'use server'

import { clienteDatos } from '@/lib/supabase/datos'
import { leerAcceso } from '@/app/actions/permisos'
import { construirMenu, type MenuModulo, type PantallaMenu } from '@/lib/navigation'

/**
 * Arma el menú principal de la cuenta activa.
 * t_menu es el catálogo global (módulo en menu_array, pantalla en indice).
 * es_admin = 1 muestra el catálogo. Sin esa marca, t_menu_usuario recorta por consultar.
 * t_menu_modulo, si la cuenta tiene filas, limita los módulos por nombre.
 * El cliente admin es el mismo que usa getPermisosUsuario: t_menu no lleva cuenta.
 */
export async function getMenuPrincipal(): Promise<MenuModulo[]> {
  const acceso = await leerAcceso()
  if (!acceso) return []

  const admin = await clienteDatos()
  const [menuRes, modulosRes] = await Promise.all([
    admin.schema('cartera').from('t_menu').select('indice, menu_array, nombre, mantenimiento'),
    admin.schema('cartera').from('t_menu_modulo').select('nombre').eq('cuenta', acceso.cuenta),
  ])

  if (menuRes.error) {
    console.error('getMenuPrincipal t_menu:', menuRes.error.message)
    return []
  }

  let indicesConsultar: Set<string> | null = null
  if (!acceso.esAdmin) {
    const { data, error } = await admin
      .schema('cartera')
      .from('t_menu_usuario')
      .select('indice')
      .eq('cuenta', acceso.cuenta)
      .eq('userid', acceso.userId)
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
