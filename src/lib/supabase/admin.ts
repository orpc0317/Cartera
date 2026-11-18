import { createClient } from '@supabase/supabase-js'

// Cliente service_role. Auth admin, auditoría, storage y RPC que lo exigen.
// El CRUD de tablas va con clienteDatos(). Nunca exponer esta llave al navegador.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
