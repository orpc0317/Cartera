import { createClient } from '@supabase/supabase-js'

// Cliente con privilegios de superusuario. SOLO usar en Server Actions y Route Handlers.
// Nunca exponer al cliente ni al navegador.
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
