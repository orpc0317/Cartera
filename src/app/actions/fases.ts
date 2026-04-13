'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Fase, FaseForm } from '@/lib/types/proyectos'

async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

export async function getFases(empresa?: number, proyecto?: number): Promise<Fase[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_fase')
    .select('*')
    .eq('cuenta', cuenta)
    .order('codigo')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Fase[]
}

export async function createFase(form: FaseForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: max } = await admin
    .schema('cartera')
    .from('t_fase')
    .select('codigo')
    .eq('cuenta', cuenta)
    .eq('empresa', form.empresa)
    .eq('proyecto', form.proyecto)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  const codigo = (max?.codigo ?? 0) + 1

  const { error } = await admin
    .schema('cartera')
    .from('t_fase')
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
  revalidatePath('/dashboard/proyectos/fases')
  revalidatePath('/dashboard')
  return {}
}

export async function updateFase(empresa: number, proyecto: number, codigo: number, form: Partial<FaseForm>): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_fase')
    .update({
      ...form,
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/fases')
  return {}
}

export async function deleteFase(empresa: number, proyecto: number, codigo: number): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_fase')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/fases')
  revalidatePath('/dashboard')
  return {}
}
