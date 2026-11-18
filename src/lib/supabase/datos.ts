import { createClient } from '@/lib/supabase/server'

export async function clienteDatos() {
  return createClient()
}

export type ClienteDatos = Awaited<ReturnType<typeof clienteDatos>>
