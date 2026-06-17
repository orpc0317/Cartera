'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
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
// Constantes de seguridad
// ─────────────────────────────────────────────────────────────────────────────

const MAX_INTENTOS_FALLIDOS = 5   // intentos fallidos antes de lockout temporal
const VENTANA_LOCKOUT_MIN   = 15  // ventana de tiempo para contar intentos (minutos)
const UMBRAL_ALERTA         = 10  // intentos fallidos en VENTANA_ALERTA_MIN → genera alerta
const VENTANA_ALERTA_MIN    = 60  // ventana de tiempo para alerta (minutos)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
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

async function getIpDelRequest(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

async function estaBloquedoPorIntentos(email: string): Promise<boolean> {
  const admin = createAdminClient()
  const desde = new Date(Date.now() - VENTANA_LOCKOUT_MIN * 60_000).toISOString()
  const { count } = await admin
    .schema('cartera')
    .from('t_login_attempt')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('exitoso', false)
    .gte('fecha', desde)
  return (count ?? 0) >= MAX_INTENTOS_FALLIDOS
}

async function registrarIntento(
  email: string,
  ip: string,
  exitoso: boolean
): Promise<void> {
  const admin = createAdminClient()

  await admin.schema('cartera').from('t_login_attempt').insert({ email, ip, exitoso })

  // Housekeeping: eliminar registros con más de 7 días
  const limite7d = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()
  await admin.schema('cartera').from('t_login_attempt').delete().lt('fecha', limite7d)

  if (!exitoso) {
    const desde = new Date(Date.now() - VENTANA_ALERTA_MIN * 60_000).toISOString()
    const { count } = await admin
      .schema('cartera')
      .from('t_login_attempt')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .eq('exitoso', false)
      .gte('fecha', desde)

    // Generar alerta en múltiplos del umbral para no duplicar
    if ((count ?? 0) >= UMBRAL_ALERTA && (count ?? 0) % UMBRAL_ALERTA === 0) {
      await admin.schema('cartera').from('t_audit_log').insert({
        tabla: 'auth',
        operacion: 'SECURITY_ALERT',
        cuenta: null,
        registro_id: { email },
        datos_antes: null,
        datos_despues: { ip, intentos_en_ventana: count },
        usuario_email: email,
      })
      console.error(
        `[SECURITY] Alerta: ${count} intentos fallidos para ${email} en ${VENTANA_ALERTA_MIN} minutos (IP: ${ip})`
      )
    }
  }
}

async function verificarTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Sin clave configurada (dev local sin .env.local) → se omite la verificación
  if (!secret) return true

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }),
  })
  const data = (await resp.json()) as { success: boolean }
  return data.success === true
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
  const turnstileToken = (formData.get('cf-turnstile-response') as string) ?? ''

  // 1. Verificar CAPTCHA (Cloudflare Turnstile)
  if (!(await verificarTurnstile(turnstileToken))) {
    return { error: 'Verificación de seguridad fallida. Recarga la página e inténtalo de nuevo.' }
  }

  // 2. Verificar lockout por intentos fallidos
  const ip = await getIpDelRequest()
  if (await estaBloquedoPorIntentos(email)) {
    return {
      error: `Acceso bloqueado por múltiples intentos fallidos. Espera ${VENTANA_LOCKOUT_MIN} minutos e inténtalo de nuevo.`,
    }
  }

  // 3. Autenticar con Supabase
  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    await registrarIntento(email, ip, false)
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }

  await registrarIntento(email, ip, true)

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
