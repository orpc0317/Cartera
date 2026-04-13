import { redirect } from 'next/navigation'
import { getPermisosUsuario } from '@/app/actions/permisos'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

export default async function DashboardPage() {
  const permisos = await getPermisosUsuario()

  if (tienePermiso(permisos, PERMISOS.DASH_KPI)) {
    redirect('/dashboard/kpis')
  } else {
    redirect('/dashboard/home')
  }
}
