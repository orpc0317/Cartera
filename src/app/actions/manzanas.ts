'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Manzana, ManzanaForm } from '@/lib/types/proyectos'

async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

export async function getManzanas(empresa?: number, proyecto?: number, fase?: number): Promise<Manzana[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_manzana')
    .select('*')
    .eq('cuenta', cuenta)
    .order('codigo')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  if (fase !== undefined) query = query.eq('fase', fase)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Manzana[]
}

export async function createManzana(form: ManzanaForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_manzana')
    .insert({
      ...form,
      cuenta,
      agrego_usuario: user?.id,
      agrego_fecha: new Date().toISOString(),
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/manzanas')
  revalidatePath('/dashboard')
  return {}
}

export async function updateManzana(
  empresa: number, proyecto: number, fase: number, codigo: string,
  form: Partial<ManzanaForm>
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_manzana')
    .update({
      ...form,
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/manzanas')
  return {}
}

export async function deleteManzana(empresa: number, proyecto: number, fase: number, codigo: string): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_manzana')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/manzanas')
  revalidatePath('/dashboard')
  return {}
}
