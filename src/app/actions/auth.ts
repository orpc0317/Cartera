'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos (exportados para usar en componentes cliente)
// ─────────────────────────────────────────────────────────────────────────────

export type Cuenta = { cuenta: string; nombre: string }

export type LoginState =
  | { error: string; cuentas?: never }
  | { cuentas: Cuenta[]; error?: never }
  | null

export type ActionState = { error: string } | null

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados (no exportados)
// ─────────────────────────────────────────────────────────────────────────────

async function getCuentasDelUsuario(userId: string): Promise<Cuenta[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('cartera_cuentas_usuario_by_id', {
    p_userid: userId,
  })
  if (error) return []
  return (data ?? []) as Cuenta[]
}

async function setCuentaActivaInterna(
  userId: string,
  cuentaId: string
): Promise<{ error: string } | null> {
  // Verificar que el usuario pertenece a la cuenta indicada
  const cuentas = await getCuentasDelUsuario(userId)
  const pertenece = cuentas.some((c) => c.cuenta === cuentaId)
  if (!pertenece) {
    return { error: 'El usuario no tiene acceso a la cuenta indicada.' }
  }

  // Escribir cuenta_activa en app_metadata usando el Admin Auth API
  // (no pasa por PostgREST, evita PGRST002)
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { cuenta_activa: cuentaId },
  })
  if (error) return { error: 'No se pudo establecer la cuenta activa.' }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions públicas
// ─────────────────────────────────────────────────────────────────────────────

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }

  const userId = authData.user.id
  const cuentas = await getCuentasDelUsuario(userId)

  if (cuentas.length === 0) {
    await supabase.auth.signOut()
    return { error: 'El usuario no tiene acceso a ninguna cuenta activa.' }
  }

  if (cuentas.length === 1) {
    // Auto-seleccionar la única cuenta disponible
    const err = await setCuentaActivaInterna(userId, cuentas[0].cuenta)
    if (err) return err

    // Refrescar la sesión para que el JWT incluya cuenta_activa
    await supabase.auth.refreshSession()
    redirect('/dashboard')
  }

  // Múltiples cuentas: devolver la lista para que el usuario elija
  return { cuentas }
}

export async function setCuentaActiva(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const cuentaId = formData.get('cuentaId') as string

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No hay sesión activa.' }

  const err = await setCuentaActivaInterna(user.id, cuentaId)
  if (err) return err

  await supabase.auth.refreshSession()
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
