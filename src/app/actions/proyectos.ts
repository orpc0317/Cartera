'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Proyecto, ProyectoForm } from '@/lib/types/proyectos'

async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

export async function getProyectos(empresa?: number): Promise<Proyecto[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_proyecto')
    .select('*')
    .eq('cuenta', cuenta)
    .order('nombre')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Proyecto[]
}

export async function createProyecto(form: ProyectoForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: max } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  const codigo = (max?.codigo ?? 0) + 1

  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .insert({
      ...form,
      cuenta,
      codigo,
      agrego_usuario: user?.id,
      agrego_fecha: new Date().toISOString(),
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/proyectos')
  revalidatePath('/dashboard')
  return {}
}

export async function updateProyecto(empresa: number, codigo: number, form: Partial<ProyectoForm>): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .update({
      ...form,
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/proyectos')
  return {}
}

export async function deleteProyecto(empresa: number, codigo: number): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_proyecto')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/proyectos')
  revalidatePath('/dashboard')
  return {}
}
