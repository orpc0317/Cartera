import { createClient } from '@/lib/supabase/server'
import { getCuentaActiva } from '@/app/actions/permisos'
import { getCuentasDelUsuario } from '@/app/actions/auth'
import { getMenuPrincipal } from '@/app/actions/menu'
import type { MenuModulo } from '@/lib/navigation'
import { HomeClient } from './_client'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [menu, cuenta, cuentas] = await Promise.all([
    getMenuPrincipal().catch((e: Error) => {
      console.error('getMenuPrincipal:', e.message)
      return [] as MenuModulo[]
    }),
    getCuentaActiva().catch((e: Error) => {
      console.error('getCuentaActiva:', e.message)
      return ''
    }),
    user
      ? getCuentasDelUsuario(user.id).catch((e: Error) => {
          console.error('getCuentasDelUsuario:', e.message)
          return [] as Awaited<ReturnType<typeof getCuentasDelUsuario>>
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof getCuentasDelUsuario>>),
  ])

  const cuentaNombre = cuentas.find((item) => item.cuenta === cuenta)?.nombre || cuenta

  return <HomeClient modulos={menu} cuentaNombre={cuentaNombre} />
}
