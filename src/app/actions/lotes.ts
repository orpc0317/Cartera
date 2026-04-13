'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Lote, LoteForm } from '@/lib/types/proyectos'

async function getCuentaActiva(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.app_metadata as Record<string, string>)?.cuenta_activa ?? ''
}

export async function getLotes(empresa?: number, proyecto?: number, fase?: number, manzana?: string): Promise<Lote[]> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()
  let query = admin
    .schema('cartera')
    .from('t_lote')
    .select('*')
    .eq('cuenta', cuenta)
    .order('empresa').order('proyecto').order('fase').order('manzana').order('codigo')
  if (empresa !== undefined) query = query.eq('empresa', empresa)
  if (proyecto !== undefined) query = query.eq('proyecto', proyecto)
  if (fase !== undefined) query = query.eq('fase', fase)
  if (manzana !== undefined) query = query.eq('manzana', manzana)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Lote[]
}

export async function createLote(form: LoteForm): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_lote')
    .insert({
      ...form,
      cuenta,
      promesa: 0,
      agrego_usuario: user?.id,
      agrego_fecha: new Date().toISOString(),
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/lotes')
  revalidatePath('/dashboard')
  return {}
}

export async function updateLote(
  empresa: number, proyecto: number, fase: number, manzana: string, codigo: string,
  form: Partial<LoteForm>
): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_lote')
    .update({
      ...form,
      modifico_usuario: user?.id,
      modifico_fecha: new Date().toISOString(),
    })
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/lotes')
  return {}
}

export async function deleteLote(empresa: number, proyecto: number, fase: number, manzana: string, codigo: string): Promise<{ error?: string }> {
  const cuenta = await getCuentaActiva()
  const admin = createAdminClient()

  const { error } = await admin
    .schema('cartera')
    .from('t_lote')
    .delete()
    .eq('cuenta', cuenta)
    .eq('empresa', empresa)
    .eq('proyecto', proyecto)
    .eq('fase', fase)
    .eq('manzana', manzana)
    .eq('codigo', codigo)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/proyectos/lotes')
  revalidatePath('/dashboard')
  return {}
}
