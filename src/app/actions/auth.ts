'use server'

import { redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bloqueadoPorConteo, ipDeLockout, omitirTurnstile } from '@/lib/login-perimetro'

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

async function cuentasPorId(userId: string): Promise<Cuenta[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('cartera_cuentas_usuario_by_id', {
    p_userid: userId,
  })
  if (error) return []
  return (data ?? []) as Cuenta[]
}

export async function getCuentasDelUsuario(): Promise<Cuenta[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  return cuentasPorId(user.id)
}

async function setCuentaActivaInterna(
  userId: string,
  cuentaId: string
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return { error: 'Sesión no válida.' }

  const cuentas = await cuentasPorId(user.id)
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

  // La cookie acompaña al JWT. La RLS lee la cuenta del JWT, no de la cookie.
  const cookieStore = await cookies()
  cookieStore.set('cartera-cuenta', cuentaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

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

async function contarFallos(
  columna: 'email' | 'ip',
  valor: string,
  desde: string,
): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .schema('cartera')
    .from('t_login_attempt')
    .select('id', { count: 'exact', head: true })
    .eq(columna, valor)
    .eq('exitoso', false)
    .gte('fecha', desde)
  return count ?? 0
}

async function estaBloquedoPorIntentos(email: string, ip: string): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_LOCKOUT_MIN * 60_000).toISOString()
  const porCorreo = await contarFallos('email', email, desde)
  const ipLock = ipDeLockout(ip)
  const porIp = ipLock ? await contarFallos('ip', ipLock, desde) : null
  return bloqueadoPorConteo(porCorreo, porIp, MAX_INTENTOS_FALLIDOS)
}

async function registrarIntento(
  email: string,
  ip: string,
  exitoso: boolean
): Promise<void> {
  const admin = createAdminClient()

  const ipGuardada = ipDeLockout(ip) ?? ip
  await admin.schema('cartera').from('t_login_attempt').insert({
    email,
    ip: ipGuardada,
    exitoso,
  })

  // Housekeeping: eliminar registros con más de 7 días
  const limite7d = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()
  await admin.schema('cartera').from('t_login_attempt').delete().lt('fecha', limite7d)

  if (!exitoso) {
    const desde = new Date(Date.now() - VENTANA_ALERTA_MIN * 60_000).toISOString()
    await alertarSiUmbral(admin, email, ipGuardada, 'email', email, desde)
    if (ipDeLockout(ipGuardada)) {
      await alertarSiUmbral(admin, email, ipGuardada, 'ip', ipGuardada, desde)
    }
  }
}

async function alertarSiUmbral(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  ip: string,
  columna: 'email' | 'ip',
  valor: string,
  desde: string,
): Promise<void> {
  const count = await contarFallos(columna, valor, desde)
  if (count < UMBRAL_ALERTA || count % UMBRAL_ALERTA !== 0) return

  const registroId = columna === 'email' ? { email } : { ip }
  await admin.schema('cartera').from('t_audit_log').insert({
    tabla: 'auth',
    operacion: 'SECURITY_ALERT',
    cuenta: null,
    registro_id: registroId,
    datos_antes: null,
    datos_despues: { ip, intentos_en_ventana: count },
    usuario_email: email,
  })
  console.error(
    `[SECURITY] Alerta: ${count} intentos fallidos por ${columna} en ${VENTANA_ALERTA_MIN} minutos (IP: ${ip})`
  )
}

async function verificarTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (omitirTurnstile(secret, process.env.NODE_ENV)) return true
  if (!secret?.trim()) {
    console.error('[SECURITY] TURNSTILE_SECRET_KEY no está configurada. Login rechazado.')
    return false
  }
  if (!token.trim()) return false

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    })
    if (!resp.ok) return false
    const data = (await resp.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error('[SECURITY] Turnstile no respondió.', error)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions públicas
// ─────────────────────────────────────────────────────────────────────────────

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = formData.get('password') as string
  const turnstileToken = (formData.get('cf-turnstile-response') as string) ?? ''

  // 1. Verificar CAPTCHA (Cloudflare Turnstile)
  if (!(await verificarTurnstile(turnstileToken))) {
    return { error: 'Verificación de seguridad fallida. Recarga la página e inténtalo de nuevo.' }
  }

  // 2. Verificar lockout por intentos fallidos
  const ip = await getIpDelRequest()
  if (await estaBloquedoPorIntentos(email, ip)) {
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
  const cuentas = await cuentasPorId(userId)

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

/**
 * Cambia la cuenta activa sin redirigir (para el switcher del sidebar).
 * El cliente es responsable de notificar otras pestañas y navegar.
 */
export async function switchCuenta(cuentaId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa.' }

  const err = await setCuentaActivaInterna(user.id, cuentaId)
  if (err) return err

  await supabase.auth.refreshSession()
  return {}
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('cartera-cuenta')
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
